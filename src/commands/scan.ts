import path from "node:path";
import { logger, chalk } from "../ui/logger.js";
import { scanDirectory, type Issue } from "../core/scanner.js";
import { maskSecret } from "../core/secret-patterns.js";

export async function scanCommand(scanPath: string): Promise<void> {
  const target = path.resolve(process.cwd(), scanPath || ".");
  const issues = await scanDirectory(target);
  printScanReport(issues);
}

export function printScanReport(issues: Issue[]): void {
  if (issues.length === 0) {
    logger.success("No secrets found. 🎉");
    return;
  }

  logger.blank();
  logger.title("🔍 AgentGuard scan results");
  logger.blank();

  const byFile = new Map<string, Issue[]>();
  for (const i of issues) {
    const arr = byFile.get(i.file) ?? [];
    arr.push(i);
    byFile.set(i.file, arr);
  }

  logger.info(
    chalk.bold(
      `Found ${issues.length} potential secret${issues.length > 1 ? "s" : ""} in ${byFile.size} file${byFile.size > 1 ? "s" : ""}:`,
    ),
  );
  logger.blank();

  for (const [file, fileIssues] of byFile) {
    logger.raw(chalk.underline(file));
    for (const i of fileIssues) {
      const sev =
        i.severity === "critical"
          ? chalk.red(i.severity)
          : i.severity === "high"
            ? chalk.yellow(i.severity)
            : chalk.gray(i.severity);
      logger.raw(
        `  ${chalk.gray(`L${i.line}`)}  ${i.ruleName.padEnd(24)} ${maskSecret(i.match)}  [${sev}]`,
      );
    }
    if (/\.env/.test(file)) {
      logger.warn("  This file should be in .gitignore");
    }
    logger.blank();
  }

  logger.dim("Run `agt fix --secrets` to auto-redact.");
}
