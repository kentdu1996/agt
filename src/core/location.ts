import fs from "fs-extra";
import path from "node:path";
import { ensureProjectsRoot } from "../utils/global-config.js";

export interface ResolveOptions {
  slug: string;
  here?: boolean;
  customName?: string;
  assumeYes?: boolean;
}

export interface ResolvedLocation {
  absPath: string;
  createdParents: string[];
}

/**
 * Decide the final project path for a slug.
 * - `--here`: cwd/<name>
 * - otherwise: <projects_root>/<name>, asking for root once on first run
 * Resolves naming conflicts by appending -2..-9, then a base36 timestamp.
 * Creates the PARENT directory only; the project dir itself is left to the scaffolder.
 */
export async function resolveProjectPath(opts: ResolveOptions): Promise<ResolvedLocation> {
  const name = (opts.customName && opts.customName.trim()) || opts.slug;
  const root = opts.here
    ? process.cwd()
    : await ensureProjectsRoot({ assumeYes: opts.assumeYes });

  let finalName = name;
  let abs = path.join(root, finalName);

  if (await fs.pathExists(abs)) {
    let resolved = false;
    for (let i = 2; i <= 9; i++) {
      finalName = `${name}-${i}`;
      abs = path.join(root, finalName);
      if (!(await fs.pathExists(abs))) {
        resolved = true;
        break;
      }
    }
    if (!resolved) {
      finalName = `${name}-${Date.now().toString(36)}`;
      abs = path.join(root, finalName);
    }
  }

  const createdParents: string[] = [];
  if (!(await fs.pathExists(root))) {
    await fs.ensureDir(root);
    createdParents.push(root);
  }

  return { absPath: abs, createdParents };
}
