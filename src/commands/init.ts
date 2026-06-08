import path from "node:path";
import { logger, chalk } from "../ui/logger.js";
import { spinner } from "../ui/spinner.js";
import { askInitQuestions, confirm } from "../ui/prompts.js";
import { t } from "../i18n/index.js";
import { fs, linkOrCopy, writeIfAbsent, appendMissingLines } from "../utils/fs.js";
import { getGit, isGitRepo } from "../utils/git.js";
import { templatePath } from "../utils/paths.js";
import { detectProject, type ProjectType } from "../core/project-detector.js";
import { serializeDangerPatterns } from "../core/danger-patterns.js";
import { serializeSecretPatterns } from "../core/secret-patterns.js";
import { installClaudeHooks, installGitPreCommit } from "../core/hooks-installer.js";
import boxen from "boxen";

export interface InitOptions {
  yes?: boolean;
  template?: string;
}

const VERSION = "0.1.0";
const DEFAULT_PROTECTED = "node_modules, .git, dist, build, .env*, *.key, *.pem";

interface Config {
  version: string;
  projectType: ProjectType | string;
  agents: string[];
  protectedPaths: string;
  testCommand: string;
  strictness: string;
  createdAt: string;
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_m, key) => (key in vars ? vars[key] : `{{${key}}}`));
}

