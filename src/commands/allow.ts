import path from "node:path";
import { logger } from "../ui/logger.js";
import { fs } from "../utils/fs.js";

export async function allowCommand(pattern: string): Promise<void> {
  const allowlistPath = path.join(process.cwd(), ".agentguard", "allowlist.txt");
  if (!(await fs.pathExists(path.join(process.cwd(), ".agentguard")))) {
    logger.error("Not an AgentGuard project (no .agentguard/). Run `agt init` first.");
    process.exitCode = 1;
    return;
  }
  let content = "";
  if (await fs.pathExists(allowlistPath)) {
    content = await fs.readFile(allowlistPath, "utf8");
  }
  const existing = content.split(/\r?\n/).map((l) => l.trim());
  if (existing.includes(pattern.trim())) {
    logger.warn(`Already allowlisted: ${pattern}`);
    return;
  }
  const toWrite = (content.endsWith("\n") || content === "" ? content : content + "\n") + pattern.trim() + "\n";
  await fs.ensureDir(path.dirname(allowlistPath));
  await fs.writeFile(allowlistPath, toWrite, "utf8");
  logger.success(`Added to allowlist: ${pattern}`);
}
