import { logger } from "../ui/logger.js";
import {
  installClaudeHooks,
  uninstallClaudeHooks,
  installGitPreCommit,
  uninstallGitPreCommit,
} from "../core/hooks-installer.js";
import { fs } from "../utils/fs.js";
import path from "node:path";

export async function hooksCommand(action: "install" | "uninstall"): Promise<void> {
  const root = process.cwd();
  if (!(await fs.pathExists(path.join(root, ".agentguard")))) {
    logger.error("Not an AgentGuard project (no .agentguard/). Run `agt init` first.");
    process.exitCode = 1;
    return;
  }
  if (action === "install") {
    await installClaudeHooks(root);
    const gitOk = await installGitPreCommit(root);
    logger.success("Claude Code hooks installed.");
    if (gitOk) logger.success("Git pre-commit hook installed.");
    else logger.warn("Not a git repo; skipped pre-commit hook.");
  } else {
    await uninstallClaudeHooks(root);
    await uninstallGitPreCommit(root);
    logger.success("AgentGuard hooks removed.");
  }
}