export async function initCommand(dir: string, opts: InitOptions): Promise<void> {
  const targetDir = path.resolve(process.cwd(), dir || ".");

  // a) Check target directory.
  const exists = await fs.pathExists(targetDir);
  if (!exists) {
    await fs.ensureDir(targetDir);
  } else {
    const entries = (await fs.readdir(targetDir)).filter(
      (e) => e !== ".git" && e !== ".DS_Store",
    );
    if (entries.length > 0 && !opts.yes) {
      const ok = await confirm(t.init.dirNotEmptyPrompt, false);
      if (!ok) {
        logger.warn(t.init.aborted);
        return;
      }
    }
  }

  // b) Detect project type + commands.
  const detected = await detectProject(targetDir);

  // d) Interactive questions (or defaults with --yes).
  let answers;
  if (opts.yes) {
    answers = {
      projectType: detected.type,
      agents: ["claude", "cursor", "codex", "trae", "cline"],
      protectedPaths: DEFAULT_PROTECTED,
      testCommand: detected.testCommand,
      strictness: "balanced" as const,
    };
  } else {
    answers = await askInitQuestions(
      {
        projectType: detected.type,
        testCommand: detected.testCommand,
        protectedPaths: DEFAULT_PROTECTED,
      },
      {
        qType: t.init.qType,
        qAgents: t.init.qAgents,
        qProtected: t.init.qProtected,
        qTest: t.init.qTest,
        qStrictness: t.init.qStrictness,
      },
    );
  }

  const sp = spinner(t.init.creating).start();

  const projectName = path.basename(targetDir);
  const today = new Date().toISOString().slice(0, 10);

  // e) Render AGENTS.md.
  const agentsTpl = await fs.readFile(templatePath("AGENTS.md.tpl"), "utf8");
  const riskAreas =
    answers.strictness === "strict"
      ? "- Any change to auth, payments, database schema, or deployment config\n- Any file deletion\n- Any new dependency"
      : answers.strictness === "relaxed"
        ? "- Production deployment config"
        : "- Authentication / authorization code\n- Payment / billing code\n- Database schema / migrations\n- Deployment configuration";
  const agentsContent = renderTemplate(agentsTpl, {
    projectName,
    projectType: String(answers.projectType),
    techStack: detected.techStack,
    testCommand: answers.testCommand || "(none configured)",
    buildCommand: detected.buildCommand || "(none configured)",
    lintCommand: detected.lintCommand || "(none configured)",
    projectRoot: projectName,
    protectedPaths: answers.protectedPaths,
    projectStructure: `${projectName}/\n├── AGENTS.md\n├── .agentguard/\n└── docs/`,
    riskAreas,
    version: VERSION,
    date: today,
    lastEdited: today,
  });
  const agentsPath = path.join(targetDir, "AGENTS.md");
  await fs.writeFile(agentsPath, agentsContent, "utf8");

  // .gitignore (append/merge mode).
  const gitignoreTpl = await fs.readFile(templatePath("gitignore.tpl"), "utf8");
  await appendMissingLines(path.join(targetDir, ".gitignore"), gitignoreTpl);

  // .env.example (don't overwrite).
  const envTpl = await fs.readFile(templatePath("env-example.tpl"), "utf8");
  await writeIfAbsent(path.join(targetDir, ".env.example"), envTpl);

  // .agentguard/ structure.
  const agDir = path.join(targetDir, ".agentguard");
  await fs.ensureDir(path.join(agDir, "hooks"));
  await fs.ensureDir(path.join(agDir, "checkpoints"));

  const config: Config = {
    version: VERSION,
    projectType: answers.projectType,
    agents: answers.agents,
    protectedPaths: answers.protectedPaths,
    testCommand: answers.testCommand,
    strictness: answers.strictness,
    createdAt: new Date().toISOString(),
  };
  await fs.writeJson(path.join(agDir, "config.json"), config, { spaces: 2 });

  // Serialize patterns for the hook scripts to consume.
  await fs.writeJson(path.join(agDir, "danger-patterns.json"), serializeDangerPatterns(), {
    spaces: 2,
  });
  await fs.writeJson(path.join(agDir, "secret-patterns.json"), serializeSecretPatterns(), {
    spaces: 2,
  });

  // Copy hook scripts (strip .tpl).
  const hookFiles = [
    "pre-bash.js",
    "pre-read.js",
    "pre-write.js",
    "pre-tool-use.js",
    "pre-commit.js",
  ];
  for (const h of hookFiles) {
    const content = await fs.readFile(templatePath("hooks", `${h}.tpl`), "utf8");
    const dest = path.join(agDir, "hooks", h);
    await fs.writeFile(dest, content, "utf8");
    await fs.chmod(dest, 0o755);
  }

  // allowlist.txt (empty placeholder).
  await writeIfAbsent(
    path.join(agDir, "allowlist.txt"),
    "# AgentGuard allowlist — one exact command per line. Lines starting with # are ignored.\n",
  );

  // docs/
  const docsDir = path.join(targetDir, "docs");
  const stateTpl = await fs.readFile(templatePath("PROJECT_STATE.md.tpl"), "utf8");
  const decisionTpl = await fs.readFile(templatePath("DECISION_LOG.md.tpl"), "utf8");
  await writeIfAbsent(
    path.join(docsDir, "PROJECT_STATE.md"),
    renderTemplate(stateTpl, { date: today }),
  );
  await writeIfAbsent(
    path.join(docsDir, "DECISION_LOG.md"),
    renderTemplate(decisionTpl, { date: today }),
  );

  // f) Symlinks (copy fallback). Map agent -> rule file location.
  const linkTargets: Array<[string, string]> = [
    ["claude", "CLAUDE.md"],
    ["cursor", ".cursorrules"],
    ["cline", ".clinerules"],
    ["trae", path.join(".trae", "rules.md")],
  ];
  for (const [agent, rel] of linkTargets) {
    if (answers.agents.includes(agent) || answers.agents.length === 0) {
      await linkOrCopy(agentsPath, path.join(targetDir, rel));
    }
  }
  // Codex uses AGENTS.md natively; no extra file needed.

  sp.succeed(t.init.creating);

  // g) Git init + first commit.
  const gitSp = spinner(t.init.gitInit).start();
  const git = getGit(targetDir);
  const alreadyRepo = await isGitRepo(targetDir);
  try {
    if (!alreadyRepo) {
      await git.init();
    }
    await git.add(".");
    await git.commit("chore: initialize AgentGuard");
    gitSp.succeed(t.init.gitInit);
  } catch (err) {
    gitSp.warn(t.init.gitInit + " (skipped: " + (err instanceof Error ? err.message : "error") + ")");
  }

  // h) Install hooks.
  const hookSp = spinner(t.init.installingHooks).start();
  if (answers.agents.includes("claude") || answers.agents.length === 0) {
    await installClaudeHooks(targetDir);
  }
  await installGitPreCommit(targetDir);
  hookSp.succeed(t.init.installingHooks);

  // i) Next steps.
  const agentNames = answers.agents.length
    ? answers.agents.join(", ")
    : "all";
  const summary = [
    chalk.bold.green(`✨ ${t.init.done}`),
    "",
    `${chalk.bold("📁 Project:")} ${projectName}`,
    `${chalk.bold("🤖 Agents:")}  ${agentNames}`,
    `${chalk.bold("🛡️  Hooks:")}   installed`,
    "",
    chalk.bold("What's next:"),
    "",
    "1. Open this project in your AI coding tool",
    "2. Ask the agent to do something risky like:",
    chalk.gray('   "delete all files in this directory"'),
    chalk.gray("   → AgentGuard will block it"),
    "3. Read the rules:        " + chalk.cyan("cat AGENTS.md"),
    "4. Check project health:  " + chalk.cyan("agt doctor"),
  ].join("\n");
  logger.blank();
  logger.raw(
    boxen(summary, {
      padding: 1,
      borderColor: "green",
      borderStyle: "round",
    }),
  );
  logger.dim(t.common.issuesHint);
}
