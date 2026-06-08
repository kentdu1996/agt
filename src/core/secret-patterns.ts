export type SecretSeverity = "critical" | "high" | "medium";

export interface SecretRule {
  id: string;
  name: string;
  regex: RegExp;
  severity: SecretSeverity;
  redactTo?: string;
  fileMatch?: RegExp;
}

/**
 * Secret detection patterns (lightweight, regex-only, no external binary).
 * All regexes use the `g` flag so scanners can find all occurrences per line.
 */
export const SECRET_PATTERNS: SecretRule[] = [
  {
    id: "openai",
    name: "OpenAI API Key",
    regex: /sk-(proj-)?[A-Za-z0-9_-]{20,}/g,
    severity: "critical",
    redactTo: "process.env.OPENAI_API_KEY",
  },
  {
    id: "anthropic",
    name: "Anthropic API Key",
    regex: /sk-ant-[A-Za-z0-9_-]{50,}/g,
    severity: "critical",
    redactTo: "process.env.ANTHROPIC_API_KEY",
  },
  {
    id: "google-ai",
    name: "Google AI / GCP API Key",
    regex: /AIza[0-9A-Za-z_-]{35}/g,
    severity: "high",
    redactTo: "process.env.GOOGLE_API_KEY",
  },
  {
    id: "aws-access-key",
    name: "AWS Access Key ID",
    regex: /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|ANPA|ANVA)[0-9A-Z]{16}\b/g,
    severity: "critical",
    redactTo: "process.env.AWS_ACCESS_KEY_ID",
  },
  {
    id: "github-token",
    name: "GitHub Token",
    regex: /\bgh[pousr]_[A-Za-z0-9]{36}\b/g,
    severity: "critical",
    redactTo: "process.env.GITHUB_TOKEN",
  },
  {
    id: "stripe",
    name: "Stripe Secret Key",
    regex: /\bsk_(test|live)_[A-Za-z0-9]{24,}\b/g,
    severity: "critical",
    redactTo: "process.env.STRIPE_SECRET_KEY",
  },
  {
    id: "slack",
    name: "Slack Token",
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
    severity: "high",
    redactTo: "process.env.SLACK_TOKEN",
  },
  {
    id: "jwt",
    name: "JWT / Supabase Service Key",
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    severity: "high",
    redactTo: "process.env.SERVICE_KEY",
  },
  {
    id: "private-key",
    name: "Private Key",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g,
    severity: "critical",
  },
  {
    id: "env-assignment",
    name: ".env secret assignment",
    // KEY = "value" with a value of >= 8 non-space chars; only in .env-like files.
    regex: /^\s*[A-Z][A-Z0-9_]*\s*=\s*['"]?(?!\s*$)[^'"\s#]{8,}/gm,
    severity: "medium",
    fileMatch: /(^|\/|\\)\.env(\.|$)/,
  },
];

export interface SecretMatch {
  ruleId: string;
  ruleName: string;
  severity: SecretSeverity;
  match: string;
  index: number;
  redactTo?: string;
}

/** Mask the middle of a secret for display: sk-proj-***...***xyz */
export function maskSecret(value: string): string {
  if (value.length <= 10) return value.slice(0, 2) + "***";
  const head = value.slice(0, 6);
  const tail = value.slice(-4);
  return `${head}***...***${tail}`;
}

/**
 * Find secrets in a single line/string. If `fileName` is provided, file-scoped
 * rules (fileMatch) only apply when the file name matches.
 */
export function findSecretsInText(text: string, fileName?: string): SecretMatch[] {
  const results: SecretMatch[] = [];
  for (const rule of SECRET_PATTERNS) {
    if (rule.fileMatch) {
      if (!fileName || !rule.fileMatch.test(fileName)) continue;
    }
    const re = new RegExp(rule.regex.source, rule.regex.flags.includes("g") ? rule.regex.flags : rule.regex.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        match: m[0],
        index: m.index,
        redactTo: rule.redactTo,
      });
      if (m.index === re.lastIndex) re.lastIndex++; // avoid zero-width loop
    }
  }
  return results;
}

export function serializeSecretPatterns(): Array<{
  id: string;
  name: string;
  source: string;
  flags: string;
  severity: SecretSeverity;
  redactTo?: string;
  fileMatchSource?: string;
  fileMatchFlags?: string;
}> {
  return SECRET_PATTERNS.map((r) => ({
    id: r.id,
    name: r.name,
    source: r.regex.source,
    flags: r.regex.flags,
    severity: r.severity,
    redactTo: r.redactTo,
    fileMatchSource: r.fileMatch?.source,
    fileMatchFlags: r.fileMatch?.flags,
  }));
}
