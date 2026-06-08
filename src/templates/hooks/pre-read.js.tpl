#!/usr/bin/env node
// AgentGuard pre-read hook. Called by Claude Code PreToolUse(Read).
// Blocks reading .env / *.key / *.pem / credentials files into the agent context.
import { fileURLToPath } from "node:url";

const SENSITIVE = [
  /(^|\/|\\)\.env(\.|$)/i,
  /\.key$/i,
  /\.pem$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /(^|\/|\\)(credentials|secrets)\.json$/i,
  /(^|\/|\\)service-account.*\.json$/i,
  /(^|\/|\\)id_rsa$/i,
];

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

(async () => {
  const raw = await readStdin();
  let filePath = "";
  try {
    const data = JSON.parse(raw || "{}");
    filePath = (data.tool_input && (data.tool_input.file_path || data.tool_input.path)) || "";
  } catch {
    filePath = raw.trim();
  }
  if (!filePath) process.exit(0);

  if (SENSITIVE.some((re) => re.test(filePath))) {
    process.stderr.write(
      [
        "",
        C.red(C.bold("🛑 AgentGuard blocked reading a sensitive file")),
        "",
        `  File: ${C.bold(filePath)}`,
        "",
        "This file likely contains secrets. AgentGuard prevented it from entering the agent's context.",
        C.gray("Its values are already available via environment variables (process.env.*)."),
        "",
      ].join("\n") + "\n",
    );
    process.exit(2);
  }
  process.exit(0);
})();
