import fs from "fs-extra";
import sceneRulesData from "../data/scene-rules.json" with { type: "json" };
import { dataPath } from "../utils/paths.js";
import type { TemplateContext } from "./types.js";

interface SceneRule {
  keywords: string[];
  rules: string[];
}
const SCENE_RULES = (sceneRulesData as { scenes: SceneRule[] }).scenes;

const VERSION = "2.0.0";
const MAX_LINES = 250;
const MAX_SCENE_RULES = 10;

function titleCase(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function targetUserLabel(users: string): string {
  return users === "multi" ? "Multiple users (with login)" : "Single user (personal)";
}

function dataStrategyLabel(data: string): string {
  switch (data) {
    case "db":
      return "Cloud database";
    case "local":
      return "Browser/local storage";
    default:
      return "No persistence";
  }
}

const CJK = /[\u3400-\u9fff]/;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Match a keyword against the idea: CJK is whitespace-tolerant; ASCII uses word boundaries. */
function keywordHit(idea: string, keyword: string): boolean {
  const lowerIdea = idea.toLowerCase();
  const k = keyword.toLowerCase();
  if (CJK.test(k)) {
    const pattern = k.split("").map(escapeRegExp).join("\\s*");
    return new RegExp(pattern).test(lowerIdea);
  }
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(k)}([^a-z0-9]|$)`).test(lowerIdea);
}

/** Collect scene-specific NEVER rules whose keywords appear in the idea. */
export function matchSceneRules(idea: string): string[] {
  const collected: string[] = [];
  const seen = new Set<string>();
  for (const scene of SCENE_RULES) {
    if (scene.keywords.some((k) => keywordHit(idea, k))) {
      for (const rule of scene.rules) {
        if (!seen.has(rule)) {
          seen.add(rule);
          collected.push(rule);
        }
      }
    }
  }
  return collected;
}

function numberedList(items: string[], startAt = 1): string {
  if (items.length === 0) return "";
  return items.map((item, i) => `${startAt + i}. ${item}`).join("\n");
}

function bulletList(items: string[]): string {
  return items.map((item) => `- [ ] ${item}`).join("\n");
}

export interface BuiltSections {
  universalNever: string;
  archNever: string;
  sceneNever: string;
  archDoneCriteria: string;
  stackList: string;
}

/** Build each AGENTS.md section independently (used by tests + build). */
export function previewSections(ctx: TemplateContext): BuiltSections {
  const { architecture, idea } = ctx;

  const universalRaw = fs
    .readFileSync(dataPath("templates", "universal-never.md"), "utf8")
    .trim()
    // The universal-never.md file already numbers 1..13; keep as-is but inject projectRoot.
    .replace(/\{\{projectRoot\}\}/g, ctx.slug);

  const archNever = numberedList(architecture.agents_md_rules, 14);

  let sceneRules = matchSceneRules(idea);
  if (sceneRules.length > MAX_SCENE_RULES) sceneRules = sceneRules.slice(0, MAX_SCENE_RULES);
  const sceneNever =
    sceneRules.length > 0
      ? numberedList(sceneRules, 14 + architecture.agents_md_rules.length)
      : "_本项目暂无场景相关额外约束。 / No scene-specific constraints for this project._";

  const archDoneCriteria = bulletList(architecture.agents_md_done_criteria);

  const stackList = Object.entries(architecture.stack)
    .map(([k, v]) => `- **${titleCase(k.replace(/_/g, "-"))}**: ${v}`)
    .join("\n");

  return { universalNever: universalRaw, archNever, sceneNever, archDoneCriteria, stackList };
}

/** Render the full AGENTS.md content (string), enforcing the 250-line cap. */
export function build(ctx: TemplateContext): string {
  const { architecture, idea, answers, slug, date } = ctx;
  const sections = previewSections(ctx);

  const tpl = fs.readFileSync(dataPath("templates", "AGENTS.md.tpl"), "utf8");

  const projectStructure = `${slug}/\n├── AGENTS.md\n├── .agentguard/\n├── docs/\n└── ...`;

  const vars: Record<string, string> = {
    productName: titleCase(slug),
    oneLiner: idea.length > 80 ? idea.slice(0, 77) + "..." : idea,
    ideaExpanded: idea,
    date,
    targetUser: targetUserLabel(answers.users),
    dataStrategy: dataStrategyLabel(answers.data),
    stackList: sections.stackList,
    devCommand: architecture.dev_command || "(none)",
    testCommand: architecture.test_command || "(none)",
    buildCommand: architecture.build_command || "(none)",
    lintCommand: architecture.lint_command || "(none)",
    universalNever: sections.universalNever,
    archDisplayName: architecture.display_name,
    archNever: sections.archNever,
    sceneNever: sections.sceneNever,
    archDoneCriteria: sections.archDoneCriteria,
    projectStructure,
    version: VERSION,
    archId: architecture.id,
    stackFramework: architecture.stack.framework || architecture.stack.language || architecture.id,
  };

  let out = tpl.replace(/\{\{(\w+)\}\}/g, (_m, key) => (key in vars ? vars[key] : `{{${key}}}`));

  // Post-process: collapse 3+ blank lines.
  out = out.replace(/\n{3,}/g, "\n\n");

  // Enforce hard line cap (defensive — should rarely trigger given MAX_SCENE_RULES).
  const lines = out.split("\n");
  if (lines.length > MAX_LINES) {
    out = lines.slice(0, MAX_LINES).join("\n") + "\n";
  }
  return out;
}
