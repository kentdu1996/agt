import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { input } from "@inquirer/prompts";

export interface GlobalConfig {
  projects_root: string;
  default_arch: string | null;
  first_run_done: boolean;
  version: string;
}

const VERSION = "2.0.0";

/** ~/.agentguard/global-config.json (honors HOME for testing). */
export function configDir(): string {
  return path.join(os.homedir(), ".agentguard");
}

export function configPath(): string {
  return path.join(configDir(), "global-config.json");
}

/** Expand a leading ~ to the user's home directory and normalize the path. */
export function expandHome(p: string): string {
  let out = p;
  if (out === "~") out = os.homedir();
  else if (out.startsWith("~/") || out.startsWith("~\\")) {
    out = path.join(os.homedir(), out.slice(2));
  }
  // Strip a trailing separator for stable comparisons (but keep root "/").
  return out.length > 1 ? out.replace(/[/\\]+$/, "") : out;
}

export async function read(): Promise<GlobalConfig | null> {
  try {
    return (await fs.readJson(configPath())) as GlobalConfig;
  } catch {
    return null;
  }
}

export async function write(config: GlobalConfig): Promise<void> {
  await fs.ensureDir(configDir());
  await fs.writeJson(configPath(), config, { spaces: 2 });
}

export async function isFirstRun(): Promise<boolean> {
  const cfg = await read();
  return !cfg || !cfg.first_run_done;
}

/**
 * Return the absolute projects root, asking the user once on first run.
 * In non-interactive contexts pass `{ assumeYes: true }` to skip the prompt.
 */
export async function ensureProjectsRoot(opts: { assumeYes?: boolean } = {}): Promise<string> {
  const existing = await read();
  if (existing && existing.first_run_done) {
    return expandHome(existing.projects_root);
  }

  const defaultRoot = "~/AI-Projects/";
  let chosen = defaultRoot;
  if (!opts.assumeYes) {
    chosen = await input({
      message:
        "AgentGuard keeps new projects in one place for easy management. Projects root:",
      default: defaultRoot,
    });
  }
  const abs = expandHome(chosen.trim() || defaultRoot);

  const cfg: GlobalConfig = {
    projects_root: chosen.trim() || defaultRoot,
    default_arch: existing?.default_arch ?? null,
    first_run_done: true,
    version: VERSION,
  };
  await write(cfg);
  await fs.ensureDir(abs);
  return abs;
}
