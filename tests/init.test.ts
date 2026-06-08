import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { initCommand } from "../src/commands/init.js";

describe("init command (e2e)", () => {
  let dir: string;
  const origCwd = process.cwd();

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "ag-init-"));
  });
  afterEach(async () => {
    process.chdir(origCwd);
    await fs.remove(dir);
  });

  it("creates all expected files with --yes", async () => {
    await initCommand(dir, { yes: true });

    const expected = [
      "AGENTS.md",
      ".gitignore",
      ".env.example",
      ".agentguard/config.json",
      ".agentguard/danger-patterns.json",
      ".agentguard/secret-patterns.json",
      ".agentguard/allowlist.txt",
      ".agentguard/hooks/pre-bash.js",
      ".agentguard/hooks/pre-read.js",
      ".agentguard/hooks/pre-write.js",
      ".agentguard/hooks/pre-tool-use.js",
      ".agentguard/hooks/pre-commit.js",
      "docs/PROJECT_STATE.md",
      "docs/DECISION_LOG.md",
      ".claude/settings.json",
    ];
    for (const f of expected) {
      expect(await fs.pathExists(path.join(dir, f)), `missing ${f}`).toBe(true);
    }
  });

  it("renders AGENTS.md with project name", async () => {
    await initCommand(dir, { yes: true });
    const content = await fs.readFile(path.join(dir, "AGENTS.md"), "utf8");
    expect(content).toContain(path.basename(dir));
    expect(content).toContain("Hard Constraints");
    expect(content).not.toContain("{{");
  });

  it("initializes a git repo with the init commit", async () => {
    await initCommand(dir, { yes: true });
    expect(await fs.pathExists(path.join(dir, ".git"))).toBe(true);
    const { simpleGit } = await import("simple-git");
    const log = await simpleGit({ baseDir: dir }).log();
    expect(log.latest?.message).toContain("initialize AgentGuard");
  });

  it("creates rule-file links/copies", async () => {
    await initCommand(dir, { yes: true });
    for (const f of ["CLAUDE.md", ".cursorrules", ".clinerules"]) {
      const p = path.join(dir, f);
      expect(await fs.pathExists(p), `missing ${f}`).toBe(true);
      const target = await fs.readFile(p, "utf8");
      expect(target.length).toBeGreaterThan(0);
    }
  });

  it("does not overwrite an existing .gitignore (append mode)", async () => {
    await fs.writeFile(path.join(dir, ".gitignore"), "my-custom-ignore-line\n");
    await initCommand(dir, { yes: true });
    const gi = await fs.readFile(path.join(dir, ".gitignore"), "utf8");
    expect(gi).toContain("my-custom-ignore-line");
    expect(gi).toContain(".env");
  });

  it("installs Claude hooks tagged with agentguard", async () => {
    await initCommand(dir, { yes: true });
    const settings = await fs.readJson(path.join(dir, ".claude", "settings.json"));
    const groups = settings.hooks.PreToolUse;
    expect(groups.some((g: any) => g.source === "agentguard")).toBe(true);
  });
});
