import inquirer from "inquirer";

export interface InitAnswers {
  projectType: string;
  agents: string[];
  protectedPaths: string;
  testCommand: string;
  strictness: "strict" | "balanced" | "relaxed";
}

export interface InitDefaults {
  projectType: string;
  testCommand: string;
  protectedPaths: string;
}

export async function askInitQuestions(
  defaults: InitDefaults,
  labels: {
    qType: string;
    qAgents: string;
    qProtected: string;
    qTest: string;
    qStrictness: string;
  },
): Promise<InitAnswers> {
  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "projectType",
      message: labels.qType,
      choices: ["node", "python", "go", "rust", "generic"],
      default: defaults.projectType,
    },
    {
      type: "checkbox",
      name: "agents",
      message: labels.qAgents,
      choices: [
        { name: "Claude Code", value: "claude", checked: true },
        { name: "Cursor", value: "cursor", checked: true },
        { name: "Codex", value: "codex", checked: true },
        { name: "Trae", value: "trae", checked: true },
        { name: "Cline", value: "cline", checked: true },
      ],
    },
    {
      type: "input",
      name: "protectedPaths",
      message: labels.qProtected,
      default: defaults.protectedPaths,
    },
    {
      type: "input",
      name: "testCommand",
      message: labels.qTest,
      default: defaults.testCommand,
    },
    {
      type: "list",
      name: "strictness",
      message: labels.qStrictness,
      choices: ["strict", "balanced", "relaxed"],
      default: "balanced",
    },
  ]);
  return answers as InitAnswers;
}

export async function confirm(message: string, defaultValue = false): Promise<boolean> {
  const { ok } = await inquirer.prompt([
    { type: "confirm", name: "ok", message, default: defaultValue },
  ]);
  return ok as boolean;
}

export { inquirer };
