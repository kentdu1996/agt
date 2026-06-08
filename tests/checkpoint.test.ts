import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { simpleGit } from "simple-git";
import {
  createCheckpoint,
  listCheckpoints,
  rollbackTo,
  gcOldCheckpoints,
} from "../src/core/checkpoint.js";

describe("checkpoint", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "ag-cp-"));
    const git = simpleGit({ baseDir: dir });
    await git.init();
    await git.addConfig("user.email", "test@example.com");
    await git.addConfig("user.name", "Test");
    await fs.ensureDir(path.join(dir, ".agentguard", "checkpoints"));
    await fs.writeFile(path.join(dir, "file.txt"), "v1\n");
    await git.add(".");
    await git.commit("initial");
  });
  afterEach(async () => {
    await fs.remove(dir);
  });

  it("creates a checkpoint, then rollback restores the file", async () => {
    // Modify the file (uncommitted change).
    await fs.writeFile(path.join(dir, "file.txt"), "v2\n");
    const id = await createCheckpoint(dir, { tool: "Edit", action: "file.txt" });
    expect(id).toBeTruthy();

    // Further modify.
    await fs.writeFile(path.join(dir, "file.txt"), "v3-broken\n");
    expect(await fs.readFile(path.join(dir, "file.txt"), "utf8")).toBe("v3-broken\n");

    // Roll back to checkpoint (v2 state).
    await rollbackTo(dir, id!);
    expect(await fs.readFile(path.join(dir, "file.txt"), "utf8")).toBe("v2\n");
  });

  it("does not change the main git log", async () => {
    const git = simpleGit({ baseDir: dir });
    const before = await git.log();
    await fs.writeFile(path.join(dir, "file.txt"), "changed\n");
    await createCheckpoint(dir, { tool: "Edit", action: "file.txt" });
    const after = await git.log();
    expect(after.total).toBe(before.total);
  });

  it("gc keeps recent checkpoints and removes old ones", async () => {
    // Create 60 fake checkpoint metadata files with old timestamps.
    const cpDir = path.join(dir, ".agentguard", "checkpoints");
    const old = Date.now() - 8 * 24 * 60 * 60 * 1000;
    for (let i = 0; i < 60; i++) {
      const id = `cp-${old + i}`;
      await fs.writeJson(path.join(cpDir, `${id}.json`), {
        id,
        sha: "",
        tool: "Test",
        action: "x",
        timestamp: old + i,
      });
    }
    const removed = await gcOldCheckpoints(dir, 50, 7);
    const remaining = await listCheckpoints(dir);
    expect(remaining.length).toBe(50);
    expect(removed).toBe(10);
  });
});
