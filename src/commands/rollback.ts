import path from "node:path";
import { logger, chalk } from "../ui/logger.js";
import { inquirer, confirm } from "../ui/prompts.js";
import { fs } from "../utils/fs.js";
import {
  listCheckpoints,
  rollbackTo,
  gcOldCheckpoints,
  type Checkpoint,
} from "../core/checkpoint.js";

export interface RollbackOptions {
  list?: boolean;
  id?: string;
  gc?: boolean;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString();
}

function describe(cp: Checkpoint): string {
  const action = cp.action ? cp.action.slice(0, 60) : "(working tree snapshot)";
  return `${chalk.gray(fmtTime(cp.timestamp))}  ${chalk.cyan(cp.tool)}: ${action}`;
}

export async function rollbackCommand(opts: RollbackOptions): Promise<void> {
  const root = process.cwd();
  if (!(await fs.pathExists(path.join(root, ".agentguard")))) {
    logger.error("Not an AgentGuard project (no .agentguard/). Run `agt init` first.");
    process.exitCode = 1;
    return;
  }

  if (opts.gc) {
    const removed = await gcOldCheckpoints(root);
    logger.success(`Garbage-collected ${removed} old checkpoint${removed === 1 ? "" : "s"}.`);
    return;
  }

  const checkpoints = await listCheckpoints(root);
  if (checkpoints.length === 0) {
    logger.info("No checkpoints yet. They are created automatically before agents act.");
    return;
  }

  if (opts.list) {
    logger.title("Recent checkpoints:");
    checkpoints.slice(0, 50).forEach((cp, i) => {
      logger.raw(` ${chalk.bold(`[${i + 1}]`)} ${describe(cp)}  ${chalk.gray(cp.id)}`);
    });
    return;
  }

  let target: Checkpoint | undefined;
  if (opts.id) {
    target = checkpoints.find((c) => c.id === opts.id);
    if (!target) {
      logger.error(`Checkpoint not found: ${opts.id}`);
      process.exitCode = 1;
      return;
    }
  } else {
    const recent = checkpoints.slice(0, 10);
    const { choice } = await inquirer.prompt([
      {
        type: "list",
        name: "choice",
        message: "Roll back to which checkpoint?",
        choices: [
          ...recent.map((cp, i) => ({ name: `[${i + 1}] ${describe(cp)}`, value: cp.id })),
          new inquirer.Separator(),
          { name: "Cancel", value: "__cancel__" },
        ],
      },
    ]);
    if (choice === "__cancel__") {
      logger.info("Cancelled.");
      return;
    }
    target = checkpoints.find((c) => c.id === choice);
  }

  if (!target) return;

  logger.blank();
  logger.warn(`This will restore your working tree to: ${describe(target)}`);
  logger.dim("Your current uncommitted changes may be overwritten. Git history is NOT changed.");
  const ok = await confirm("Proceed with rollback?", false);
  if (!ok) {
    logger.info("Cancelled.");
    return;
  }

  await rollbackTo(root, target.id);
  logger.success(`Rolled back to ${target.id}.`);
}
