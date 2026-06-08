import fs from "fs-extra";
import path from "node:path";
import { templatePath } from "../utils/paths.js";
import { serializeDangerPatterns } from "./danger-patterns.js";
import { serializeSecretPatterns } from "./secret-patterns.js";
import { installClaudeHooks, installGitPreCommit } from "./hooks-installer.js";

const VERSION = "2.0.0";

export type Strictness = "permissive" | "balanced" | "strict";
export type DefensePart = "danger" | "secrets" | "checkpoint" | "precommit";

export interface DefenseBundleOptions {
  strictness?: Strictness;
  skip?: DefensePart[];
  /** Extra fields merged into .agentguard/config.json (e.g. architecture, idea). */
  configExtra?: Record<string, unknown>;
}

const HOOK_FILES = [
  "pre-bash.js",
  "pre-read.js",
  "pre-write.js",
  "pre-tool-use.js",
  "pre-commit.js",
] as const;

/**
 * Install the v1 defense "core four" into a project, reusing the existing
 * hook scripts and installers. Idempotent. Used by both `init` and `new`.
 *
 * Steps:
 *  1. .agentguard/{hooks,checkpoints} dirs
 *  2. serialize danger/secret patterns to JSON for the hook scripts
 *  3. copy hook scripts (strip .tpl)
 *  4. write allowlist + config.json (with strictness)
 *  5. install Claude Code hooks (merge) + git pre-commit
 */
export async function installDefenseBundle(
  projectPath: string,
  opts: DefenseBundleOptions = {},
): Promise<void> {
  const skip = new Set(opts.skip ?? []);
  const strictness: Strictness = opts.strictness ?? "balanced";

  const agDir = path.join(projectPath, ".agentguard");
  await fs.ensureDir(path.join(agDir, "hooks"));
  await fs.ensureDir(path.join(agDir, "checkpoints"));

  // Pattern data for the standalone hook scripts.
  if (!skip.has("danger")) {
    await fs.writeJson(path.join(agDir, "danger-patterns.json"), serializeDangerPatterns(), {
      spaces: 2,
    });
  }
  if (!skip.has("secrets")) {
    await fs.writeJson(path.join(agDir, "secret-patterns.json"), serializeSecretPatterns(), {
      spaces: 2,
    });
  }

  // Copy hook scripts.
  for (const h of HOOK_FILES) {
    const content = await fs.readFile(templatePath("hooks", `${h}.tpl`), "utf8");
    const dest = path.join(agDir, "hooks", h);
    await fs.writeFile(dest, content, "utf8");
    await fs.chmod(dest, 0o755);
  }

  // allowlist + config.
  const allowlistPath = path.join(agDir, "allowlist.txt");
  if (!(await fs.pathExists(allowlistPath))) {
    await fs.writeFile(
      allowlistPath,
      "# AgentGuard allowlist — one exact command per line. Lines starting with # are ignored.\n",
      "utf8",
    );
  }

  await fs.writeJson(
    path.join(agDir, "config.json"),
    {
      version: VERSION,
      strictness,
      createdAt: new Date().toISOString(),
      ...(opts.configExtra ?? {}),
    },
    { spaces: 2 },
  );

  // Claude hooks (covers danger/secrets/checkpoint via PreToolUse matchers).
  if (!skip.has("danger") || !skip.has("secrets") || !skip.has("checkpoint")) {
    await installClaudeHooks(projectPath);
  }

  // Git pre-commit secret scan.
  if (!skip.has("precommit")) {
    await installGitPreCommit(projectPath);
  }
}
