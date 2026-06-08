#!/usr/bin/env node
// AgentGuard pre-bash hook. Called by Claude Code PreToolUse(Bash).
// Reads { tool_input: { command } } from stdin, blocks dangerous commands with exit 2.
// Self-contained: only Node built-ins, loads patterns from .agentguard/danger-patterns.json.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const AG_DIR = join(HERE, ".."); // .agentguard/

function loadJSON(p, fallback) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

function loadAllowlist() {
  try {
    return readFileSync(join(AG_DIR, "allowlist.txt"), "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  } catch {
    return [];
  }
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
};

(async () => {
  const raw = await readStdin();
  let command = "";
  try {
    const data = JSON.parse(raw || "{}");
    command = (data.tool_input && data.tool_input.command) || data.command || "";
  } catch {
    command = raw;
  }
  if (!command || !command.trim()) process.exit(0);

  const patterns = loadJSON(join(AG_DIR, "danger-patterns.json"), []);
  const allowlist = loadAllowlist();
  const normalized = command.trim();

  if (allowlist.some((a) => a === normalized)) process.exit(0);

  // Strip quoted string literals: text inside quotes is data, not a command.
  const scanTarget = normalized
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");

  for (const p of patterns) {
    let re;
    try {
      re = new RegExp(p.source, p.flags || "");
    } catch {
      continue;
    }
    if (re.test(scanTarget)) {
      const lines = [
        "",
        C.red(C.bold("🛑 AgentGuard blocked a dangerous command")),
        "",
        `  Command:  ${C.bold(command)}`,
        `  Reason:   ${p.reason}`,
        `  Severity: ${p.severity}`,
        "",
        "This operation may be irreversible.",
      ];
      if (p.suggestion) lines.push(C.gray("  " + p.suggestion));
      lines.push(
        "",
        C.gray("To allow this once, run the command yourself in a terminal."),
        C.gray(`To always allow, run: agt allow ${JSON.stringify(command)}`),
        "",
      );
      process.stderr.write(lines.join("\n") + "\n");
      process.exit(2); // exit 2 => Claude Code blocks and shows stderr to the agent/user
    }
  }
  process.exit(0);
})();
