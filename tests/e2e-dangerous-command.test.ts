import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { initCommand } from "../src/commands/init.js";

describe("dangerous-command hook (e2e)", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "ag-e2e-"));
    await initCommand(dir, { yes: true });
  });
  afterEach(async () => {
    await fs.remove(dir);
  });

  function runHook(command: string): number {
    const hook = path.join(dir, ".agentguard", "hooks", "pre-bash.js");
    const res = spawnSync("node", [hook], {
      input: JSON.stringify({ tool_input: { command } }),
      encoding: "utf8",
    });
    return res.status ?? -1;
  }

  it("blocks rm -rf / with exit code 2", () => {
    expect(runHook("rm -rf /")).toBe(2);
  });

  it("allows a safe command with exit code 0", () => {
    expect(runHook("ls -la")).toBe(0);
  });

  it("respects the allowlist after agentguard allow", async () => {
    expect(runHook("git push -f origin main")).toBe(2);
    await fs.appendFile(
      path.join(dir, ".agentguard", "allowlist.txt"),
      "git push -f origin main\n",
    );
    expect(runHook("git push -f origin main")).toBe(0);
  });
});
