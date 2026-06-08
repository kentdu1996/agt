import fs from "fs-extra";
import path from "node:path";

const AG_SOURCE = "agentguard";

interface HookEntry {
  type: "command";
  command: string;
}
interface MatcherGroup {
  matcher?: string;
  source?: string;
  hooks: HookEntry[];
}

/**
 * Install AgentGuard hooks into .claude/settings.json (merge mode).
 * Adds PreToolUse entries tagged with source:"agentguard" so they can be removed cleanly.
 */
export async function installClaudeHooks(projectRoot: string): Promise<void> {
  const settingsPath = path.join(projectRoot, ".claude", "settings.json");
  let settings: any = {};
  if (await fs.pathExists(settingsPath)) {
    try {
      settings = await fs.readJson(settingsPath);
    } catch {
      settings = {};
    }
  }
  settings.hooks = settings.hooks || {};
  const pre: MatcherGroup[] = settings.hooks.PreToolUse || [];

  // Remove any prior agentguard-tagged groups (idempotent install).
  const filtered = pre.filter((g) => g.source !== AG_SOURCE);

  const node = "node";
  const groups: MatcherGroup[] = [
    {
      matcher: "Write|Edit|MultiEdit|Bash",
      source: AG_SOURCE,
      hooks: [{ type: "command", command: `${node} .agentguard/hooks/pre-tool-use.js` }],
    },
    {
      matcher: "Bash",
      source: AG_SOURCE,
      hooks: [{ type: "command", command: `${node} .agentguard/hooks/pre-bash.js` }],
    },
    {
      matcher: "Read",
      source: AG_SOURCE,
      hooks: [{ type: "command", command: `${node} .agentguard/hooks/pre-read.js` }],
    },
    {
      matcher: "Write|Edit|MultiEdit",
      source: AG_SOURCE,
      hooks: [{ type: "command", command: `${node} .agentguard/hooks/pre-write.js` }],
    },
  ];

  settings.hooks.PreToolUse = [...filtered, ...groups];

  await fs.ensureDir(path.dirname(settingsPath));
  await fs.writeJson(settingsPath, settings, { spaces: 2 });
}

export async function uninstallClaudeHooks(projectRoot: string): Promise<void> {
  const settingsPath = path.join(projectRoot, ".claude", "settings.json");
  if (!(await fs.pathExists(settingsPath))) return;
  let settings: any;
  try {
    settings = await fs.readJson(settingsPath);
  } catch {
    return;
  }
  if (settings.hooks && Array.isArray(settings.hooks.PreToolUse)) {
    settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(
      (g: MatcherGroup) => g.source !== AG_SOURCE,
    );
    if (settings.hooks.PreToolUse.length === 0) delete settings.hooks.PreToolUse;
    if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  }
  await fs.writeJson(settingsPath, settings, { spaces: 2 });
}

/**
 * Install a git pre-commit hook that runs the secret scanner.
 * Writes a small shell shim to .git/hooks/pre-commit. Returns false if not a git repo.
 */
export async function installGitPreCommit(projectRoot: string): Promise<boolean> {
  const hooksDir = path.join(projectRoot, ".git", "hooks");
  if (!(await fs.pathExists(path.join(projectRoot, ".git")))) return false;
  await fs.ensureDir(hooksDir);
  const hookPath = path.join(hooksDir, "pre-commit");
  const shim = `#!/bin/sh
# Installed by AgentGuard
if command -v node >/dev/null 2>&1; then
  node "$(git rev-parse --show-toplevel)/.agentguard/hooks/pre-commit.js" || exit 1
fi
`;
  await fs.writeFile(hookPath, shim, { mode: 0o755 });
  await fs.chmod(hookPath, 0o755);
  return true;
}

export async function uninstallGitPreCommit(projectRoot: string): Promise<void> {
  const hookPath = path.join(projectRoot, ".git", "hooks", "pre-commit");
  if (await fs.pathExists(hookPath)) {
    const content = await fs.readFile(hookPath, "utf8");
    if (content.includes("Installed by AgentGuard")) {
      await fs.remove(hookPath);
    }
  }
}
