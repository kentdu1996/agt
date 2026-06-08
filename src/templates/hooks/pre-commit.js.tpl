#!/usr/bin/env node
// AgentGuard pre-commit hook. Installed at .git/hooks/pre-commit (via a tiny shell shim).
// Scans staged files for secrets; blocks the commit (exit 1) if any are found.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const AG_DIR = join(HERE, "..");
const PROJECT_ROOT = join(AG_DIR, "..");

function loadJSON(p, fallback) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
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

const patterns = loadJSON(join(AG_DIR, "secret-patterns.json"), []);

let staged = [];
try {
  staged = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACM"], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter(Boolean);
} catch {
  process.exit(0);
}

const findings = [];
for (const file of staged) {
  let content;
  try {
    content = execFileSync("git", ["show", `:${file}`], {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    continue;
  }
  const lines = content.split(/\r?\n/);
  for (const p of patterns) {
    if (p.fileMatchSource) {
      try {
        const fm = new RegExp(p.fileMatchSource, p.fileMatchFlags || "");
        if (!fm.test(file)) continue;
      } catch {
        continue;
      }
    }
    lines.forEach((line, i) => {
      let re;
      try {
        re = new RegExp(p.source, p.flags.includes("g") ? p.flags : p.flags + "g");
      } catch {
        return;
      }
      let m;
      while ((m = re.exec(line)) !== null) {
        findings.push({ file, line: i + 1, name: p.name, value: m[0] });
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    });
  }
}

if (findings.length > 0) {
  process.stderr.write("\n" + C.red(C.bold("🛑 AgentGuard blocked this commit — secrets detected:")) + "\n\n");
  for (const f of findings) {
    process.stderr.write(`  ${C.bold(f.file)}:${f.line}  ${f.name}  ${mask(f.value)}\n`);
  }
  process.stderr.write(
    "\n" +
      C.gray("Remove the secrets (use environment variables) or run `agt fix --secrets`.\n") +
      C.gray("To bypass once (not recommended): git commit --no-verify\n\n"),
  );
  process.exit(1);
}
process.exit(0);
