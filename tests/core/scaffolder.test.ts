import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "node:path";
import { dir as tmpDir, type DirectoryResult } from "tmp-promise";
import { execute, renderTemplateFile } from "../../src/core/scaffolder.js";
import { getArchitectureById } from "../../src/core/architecture-router.js";
import type { InitStep, TemplateContext } from "../../src/core/types.js";

let work: DirectoryResult;

function ctx(): TemplateContext {
  return {
    idea: "a test idea",
    slug: "scaffold-test",
    date: "2026-06-08",
    user: { name: "Tester" },
    architecture: getArchitectureById("node-cli")!,
    answers: { ui: "cli", data: "none", users: "single", aiInvolved: false },
  };
}

beforeEach(async () => {
  work = await tmpDir({ unsafeCleanup: true });
});
afterEach(async () => {
  await work.cleanup();
});

describe("scaffolder.execute", () => {
  it("runs write + mkdir + patch steps", async () => {
    const projectPath = path.join(work.path, "proj");
    const steps: InitStep[] = [
      { type: "mkdir", path: "src" },
      { type: "write", file: "src/cli.ts", content: "// {{slug}}\nconsole.log('{{idea}}')" },
      { type: "write", file: "package.json", content: "{}" },
      {
        type: "patch",
        file: "package.json",
        patches: [
          { set: "type", value: "module" },
          { set: "bin", value: { "{{slug}}": "./dist/cli.js" } },
          { set: "scripts.build", value: "tsc" },
        ],
      },
    ];
    await execute(steps, projectPath, ctx());

    expect(await fs.pathExists(path.join(projectPath, "src"))).toBe(true);
    const cli = await fs.readFile(path.join(projectPath, "src/cli.ts"), "utf8");
    expect(cli).toContain("scaffold-test");
    expect(cli).toContain("a test idea");

    const pkg = await fs.readJson(path.join(projectPath, "package.json"));
    expect(pkg.type).toBe("module");
    expect(pkg.bin["scaffold-test"]).toBe("./dist/cli.js");
    expect(pkg.scripts.build).toBe("tsc");
  });

  it("dry-run does not write files", async () => {
    const projectPath = path.join(work.path, "dry");
    await execute([{ type: "write", file: "a.txt", content: "hi" }], projectPath, ctx(), {
      dryRun: true,
    });
    expect(await fs.pathExists(path.join(projectPath, "a.txt"))).toBe(false);
  });

  it("moves failed project aside on exec error", async () => {
    const projectPath = path.join(work.path, "boom");
    const steps: InitStep[] = [
      { type: "write", file: "a.txt", content: "hi" },
      { type: "exec", cmd: "this-command-does-not-exist-xyz --nope" },
    ];
    await expect(execute(steps, projectPath, ctx())).rejects.toBeTruthy();
    expect(await fs.pathExists(projectPath)).toBe(false);
    const siblings = await fs.readdir(work.path);
    expect(siblings.some((s) => s.startsWith("boom.agentguard-failed-"))).toBe(true);
  });

  it("renderTemplateFile renders a data template", async () => {
    const dest = path.join(work.path, "IDEA.md");
    await renderTemplateFile("IDEA.md.tpl", dest, ctx());
    const content = await fs.readFile(dest, "utf8");
    expect(content).toContain("a test idea");
    expect(content).not.toContain("{{idea}}");
  });
});
