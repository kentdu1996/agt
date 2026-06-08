import fs from "fs-extra";
import path from "node:path";
import { SECRET_PATTERNS, type SecretSeverity } from "./secret-patterns.js";

export interface Issue {
  file: string;
  line: number;
  column: number;
  ruleId: string;
  ruleName: string;
  match: string;
  severity: SecretSeverity;
  redactTo?: string;
}

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  "coverage",
  ".venv",
  "venv",
  "__pycache__",
  "target",
  ".agentguard",
]);

const BINARY_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".gz",
  ".tar", ".mp4", ".mp3", ".woff", ".woff2", ".ttf", ".eot", ".lock",
]);

export function scanText(content: string, fileName: string): Issue[] {
  const issues: Issue[] = [];
  const lines = content.split(/\r?\n/);
  for (const rule of SECRET_PATTERNS) {
    if (rule.fileMatch && !rule.fileMatch.test(fileName)) continue;
    lines.forEach((lineText, idx) => {
      const re = new RegExp(
        rule.regex.source,
        rule.regex.flags.includes("g") ? rule.regex.flags : rule.regex.flags + "g",
      );
      let m: RegExpExecArray | null;
      while ((m = re.exec(lineText)) !== null) {
        issues.push({
          file: fileName,
          line: idx + 1,
          column: m.index + 1,
          ruleId: rule.id,
          ruleName: rule.name,
          match: m[0],
          severity: rule.severity,
          redactTo: rule.redactTo,
        });
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    });
  }
  return issues;
}

export async function scanFile(filePath: string): Promise<Issue[]> {
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXT.has(ext)) return [];
  let content: string;
  try {
    const stat = await fs.stat(filePath);
    if (stat.size > 2 * 1024 * 1024) return []; // skip files > 2MB
    content = await fs.readFile(filePath, "utf8");
  } catch {
    return [];
  }
  return scanText(content, filePath);
}

export interface ScanOptions {
  ignoreDirs?: Set<string>;
}

export async function scanDirectory(dir: string, options: ScanOptions = {}): Promise<Issue[]> {
  const ignore = options.ignoreDirs ?? IGNORED_DIRS;
  const results: Issue[] = [];

  async function walk(current: string): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (ignore.has(entry.name)) continue;
        await walk(full);
      } else if (entry.isFile()) {
        const issues = await scanFile(full);
        for (const i of issues) {
          results.push({ ...i, file: path.relative(dir, full) });
        }
      }
    }
  }

  const stat = await fs.stat(dir).catch(() => null);
  if (stat?.isFile()) {
    return scanFile(dir);
  }
  await walk(dir);
  return results;
}
