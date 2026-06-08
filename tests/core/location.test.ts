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

describe("global-config", () => {
  it("reports first run when no config exists", async () => {
    const gc = await import("../../src/utils/global-config.js");
    expect(await gc.isFirstRun()).toBe(true);
    expect(await gc.read()).toBeNull();
  });

  it("ensureProjectsRoot with assumeYes writes config and creates the dir", async () => {
    const gc = await import("../../src/utils/global-config.js");
    const root = await gc.ensureProjectsRoot({ assumeYes: true });
    expect(root).toBe(path.join(fakeHome.path, "AI-Projects"));
    expect(await fs.pathExists(root)).toBe(true);

    const cfg = await gc.read();
    expect(cfg?.first_run_done).toBe(true);
    expect(await gc.isFirstRun()).toBe(false);
  });

  it("expandHome resolves ~ to homedir", async () => {
    const gc = await import("../../src/utils/global-config.js");
    expect(gc.expandHome("~/foo")).toBe(path.join(fakeHome.path, "foo"));
    expect(gc.expandHome("/abs/path")).toBe("/abs/path");
  });

  it("reuses an existing configured root", async () => {
    const gc = await import("../../src/utils/global-config.js");
    await gc.write({
      projects_root: "~/custom-root/",
      default_arch: null,
      first_run_done: true,
      version: "2.0.0",
    });
    const root = await gc.ensureProjectsRoot({ assumeYes: true });
    expect(root).toBe(path.join(fakeHome.path, "custom-root"));
  });
});

describe("location", () => {
  it("resolves to projects_root/<slug> with no conflict", async () => {
    const loc = await import("../../src/core/location.js");
    const { absPath } = await loc.resolveProjectPath({ slug: "my-app", assumeYes: true });
    expect(absPath).toBe(path.join(fakeHome.path, "AI-Projects", "my-app"));
  });

  it("appends -2 on conflict", async () => {
    const loc = await import("../../src/core/location.js");
    await fs.ensureDir(path.join(fakeHome.path, "AI-Projects", "dup"));
    const { absPath } = await loc.resolveProjectPath({ slug: "dup", assumeYes: true });
    expect(absPath).toBe(path.join(fakeHome.path, "AI-Projects", "dup-2"));
  });

  it("honors --here", async () => {
    const loc = await import("../../src/core/location.js");
    const { absPath } = await loc.resolveProjectPath({ slug: "thing", here: true, assumeYes: true });
    expect(absPath).toBe(path.join(process.cwd(), "thing"));
  });

  it("honors --name override", async () => {
    const loc = await import("../../src/core/location.js");
    const { absPath } = await loc.resolveProjectPath({ slug: "auto", customName: "manual", assumeYes: true });
    expect(absPath).toBe(path.join(fakeHome.path, "AI-Projects", "manual"));
  });
});
