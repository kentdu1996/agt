#!/usr/bin/env node
// AgentGuard pre-write hook. Called by Claude Code PreToolUse(Write/Edit).
// Blocks writing content that contains hardcoded secrets.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const AG_DIR = join(HERE, "..");

function loadJSON(p, fallback) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
};

function mask(v) {
  if (v.length <= 10) return v.slice(0, 2) + "***";
  return v.slice(0, 6) + "***...***" + v.slice(-4);
}

(async () => {
  const raw = await readStdin();
  let content = "";
  let filePath = "";
  try {
    const data = JSON.parse(raw || "{}");
    const ti = data.tool_input || {};
    filePath = ti.file_path || ti.path || "";
    content = ti.content || ti.new_string || data.content || data.new_string || "";
  } catch {
    content = raw;
  }
  if (!content) process.exit(0);

  const patterns = loadJSON(join(AG_DIR, "secret-patterns.json"), []);
  for (const p of patterns) {
    if (p.fileMatchSource) {
      try {
        const fm = new RegExp(p.fileMatchSource, p.fileMatchFlags || "");
        if (!filePath || !fm.test(filePath)) continue;
      } catch {
        continue;
      }
    }
    let re;
    try {
      re = new RegExp(p.source, p.flags.includes("g") ? p.flags : p.flags + "g");
    } catch {
      continue;
    }
    const m = re.exec(content);
    if (m) {
      process.stderr.write(
        [
          "",
          C.red(C.bold("🛑 AgentGuard blocked writing a hardcoded secret")),
          "",
          `  Type:  ${p.name}`,
          `  Value: ${mask(m[0])}`,
          filePath ? `  File:  ${filePath}` : "",
          "",
          "Do not hardcode secrets. Use an environment variable instead" +
            (p.redactTo ? `, e.g. ${C.bold(p.redactTo)}.` : "."),
          C.gray("Add the value to .env (gitignored) and reference it at runtime."),
          "",
        ]
          .filter(Boolean)
          .join("\n") + "\n",
      );
      process.exit(2);
    }
  }
  process.exit(0);
})();
