import path from "node:path";
import fs from "fs-extra";
import { getGit, isGitRepo } from "../utils/git.js";

export interface CheckpointMeta {
  tool: string;
  action: string;
}

export interface Checkpoint {
  id: string;
  sha: string;
  tool: string;
  action: string;
  timestamp: number;
}

function cpDir(root: string): string {
  return path.join(root, ".agentguard", "checkpoints");
}

/**
 * Create a lightweight checkpoint of the current working tree without polluting
 * the main git log. Uses `git stash create` (snapshot blob) + a ref under
 * refs/agentguard/. Returns the checkpoint id, or null if nothing to snapshot.
 */
export async function createCheckpoint(
  root: string,
  meta: CheckpointMeta,
): Promise<string | null> {
  if (!(await isGitRepo(root))) return null;
  const git = getGit(root);
  const sha = (await git.raw(["stash", "create"])).trim();
  if (!sha) return null; // clean tree, nothing to snapshot
  const id = `cp-${Date.now()}`;
  await git.raw(["update-ref", `refs/agentguard/${id}`, sha]);

  await fs.ensureDir(cpDir(root));
  const data: Checkpoint = { id, sha, tool: meta.tool, action: meta.action, timestamp: Date.now() };
  await fs.writeJson(path.join(cpDir(root), `${id}.json`), data, { spaces: 2 });
  return id;
}

export async function listCheckpoints(root: string): Promise<Checkpoint[]> {
  const dir = cpDir(root);
  if (!(await fs.pathExists(dir))) return [];
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  const items: Checkpoint[] = [];
  for (const f of files) {
    try {
      items.push(await fs.readJson(path.join(dir, f)));
    } catch {
      /* skip corrupt */
    }
  }
  return items.sort((a, b) => b.timestamp - a.timestamp);
}

export async function readCheckpoint(root: string, id: string): Promise<Checkpoint | null> {
  const p = path.join(cpDir(root), `${id}.json`);
  if (!(await fs.pathExists(p))) return null;
  try {
    return await fs.readJson(p);
  } catch {
    return null;
  }
}

/**
 * Roll back the working tree to a checkpoint by applying its stash blob.
 * Does NOT touch the main branch history.
 */
export async function rollbackTo(root: string, id: string): Promise<void> {
  const cp = await readCheckpoint(root, id);
  if (!cp) throw new Error(`Checkpoint not found: ${id}`);
  const git = getGit(root);
  // Restore tracked files to the snapshot state. `checkout <sha> -- .` overwrites
  // the working tree from the snapshot commit without touching branch history,
  // and works even when there are conflicting local modifications.
  await git.raw(["checkout", cp.sha, "--", "."]);
}

/**
 * Garbage-collect old checkpoints: keep the most recent `keep` (default 50)
 * AND anything newer than `maxAgeDays` (default 7). Everything else is removed.
 */
export async function gcOldCheckpoints(
  root: string,
  keep = 50,
  maxAgeDays = 7,
): Promise<number> {
  const all = await listCheckpoints(root);
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const git = (await isGitRepo(root)) ? getGit(root) : null;
  let removed = 0;

  for (let i = 0; i < all.length; i++) {
    const cp = all[i];
    const tooOld = cp.timestamp < cutoff;
    const beyondKeep = i >= keep;
    if (tooOld && beyondKeep) {
      try {
        if (git) await git.raw(["update-ref", "-d", `refs/agentguard/${cp.id}`]);
      } catch {
        /* ref may already be gone */
      }
      await fs.remove(path.join(cpDir(root), `${cp.id}.json`));
      removed++;
    }
  }
  if (git && removed > 0) {
    try {
      await git.raw(["gc", "--prune=now", "--quiet"]);
    } catch {
      /* non-fatal */
    }
  }
  return removed;
}
