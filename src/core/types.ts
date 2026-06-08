// Shared types for the `new` command flow (Phase A–E).

export type UiKind = "web" | "browser-ext" | "desktop" | "cli";
export type DataKind = "local" | "db" | "none";
export type UsersKind = "single" | "multi";

export interface Answers {
  ui: UiKind;
  data: DataKind;
  users: UsersKind;
  aiInvolved: boolean;
}

export type ArchId =
  | "web-spa"
  | "web-fullstack"
  | "browser-ext"
  | "python-ai"
  | "node-cli"
  | "generic";

/** A single scaffolding step as defined in architectures.json. */
export type InitStep =
  | { type: "exec"; cmd: string; stdin?: string; cwd?: string; timeout_ms?: number; skip_if_exists?: string }
  | { type: "write"; file: string; template?: string; content?: string; mode?: number }
  | { type: "patch"; file: string; patches: Array<{ set: string; value: unknown }> }
  | { type: "mkdir"; path: string };

export interface ArchitectureDef {
  id: ArchId;
  display_name: string;
  description: string;
  examples?: string[];
  stack: Record<string, string>;
  init_steps: InitStep[];
  gitignore_additions: string[];
  test_command: string;
  build_command: string;
  dev_command: string;
  lint_command: string;
  agents_md_rules: string[];
  agents_md_done_criteria: string[];
  next_steps_hints: string[];
}

export interface TemplateContext {
  idea: string;
  slug: string;
  date: string;
  user: { name?: string; email?: string };
  architecture: ArchitectureDef;
  answers: Answers;
}
