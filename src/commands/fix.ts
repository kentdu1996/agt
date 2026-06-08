import path from "node:path";
import { logger, chalk } from "../ui/logger.js";
import { confirm } from "../ui/prompts.js";
import { fs } from "../utils/fs.js";
import { scanDirectory, type Issue } from "../core/scanner.js";
import { maskSecret } from "../core/secret-patterns.js";
import { getGit, isGitRepo } from "../utils/git.js";

export interface FixOptions {
  secrets?: boolean;
}

export async function fixCommand(opts: FixOptions): Promise<void> {
  if (!opts.secrets) {
    logger.info("Nothing to fix. Use `--secrets` to auto-redact detected secrets.");
    return;
  }

  const root = process.cwd();
  const issues = await scanDirectory(root);
  // Only fix code-embedded secrets (skip .env files — those just get gitignored advice).
  const codeIssues = issues.filter((i) => i.redactTo && !/\.env/.test(i.file));

  if (codeIssues.length === 0) {
    logger.success("No fixable hardcoded secrets found.");
    const envIssues = issues.filter((i) => /\.env/.test(i.file));
    if (envIssues.length > 0) {
      logger.warn("Found secrets in .env-like files — make sure they are in .gitignore.");
    }
    return;
  }

  // Group by file so we rewrite each file once.
  const byFile = new Map<string, Issue[]>();
  for (const i of codeIssues) {
    const arr = byFile.get(i.file) ?? [];
    arr.push(i);
    byFile.set(i.file, arr);
  }

  const envExamplePath = path.join(root, ".env.example");
  let envExampleAdditions = "";
  let fixedCount = 0;

  for (const [relFile, fileIssues] of byFile) {
    const full = path.join(root, relFile);
    let content = await fs.readFile(full, "utf8");
    for (const issue of fileIssues) {
      logger.info(
        `${chalk.underline(relFile)}:${issue.line}  ${issue.ruleName}  ${maskSecret(issue.match)}`,
      );
      const ok = await confirm(`Replace with \`${issue.redactTo}\`?`, true);
      if (!ok) continue;
      // Replace the literal occurrence (string-literal aware: drop surrounding quotes).
      content = replaceSecret(content, issue.match, issue.redactTo!);
      const envVar = issue.redactTo!.replace(/^process\.env\./, "");
      if (envVar && !envExampleAdditions.includes(envVar + "=")) {
        envExampleAdditions += `${envVar}=\n`;
      }
      fixedCount++;
    }
    await fs.writeFile(full, content, "utf8");
  }

  if (envExampleAdditions) {
    let existing = "";
    if (await fs.pathExists(envExamplePath)) existing = await fs.readFile(envExamplePath, "utf8");
    const toAdd = envExampleAdditions
      .split("\n")
      .filter((l) => l && !existing.includes(l.split("=")[0] + "="))
      .join("\n");
    if (toAdd) {
      await fs.writeFile(
        envExamplePath,
        (existing.endsWith("\n") || existing === "" ? existing : existing + "\n") +
          "\n# Added by AgentGuard fix\n" +
          toAdd +
          "\n",
        "utf8",
      );
      logger.success("Updated .env.example with redacted variable names.");
    }
  }

  logger.success(`Redacted ${fixedCount} secret${fixedCount > 1 ? "s" : ""}.`);

  // Commit a checkpoint of the fix.
  if (await isGitRepo(root)) {
    try {
      const git = getGit(root);
      await git.add(".");
      await git.commit("chore: redact hardcoded secrets (agentguard fix)");
      logger.dim("Committed fix as a checkpoint.");
    } catch {
      /* non-fatal */
    }
  }
}

/**
 * Replace a secret literal with an env reference. If the secret is wrapped in
 * quotes, replace the whole quoted literal so the result is valid code.
 */
function replaceSecret(content: string, secret: string, replacement: string): string {
  const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const quoted = new RegExp(`(['"\`])${escaped}\\1`, "g");
  if (quoted.test(content)) {
    return content.replace(new RegExp(`(['"\`])${escaped}\\1`, "g"), replacement);
  }
  return content.replace(new RegExp(escaped, "g"), replacement);
}
