import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { dir as tmpDir, type DirectoryResult } from "tmp-promise";

let fakeHome: DirectoryResult;

beforeEach(async () => {
  fakeHome = await tmpDir({ unsafeCleanup: true });
  vi.spyOn(os, "homedir").mockReturnValue(fakeHome.path);
  vi.resetModules();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fakeHome.cleanup();
});

describe("new command (e2e, generic path)", () => {
  it("bootstraps a generic project with all AgentGuard files", async () => {
    const { newCommand } = await import("../src/commands/new.js");
    // Desktop idea routes to the fallback (generic) architecture: no npm install.
    await newCommand("一个简单的桌面便签工具", { yes: true });

    const projectDir = path.join(fakeHome.path, "AI-Projects", "jian-dan-zhuo");
    expect(await fs.pathExists(projectDir)).toBe(true);

    const expected = [
      "AGENTS.md",
      "CLAUDE.md",
      ".cursorrules",
      ".clinerules",
      "README.md",
      ".gitignore",
      "docs/IDEA.md",
      "docs/DECISION_LOG.md",
      "docs/PROJECT_STATE.md",
      ".agentguard/config.json",
      ".agentguard/danger-patterns.json",
      ".agentguard/secret-patterns.json",
      ".agentguard/hooks/pre-bash.js",
      ".agentguard/hooks/pre-commit.js",
      ".claude/settings.json",
    ];
    for (const f of expected) {
      expect(await fs.pathExists(path.join(projectDir, f)), `missing ${f}`).toBe(true);
    }

    // AGENTS.md is fully rendered and within the line cap.
    const md = await fs.readFile(path.join(projectDir, "AGENTS.md"), "utf8");
    expect(md).not.toContain("{{");
    expect(md.split("\n").length).toBeLessThanOrEqual(250);

    // config records the architecture + idea.
    const cfg = await fs.readJson(path.join(projectDir, ".agentguard", "config.json"));
    expect(cfg.architecture).toBe("generic");
    expect(cfg.idea).toContain("便签");

    // IDEA.md captured the original idea.
    const idea = await fs.readFile(path.join(projectDir, "docs", "IDEA.md"), "utf8");
    expect(idea).toContain("便签");
  });

  it("resolves naming conflicts with -2 suffix", async () => {
    const { newCommand } = await import("../src/commands/new.js");
    await fs.ensureDir(path.join(fakeHome.path, "AI-Projects", "jian-dan-zhuo"));
    await newCommand("一个简单的桌面便签工具", { yes: true });
    expect(
      await fs.pathExists(path.join(fakeHome.path, "AI-Projects", "jian-dan-zhuo-2")),
    ).toBe(true);
  });

  it("dry-run creates no project files", async () => {
    const { newCommand } = await import("../src/commands/new.js");
    await newCommand("一个桌面工具", { yes: true, dryRun: true, name: "dry-proj" });
    const projectDir = path.join(fakeHome.path, "AI-Projects", "dry-proj");
    // The dir may be created but should contain no generated files.
    const files = (await fs.pathExists(projectDir)) ? await fs.readdir(projectDir) : [];
    expect(files.includes("AGENTS.md")).toBe(false);
  });

  it("--here creates the project under the current directory", async () => {
    const cwd = await tmpDir({ unsafeCleanup: true });
    const prev = process.cwd();
    process.chdir(cwd.path);
    try {
      const { newCommand } = await import("../src/commands/new.js");
      await newCommand("桌面小工具", { yes: true, here: true, name: "here-proj" });
      expect(await fs.pathExists(path.join(cwd.path, "here-proj", "AGENTS.md"))).toBe(true);
    } finally {
      process.chdir(prev);
      await cwd.cleanup();
    }
  });

  it("installs working defense hooks (pre-bash blocks rm -rf /)", async () => {
    const { newCommand } = await import("../src/commands/new.js");
    await newCommand("桌面便签", { yes: true, name: "guard-proj" });
    const hook = path.join(fakeHome.path, "AI-Projects", "guard-proj", ".agentguard", "hooks", "pre-bash.js");
    const { spawnSync } = await import("node:child_process");
    const res = spawnSync("node", [hook], {
      input: JSON.stringify({ tool_input: { command: "rm -rf /" } }),
      encoding: "utf8",
    });
    expect(res.status).toBe(2);
  });
});
