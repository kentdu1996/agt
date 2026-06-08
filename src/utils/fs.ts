import fs from "fs-extra";
import path from "node:path";
import { isWindows } from "./platform.js";

/**
 * Create a symlink pointing to `target`. On Windows (or if symlink fails),
 * fall back to copying the file content.
 * `linkPath` and `target` are absolute paths. The symlink is created relative
 * to the link's directory so the project stays portable.
 */
export async function linkOrCopy(target: string, linkPath: string): Promise<"symlink" | "copy"> {
  // Don't clobber a real (non-link) user file.
  if (await fs.pathExists(linkPath)) {
    const stat = await fs.lstat(linkPath);
    if (!stat.isSymbolicLink()) {
      return "copy"; // leave existing real file untouched
    }
    await fs.remove(linkPath);
  }
  await fs.ensureDir(path.dirname(linkPath));

  if (isWindows()) {
    await fs.copyFile(target, linkPath);
    return "copy";
  }
  try {
    const rel = path.relative(path.dirname(linkPath), target);
    await fs.symlink(rel, linkPath);
    return "symlink";
  } catch {
    await fs.copyFile(target, linkPath);
    return "copy";
  }
}

/**
 * Write `content` to file unless it already exists (no overwrite).
 * Returns true if written, false if skipped.
 */
export async function writeIfAbsent(filePath: string, content: string): Promise<boolean> {
  if (await fs.pathExists(filePath)) return false;
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
  return true;
}

/**
 * Append content to an existing file (merging), or create it. Used for .gitignore.
 * Only appends lines that are not already present.
 */
export async function appendMissingLines(filePath: string, content: string): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  let existing = "";
  if (await fs.pathExists(filePath)) {
    existing = await fs.readFile(filePath, "utf8");
  }
  const existingLines = new Set(existing.split(/\r?\n/).map((l) => l.trim()));
  const toAdd = content
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.startsWith("#")) return true; // keep comments/blank for readability of new block only
      return !existingLines.has(trimmed);
    });

  if (existing.trim() === "") {
    await fs.writeFile(filePath, content.endsWith("\n") ? content : content + "\n", "utf8");
    return;
  }

  // Only append a block if there is at least one new non-comment line.
  const hasNew = toAdd.some((l) => {
    const t = l.trim();
    return t !== "" && !t.startsWith("#") && !existingLines.has(t);
  });
  if (!hasNew) return;

  const block =
    "\n# --- Added by AgentGuard ---\n" +
    content
      .split(/\r?\n/)
      .filter((line) => {
        const trimmed = line.trim();
        if (trimmed === "" || trimmed.startsWith("#")) return false;
        return !existingLines.has(trimmed);
      })
      .join("\n") +
    "\n";
  await fs.appendFile(filePath, block, "utf8");
}

export { fs };
