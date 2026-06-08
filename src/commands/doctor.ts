import path from "node:path";
import { logger, chalk } from "../ui/logger.js";
import { fs } from "../utils/fs.js";
import { getGit, isGitRepo } from "../utils/git.js";
import { scanDirectory } from "../core/scanner.js";

interface Check {
  label: string;
  status: "pass" | "warn" | "fail";
  detail?: string;
  weight: number;
}

function icon(status: Check["status"]): string {
  return status === "pass" ? chalk.green("✅") : status === "warn" ? chalk.yellow("⚠️ ") : chalk.red("❌");
}

export async function doctorCommand(): Promise<void> {
  const root = process.cwd();
  const checks: Check[] = [];
  const has = (f: string) => fs.pathExists(path.join(root, f));

  // --- Config checks ---
  const agentsExists = await has("AGENTS.md");
  let agentsNonEmpty = false;
  if (agentsExists) {
    const content = await fs.readFile(path.join(root, "AGENTS.md"), "utf8");
    agentsNonEmpty = content.trim().length > 0;
  }
  checks.push({
    label: "AGENTS.md exists and is non-empty",
    status: agentsNonEmpty ? "pass" : "fail",
    weight: 15,
  });

  for (const f of ["CLAUDE.md", ".cursorrules", ".clinerules"]) {
    if (await has(f)) {
      checks.push({ label: `${f} linked`, status: "pass", weight: 3 });
    } else {
      checks.push({ label: `${f} missing`, status: "warn", weight: 3 });
    }
  }

  // .gitignore contains .env etc.
  let gitignore = "";
  if (await has(".gitignore")) gitignore = await fs.readFile(path.join(root, ".gitignore"), "utf8");
  const ignoresEnv = /(^|\n)\s*\.env/.test(gitignore);
  const ignoresNodeModules = /node_modules/.test(gitignore);
  checks.push({
    label: ".gitignore covers .env / node_modules / dist",
    status: ignoresEnv && ignoresNodeModules ? "pass" : "warn",
    detail: ignoresEnv ? undefined : "add .env to .gitignore",
    weight: 8,
  });
  checks.push({ label: ".env.example exists", status: (await has(".env.example")) ? "pass" : "warn", weight: 4 });
  checks.push({
    label: ".agentguard/config.json exists",
    status: (await has(".agentguard/config.json")) ? "pass" : "fail",
    weight: 8,
  });

  // --- Git checks ---
  const repo = await isGitRepo(root);
  checks.push({ label: "Git repository initialized", status: repo ? "pass" : "fail", weight: 10 });
  if (repo) {
    const git = getGit(root);
    try {
      const status = await git.status();
      checks.push({
        label: "Working tree clean",
        status: status.isClean() ? "pass" : "warn",
        detail: status.isClean() ? undefined : `${status.files.length} uncommitted file(s)`,
        weight: 4,
      });
      const log = await git.log().catch(() => null);
      checks.push({
        label: "At least one commit",
        status: log && log.total > 0 ? "pass" : "warn",
        weight: 4,
      });
    } catch {
      /* ignore */
    }
  }

  // --- Hooks checks ---
  let claudeHooks = false;
  if (await has(".claude/settings.json")) {
    try {
      const s = await fs.readJson(path.join(root, ".claude", "settings.json"));
      claudeHooks = JSON.stringify(s).includes("agentguard");
    } catch {
      /* ignore */
    }
  }
  checks.push({ label: "Claude Code hooks installed", status: claudeHooks ? "pass" : "warn", weight: 8 });

  const hookFiles = ["pre-bash.js", "pre-read.js", "pre-write.js", "pre-tool-use.js"];
  let allHooks = true;
  for (const h of hookFiles) {
    if (!(await has(path.join(".agentguard", "hooks", h)))) allHooks = false;
  }
  checks.push({ label: "Hook scripts present", status: allHooks ? "pass" : "warn", weight: 6 });
  checks.push({
    label: "Git pre-commit hook configured",
    status: (await has(".git/hooks/pre-commit")) ? "pass" : "warn",
    weight: 5,
  });

  // --- Security checks ---
  const issues = await scanDirectory(root);
  checks.push({
    label: "No hardcoded secrets",
    status: issues.length === 0 ? "pass" : "fail",
    detail: issues.length === 0 ? undefined : `${issues.length} potential secret(s) — run \`agt scan\``,
    weight: 12,
  });

  // --- Project health ---
  let hasTest = false;
  if (await has("package.json")) {
    try {
      const pkg = await fs.readJson(path.join(root, "package.json"));
      hasTest = !!(pkg.scripts && pkg.scripts.test);
    } catch {
      /* ignore */
    }
  }
  if (!hasTest && agentsNonEmpty) {
    const content = await fs.readFile(path.join(root, "AGENTS.md"), "utf8");
    hasTest = /test command/i.test(content) && !/none configured/i.test(content);
  }
  checks.push({
    label: "Test command configured",
    status: hasTest ? "pass" : "warn",
    detail: hasTest ? undefined : "agents can't auto-verify changes — add a test command to AGENTS.md",
    weight: 6,
  });

  // --- Render ---
  logger.blank();
  logger.title("📋 AgentGuard project health report");
  logger.raw(chalk.gray("━".repeat(48)));
  for (const c of checks) {
    let line = `${icon(c.status)} ${c.label}`;
    if (c.detail) line += chalk.gray(`  → ${c.detail}`);
    logger.raw(line);
  }
  logger.raw(chalk.gray("━".repeat(48)));

  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce(
    (s, c) => s + (c.status === "pass" ? c.weight : c.status === "warn" ? c.weight * 0.5 : 0),
    0,
  );
  const score = Math.round((earned / totalWeight) * 100);
  const scoreColor = score >= 80 ? chalk.green : score >= 50 ? chalk.yellow : chalk.red;
  logger.raw(`Health score: ${scoreColor(chalk.bold(`${score}/100`))}`);
  logger.raw(chalk.gray("━".repeat(48)));
}
