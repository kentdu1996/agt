#!/usr/bin/env node
import { Command } from "commander";
import { t } from "./i18n/index.js";
import { logger } from "./ui/logger.js";

import { initCommand } from "./commands/init.js";
import { newCommand } from "./commands/new.js";
import { doctorCommand } from "./commands/doctor.js";
import { rollbackCommand } from "./commands/rollback.js";
import { fixCommand } from "./commands/fix.js";
import { hooksCommand } from "./commands/hooks.js";
import { allowCommand } from "./commands/allow.js";
import { scanCommand } from "./commands/scan.js";

const VERSION = "2.0.0";

const program = new Command();

program
  .name("agt")
  .description(t.cli.description)
  .version(VERSION, "-v, --version")
  .option("--debug", "show full stack traces on error");

program
  .command("new")
  .argument("<idea>", "one-line idea, e.g. \"a B站 history manager\"")
  .option("--here", "create in the current directory instead of ~/AI-Projects")
  .option("--name <slug>", "override the auto-generated project name")
  .option("--arch <id>", "force an architecture (web-spa|web-fullstack|browser-ext|python-ai|node-cli|generic)")
  .option("--yes", "use all defaults, no prompts")
  .option("--dry-run", "show what would happen without creating files")
  .description("Bootstrap an AI-friendly project from a one-liner idea")
  .action((idea, opts) => run(() => newCommand(idea, opts)));

program
  .command("init")
  .argument("[dir]", "target directory", ".")
  .option("--yes", "skip interactive prompts and use defaults")
  .option("--template <name>", "preset template: web-app | api | cli | library | generic")
  .description("Add AgentGuard to an EXISTING project")
  .action((dir, opts) => run(() => initCommand(dir, opts)));

program
  .command("doctor")
  .description("Run a project health check")
  .action(() => run(() => doctorCommand()));

program
  .command("rollback")
  .option("--list", "only list checkpoints, do not roll back")
  .option("--id <id>", "roll back to a specific checkpoint id without prompting")
  .option("--gc", "garbage-collect old checkpoints")
  .description("Roll back to an auto-checkpoint")
  .action((opts) => run(() => rollbackCommand(opts)));

program
  .command("fix")
  .option("--secrets", "auto-redact detected secrets")
  .description("Auto-fix detected issues")
  .action((opts) => run(() => fixCommand(opts)));

const hooks = program.command("hooks").description("Manage agent hooks");
hooks
  .command("install")
  .description("Install AgentGuard hooks into this project")
  .action(() => run(() => hooksCommand("install")));
hooks
  .command("uninstall")
  .description("Remove AgentGuard hooks from this project")
  .action(() => run(() => hooksCommand("uninstall")));

program
  .command("allow")
  .argument("<pattern>", "command pattern to allowlist")
  .description("Add a command to the allowlist")
  .action((pattern) => run(() => allowCommand(pattern)));

program
  .command("scan")
  .argument("[path]", "path to scan", ".")
  .description("Scan for hardcoded secrets")
  .action((path) => run(() => scanCommand(path)));

async function run(fn: () => unknown | Promise<unknown>): Promise<void> {
  const debug = program.opts().debug as boolean | undefined;
  try {
    await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(message);
    if (debug && err instanceof Error && err.stack) {
      logger.dim(err.stack);
    }
    logger.dim(t.common.issuesHint);
    process.exitCode = 1;
  }
}

program.parseAsync(process.argv);
