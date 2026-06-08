// English strings. Default locale.
export const en = {
  cli: {
    description: "One-liner to bootstrap an AI-friendly project — with built-in guardrails.",
  },
  common: {
    issuesHint: "Issues? https://github.com/kentdu1996/agt/issues",
  },
  init: {
    todo: "TODO: init",
    dirNotEmptyPrompt:
      "Directory already has content. Continue writing rule files? (existing files will NOT be deleted)",
    aborted: "Aborted.",
    qType: "Project type?",
    qAgents: "Which AI agents do you use?",
    qProtected: "Which directories/files should agents NEVER modify?",
    qTest: "Test command?",
    qStrictness: "Rule strictness?",
    creating: "Creating AgentGuard files...",
    gitInit: "Initializing git repository...",
    installingHooks: "Installing agent hooks...",
    done: "AgentGuard initialized!",
  },
  doctor: { todo: "TODO: doctor" },
  rollback: { todo: "TODO: rollback" },
  fix: { todo: "TODO: fix" },
  hooks: { todo: "TODO: hooks" },
  allow: { todo: "TODO: allow" },
  scan: { todo: "TODO: scan" },
};

export type Messages = typeof en;
