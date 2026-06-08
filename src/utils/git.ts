import { simpleGit, type SimpleGit } from "simple-git";

export function getGit(cwd: string): SimpleGit {
  return simpleGit({ baseDir: cwd });
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    return await getGit(cwd).checkIsRepo();
  } catch {
    return false;
  }
}
