import { describe, it, expect } from "vitest";
import { findSecretsInText, maskSecret, SECRET_PATTERNS } from "../src/core/secret-patterns.js";

describe("secret-patterns", () => {
  const positives: Array<[string, string]> = [
    ["OpenAI", 'const k = "sk-abcdefghijklmnopqrstuvwxyz1234"'],
    ["OpenAI proj", 'sk-proj-abcdefghijklmnopqrstuvwxyz1234567890'],
    ["Anthropic", "sk-ant-" + "a".repeat(60)],
    ["Google", "AIza" + "a".repeat(35)],
    ["AWS", "AKIAIOSFODNN7EXAMPLE"],
    ["GitHub", "ghp_" + "a".repeat(36)],
    ["Stripe", "sk_live_" + "a".repeat(30)],
    ["Slack", "xoxb-123456789012-abcdefABCDEF"],
    ["Private key", "-----BEGIN RSA PRIVATE KEY-----"],
  ];

  it.each(positives)("detects %s", (_name, text) => {
    const found = findSecretsInText(text);
    expect(found.length, `expected to detect in: ${text}`).toBeGreaterThan(0);
  });

  const negatives: string[] = [
    "const greeting = 'hello world'",
    "just some normal text here",
    "https://example.com/path",
    "const skipper = true",
  ];

  it.each(negatives)("ignores benign text: %s", (text) => {
    const found = findSecretsInText(text);
    expect(found.length, `expected no detection in: ${text}`).toBe(0);
  });

  it("matches .env assignments only in .env files", () => {
    const env = "API_TOKEN=supersecretvalue123";
    expect(findSecretsInText(env, ".env").some((m) => m.ruleId === "env-assignment")).toBe(true);
    expect(findSecretsInText(env, "config.ts").some((m) => m.ruleId === "env-assignment")).toBe(
      false,
    );
  });

  it("masks secrets", () => {
    const masked = maskSecret("sk-abcdefghijklmnop1234");
    expect(masked).toContain("***");
    expect(masked).not.toBe("sk-abcdefghijklmnop1234");
  });

  it("every rule uses the global flag", () => {
    for (const r of SECRET_PATTERNS) {
      expect(r.regex.flags, `rule ${r.id} must be global`).toContain("g");
    }
  });
});
