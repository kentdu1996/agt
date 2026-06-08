import path from "node:path";
import fs from "fs-extra";
import boxen from "boxen";
import { confirm } from "@inquirer/prompts";
import { logger, chalk } from "../ui/logger.js";
import { spinner } from "../ui/spinner.js";
import { generateSlug } from "../core/slug.js";
import { resolveProjectPath } from "../core/location.js";
import { ask } from "../core/questionnaire.js";
import { route } from "../core/architecture-router.js";
import { execute, renderTemplateFile, linkRuleFiles } from "../core/scaffolder.js";
import { build as buildAgentsMd } from "../core/agents-md-builder.js";
import { installDefenseBundle } from "../core/defense-bundle.js";
import { appendMissingLines } from "../utils/fs.js";
import { getGit, isGitRepo } from "../utils/git.js";
import type { TemplateContext } from "../core/types.js";

export interface NewOptions {
  here?: boolean;
  name?: string;
  arch?: string;
  yes?: boolean;
  dryRun?: boolean;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getGitUser(): Promise<{ name?: string; email?: string }> {
  try {
    const git = getGit(process.cwd());
    const name = (await git.getConfig("user.name")).value ?? undefined;
    const email = (await git.getConfig("user.email")).value ?? undefined;
    return { name: name || undefined, email: email || undefined };
  } catch {
    return {};
  }
}

export async function newCommand(idea: string, opts: NewOptions): Promise<void> {
  if (!idea || !idea.trim()) {
    logger.error('Please describe your idea, e.g. agt new "a pomodoro timer web app"');
    process.exitCode = 1;
    return;
  }

  // 1. Parse idea -> slug
  const slug = generateSlug(idea, opts.name);
  logger.success(`Project name: ${chalk.cyan(slug)}`);

  // 2. Decide location (asks for projects root once on first run)
  const { absPath } = await resolveProjectPath({
    slug,
    here: opts.here,
    customName: opts.name,
    assumeYes: opts.yes,
  });
  logger.success(`Location: ${chalk.cyan(absPath)}`);

  // 3. Questionnaire
  const answers = await ask(idea, { yes: opts.yes, archOverride: opts.arch });

  // 4. Route architecture
  const arch = route(answers, idea, opts.arch);
  logger.success(`Selected scaffold: ${chalk.cyan(arch.display_name)} (${arch.id})`);

  // 4.5 Final confirmation (unless --yes)
  if (!opts.yes) {
    const ok = await confirm({
      message: `Create a ${arch.display_name} project at ${absPath}?`,
      default: true,
    });
    if (!ok) {
      logger.warn("Cancelled.");
      return;
    }
  }

  const ctx: TemplateContext = {
    idea,
    slug,
    date: today(),
    user: await getGitUser(),
    architecture: arch,
    answers,
  };

  // 5 + 6. Create dir + run scaffold
  await fs.ensureDir(absPath);
  const sp = spinner(`Installing ${arch.display_name} (first run may take 1–3 min)...`).start();
  try {
    await execute(arch.init_steps, absPath, ctx, {
      dryRun: opts.dryRun,
      onStep: (msg) => {
        sp.text = msg;
      },
    });
    sp.succeed("Scaffold ready");
  } catch (err) {
    sp.fail("Scaffold failed");
    throw err;
  }

  // 7. Write AgentGuard config layer
  const wSp = spinner("Generating AGENTS.md and rule files...").start();
  if (!opts.dryRun) {
    const agentsMd = buildAgentsMd(ctx);
    await fs.writeFile(path.join(absPath, "AGENTS.md"), agentsMd, "utf8");
    await linkRuleFiles(absPath);

    await renderTemplateFile("IDEA.md.tpl", path.join(absPath, "docs", "IDEA.md"), ctx);
    await renderTemplateFile(
      "DECISION_LOG.md.tpl",
      path.join(absPath, "docs", "DECISION_LOG.md"),
      ctx,
    );
    await renderTemplateFile(
      "PROJECT_STATE.md.tpl",
      path.join(absPath, "docs", "PROJECT_STATE.md"),
      ctx,
    );

    // Merge gitignore additions.
    await appendMissingLines(
      path.join(absPath, ".gitignore"),
      arch.gitignore_additions.join("\n") + "\n",
    );
  }
  wSp.succeed("Rule files written");

  // 8. Defense + git
  const dSp = spinner("Installing defense hooks...").start();
  if (!opts.dryRun) {
    await installDefenseBundle(absPath, {
      strictness: "balanced",
      configExtra: {
        architecture: arch.id,
        slug,
        idea,
        createdBy: "new",
      },
    });
  }
  dSp.succeed("Hooks installed");

  const gSp = spinner("Initializing git...").start();
  if (!opts.dryRun) {
    try {
      const git = getGit(absPath);
      if (!(await isGitRepo(absPath))) await git.init();
      await git.add(".");
      await git.commit("chore: bootstrap with AgentGuard");
      gSp.succeed("First commit created");
    } catch (err) {
      gSp.warn("git skipped: " + (err instanceof Error ? err.message : "error"));
    }
  } else {
    gSp.succeed("git (skipped in dry-run)");
  }

  // 9. Next steps
  printNextSteps(absPath, arch, answers);
}

function printNextSteps(
  absPath: string,
  arch: TemplateContext["architecture"],
  answers: TemplateContext["answers"],
): void {
  const stackLine = Object.values(arch.stack).slice(0, 4).join(" + ");
  const lines = [
    chalk.bold.green("✨ Done! Your project is ready."),
    "",
    `${chalk.bold("📁 Path:")}  ${absPath}`,
    `${chalk.bold("🧱 Stack:")} ${stackLine}`,
    `${chalk.bold("🛡️  Guard:")} dangerous-command / secrets / checkpoint / pre-commit`,
    "",
    chalk.bold("Next steps:"),
    `  cd ${absPath}`,
    "  cursor .            " + chalk.gray("# or: claude / trae"),
    '  Tell your AI: "Read AGENTS.md, then start building."',
    "",
    chalk.bold("Anytime:"),
    "  agt doctor    " + chalk.gray("# health check"),
    "  agt rollback  " + chalk.gray("# undo an agent's change"),
    "  agt scan      " + chalk.gray("# scan for secrets"),
  ];
  if (arch.next_steps_hints?.length) {
    lines.push("", chalk.bold("Architecture tips:"));
    for (const hint of arch.next_steps_hints) lines.push("  • " + hint);
  }
  logger.blank();
  logger.raw(boxen(lines.join("\n"), { padding: 1, borderColor: "green", borderStyle: "round" }));
}
