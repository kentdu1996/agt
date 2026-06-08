export type Severity = "critical" | "high" | "medium";

export interface DangerRule {
  id: string;
  pattern: RegExp;
  reason: string;
  severity: Severity;
  suggestion?: string;
}

/**
 * Default dangerous command blacklist. Order roughly by destructiveness.
 * Reasons are bilingual-ish (short Chinese) per product spec; user-facing
 * formatting happens in the hook / CLI.
 */
export const DANGER_PATTERNS: DangerRule[] = [
  // --- Deletion ---
  {
    id: "rm-rf-root-home",
    // Blocks: rm -rf /  |  ~  |  ~/path  |  $HOME  |  .  |  ..
    // Does NOT block a relative subdir like: rm -rf ./build
    pattern: /\brm\s+(-[a-z]*\s+)*-?[a-z]*[rf][a-z]*\s+(-[a-z]+\s+)*(\/\S*(\s|$)|(~|\$HOME)\S*(\s|$)|\.\.?(\s|$))/i,
    reason: "删除根目录/用户目录/当前目录 (delete root/home/cwd)",
    severity: "critical",
    suggestion: "Double-check the path. This can wipe your whole machine or project.",
  },
  {
    id: "rm-rf-star",
    pattern: /\brm\s+(-[a-z]*\s+)*-?[a-z]*[rf][a-z]*\s+(-[a-z]+\s+)*\*/i,
    reason: "删除当前目录所有文件 (delete everything in cwd)",
    severity: "critical",
  },
  {
    id: "sudo-rm",
    pattern: /\bsudo\s+rm\b/i,
    reason: "以 root 权限删除文件 (delete files as root)",
    severity: "critical",
  },
  {
    id: "find-delete",
    pattern: /\bfind\b[^\n|]*-delete\b/i,
    reason: "find 批量删除 (bulk delete via find)",
    severity: "high",
  },

  // --- Database ---
  {
    id: "drop-db",
    pattern: /\bdrop\s+(database|table|schema)\b/i,
    reason: "删除数据库/表/模式 (drop database/table/schema)",
    severity: "critical",
  },
  {
    id: "truncate-table",
    pattern: /\btruncate\s+table\b/i,
    reason: "清空表 (truncate table)",
    severity: "high",
  },

  // --- Git destructive ---
  {
    id: "git-force-push-protected",
    pattern: /\bgit\s+push\s+.*(-f\b|--force\b).*\b(main|master|production|prod)\b|\bgit\s+push\s+.*\b(main|master|production|prod)\b.*(-f\b|--force\b)/i,
    reason: "强推保护分支 (force push to protected branch)",
    severity: "high",
    suggestion: "Force-pushing main/master can destroy teammates' work.",
  },
  {
    id: "git-reset-hard-deep",
    pattern: /\bgit\s+reset\s+--hard\s+HEAD~([5-9]|\d{2,})\b/i,
    reason: "硬重置超过 5 个提交 (hard reset more than 5 commits)",
    severity: "high",
  },
  {
    id: "git-clean-fd",
    pattern: /\bgit\s+clean\s+(-[a-z]*\s+)*-[a-z]*f[a-z]*d|\bgit\s+clean\s+(-[a-z]*\s+)*-[a-z]*d[a-z]*f/i,
    reason: "强制清理未追踪文件 (force-clean untracked files)",
    severity: "medium",
  },

  // --- System level ---
  {
    id: "dd-to-device",
    pattern: /\bdd\b[^\n]*\bof=\/dev\//i,
    reason: "dd 写入块设备 (dd to raw device)",
    severity: "critical",
  },
  {
    id: "mkfs",
    pattern: /\bmkfs(\.\w+)?\b/i,
    reason: "格式化文件系统 (format filesystem)",
    severity: "critical",
  },
  {
    id: "chmod-777-root",
    pattern: /\bchmod\s+-R\s+777\s+\//i,
    reason: "递归 777 根目录 (recursive 777 on root)",
    severity: "critical",
  },
  {
    id: "redirect-to-device",
    pattern: />\s*\/dev\/(sd[a-z]|nvme\d|disk\d)/i,
    reason: "覆盖磁盘设备 (overwrite disk device)",
    severity: "critical",
  },

  // --- Remote script execution ---
  {
    id: "curl-pipe-shell",
    pattern: /\b(curl|wget)\b[^\n]*\|\s*(sudo\s+)?(bash|sh|zsh|fish)\b/i,
    reason: "管道执行远程脚本 (pipe remote script to shell)",
    severity: "high",
    suggestion: "Download the script first and inspect it before running.",
  },

  // --- Package publish ---
  {
    id: "npm-publish",
    pattern: /\bnpm\s+publish\b/i,
    reason: "发布 npm 包 (publish npm package)",
    severity: "high",
    suggestion: "Make sure you really intend to publish to the public registry.",
  },
];

export interface DangerMatch {
  rule: DangerRule;
}

/** Returns the first matching danger rule, or null if the command is safe. */
export function matchDanger(command: string, allowlist: string[] = []): DangerMatch | null {
  const normalized = command.trim();
  for (const allowed of allowlist) {
    if (allowed && normalized === allowed.trim()) return null;
  }
  // Strip quoted string literals before matching: text inside quotes (e.g.
  // `echo "rm -rf /"`) is data, not an executed command, so it must not trigger.
  const stripped = normalized
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
  for (const rule of DANGER_PATTERNS) {
    if (rule.pattern.test(stripped)) {
      return { rule };
    }
  }
  return null;
}

/** Serialize patterns to a plain JSON-friendly structure for hook scripts. */
export function serializeDangerPatterns(): Array<{
  id: string;
  source: string;
  flags: string;
  reason: string;
  severity: Severity;
  suggestion?: string;
}> {
  return DANGER_PATTERNS.map((r) => ({
    id: r.id,
    source: r.pattern.source,
    flags: r.pattern.flags,
    reason: r.reason,
    severity: r.severity,
    suggestion: r.suggestion,
  }));
}
