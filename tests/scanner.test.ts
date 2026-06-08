import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { scanDirectory, scanText } from "../src/core/scanner.js";

describe("scanner", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "ag-scan-"));
  });
  afterEach(async () => {
    await fs.remove(dir);
  });

  it("scanText finds line and column", () => {
    const issues = scanText('a\nconst k = "ghp_' + "a".repeat(36) + '"', "x.ts");
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].line).toBe(2);
  });

  it("scans a directory and reports relative paths", async () => {
    await fs.outputFile(path.join(dir, "src", "config.ts"), 'export const k = "ghp_' + "a".repeat(36) + '";');
    await fs.outputFile(path.join(dir, "README.md"), "no secrets here");
    const issues = await scanDirectory(dir);
    expect(issues.length).toBe(1);
    expect(issues[0].file).toBe(path.join("src", "config.ts"));
  });

  it("ignores node_modules and .git", async () => {
    await fs.outputFile(path.join(dir, "node_modules", "x.js"), 'const k = "ghp_' + "a".repeat(36) + '"');
    await fs.outputFile(path.join(dir, ".git", "config"), 'const k = "ghp_' + "a".repeat(36) + '"');
    const issues = await scanDirectory(dir);
    expect(issues.length).toBe(0);
  });
});
