#!/usr/bin/env node
// AgentGuard pre-tool-use hook. Called by Claude Code PreToolUse(Write/Edit/Bash).
// Creates a lightweight git checkpoint BEFORE the agent acts, so changes can be rolled back.
// Never blocks (always exits 0); it only snapshots. Self-contained (uses git CLI via child_process).
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const AG_DIR = join(HERE, "..");
const PROJECT_ROOT = join(AG_DIR, "..");
const CP_DIR = join(AG_DIR, "checkpoints");

function git(args) {
  return execFileSync("git", args, { cwd: PROJECT_ROOT, encoding: "utf8" }).trim();
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

(async () => {
  const raw = await readStdin();
  let tool = "unknown";
  let action = "";
  try {
    const data = JSON.parse(raw || "{}");
    tool = data.tool_name || data.tool || "unknown";
    const ti = data.tool_input || {};
    action = ti.command || ti.file_path || ti.path || "";
  } catch {
    /* ignore */
  }

  try {
    // Make sure we're in a git repo.
    git(["rev-parse", "--is-inside-work-tree"]);
    const sha = git(["stash", "create"]); // snapshot working tree without touching the stash stack
    if (sha) {
      const id = `cp-${Date.now()}`;
      git(["update-ref", `refs/agentguard/${id}`, sha]);
      if (!existsSync(CP_DIR)) mkdirSync(CP_DIR, { recursive: true });
      writeFileSync(
        join(CP_DIR, `${id}.json`),
        JSON.stringify({ id, sha, tool, action, timestamp: Date.now() }, null, 2),
      );
    }
  } catch {
    // Checkpointing is best-effort; never block the agent on failure.
  }
  process.exit(0);
})();
