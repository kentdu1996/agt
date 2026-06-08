import fs from "fs-extra";
import path from "node:path";
import { execa } from "execa";
import Handlebars from "handlebars";
import { dataPath } from "../utils/paths.js";
import { linkOrCopy } from "../utils/fs.js";
import type { InitStep, TemplateContext } from "./types.js";

export interface ScaffoldOptions {
  dryRun?: boolean;
  onStep?: (msg: string) => void;
  timeoutMs?: number;
}

function renderString(tpl: string, ctx: TemplateContext): string {
  // Provide a flat, predictable variable surface for templates.
  const view = {
    idea: ctx.idea,
    slug: ctx.slug,
    date: ctx.date,
    user: ctx.user,
    stack: ctx.architecture.stack,
    architecture: ctx.architecture,
    answers: ctx.answers,
  };
  return Handlebars.compile(tpl, { noEscape: true })(view);
}

/** Set a possibly-dotted key path on an object, rendering {{slug}} in keys/values. */
function applyPatch(obj: any, setPath: string, value: unknown, ctx: TemplateContext): void {
  const rendered = (v: unknown): unknown => {
    if (typeof v === "string") return renderString(v, ctx);
    if (v && typeof v === "object") {
      const out: any = Array.isArray(v) ? [] : {};
      for (const [k, val] of Object.entries(v)) {
        out[renderString(k, ctx)] = rendered(val);
      }
      return out;
    }
    return v;
  };
  const parts = setPath.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = rendered(value);
}

async function commandExists(bin: string): Promise<boolean> {
  try {
    await execa(process.platform === "win32" ? "where" : "which", [bin]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute a list of scaffolding steps inside `projectPath`.
 * On any failure the (partial) project dir is moved aside to
 * `<dir>.agentguard-failed-<ts>` and the error is rethrown.
 */
export async function execute(
  steps: InitStep[],
  projectPath: string,
  ctx: TemplateContext,
  opts: ScaffoldOptions = {},
): Promise<void> {
  const timeout = opts.timeoutMs ?? 5 * 60 * 1000;
  await fs.ensureDir(projectPath);

  try {
    for (const step of steps) {
      switch (step.type) {
        case "exec": {
          if (step.skip_if_exists && (await commandExists(step.skip_if_exists))) {
            opts.onStep?.(`skip (already installed): ${step.cmd}`);
            break;
          }
          opts.onStep?.(`$ ${step.cmd}`);
          if (opts.dryRun) break;
          await execa(step.cmd, {
            cwd: step.cwd ? path.resolve(projectPath, step.cwd) : projectPath,
            shell: true,
            stdio: step.stdin ? ["pipe", "inherit", "inherit"] : "inherit",
            input: step.stdin,
            timeout: step.timeout_ms ?? timeout,
          });
          break;
        }
        case "write": {
          opts.onStep?.(`write ${step.file}`);
          if (opts.dryRun) break;
          let content: string;
          if (step.template) {
            const tpl = await fs.readFile(dataPath("templates", step.template), "utf8");
            content = renderString(tpl, ctx);
          } else {
            content = renderString(step.content ?? "", ctx);
          }
          const dest = path.join(projectPath, step.file);
          await fs.ensureDir(path.dirname(dest));
          await fs.writeFile(dest, content, "utf8");
          if (step.mode) await fs.chmod(dest, step.mode);
          break;
        }
        case "patch": {
          opts.onStep?.(`patch ${step.file}`);
          if (opts.dryRun) break;
          const target = path.join(projectPath, step.file);
          const json = (await fs.pathExists(target)) ? await fs.readJson(target) : {};
          for (const p of step.patches) {
            applyPatch(json, p.set, p.value, ctx);
          }
          await fs.writeJson(target, json, { spaces: 2 });
          break;
        }
        case "mkdir": {
          opts.onStep?.(`mkdir ${step.path}`);
          if (opts.dryRun) break;
          await fs.ensureDir(path.join(projectPath, step.path));
          break;
        }
      }
    }
  } catch (err) {
    // Move the failed project aside so the user can inspect it.
    if (!opts.dryRun && (await fs.pathExists(projectPath))) {
      const failed = `${projectPath}.agentguard-failed-${Date.now()}`;
      try {
        await fs.move(projectPath, failed, { overwrite: false });
        opts.onStep?.(`Moved failed project to ${failed}`);
      } catch {
        /* best-effort */
      }
    }
    throw err;
  }
}

/** Render a standalone template file to a destination (for IDEA/DECISION_LOG/etc). */
export async function renderTemplateFile(
  templateRel: string,
  destAbs: string,
  ctx: TemplateContext,
): Promise<void> {
  const tpl = await fs.readFile(dataPath("templates", templateRel), "utf8");
  await fs.ensureDir(path.dirname(destAbs));
  await fs.writeFile(destAbs, renderString(tpl, ctx), "utf8");
}

/** Create symlinks (copy fallback) from each alias to AGENTS.md. */
export async function linkRuleFiles(projectPath: string): Promise<void> {
  const agentsPath = path.join(projectPath, "AGENTS.md");
  const aliases = ["CLAUDE.md", ".cursorrules", ".clinerules", path.join(".trae", "rules.md")];
  for (const alias of aliases) {
    await linkOrCopy(agentsPath, path.join(projectPath, alias));
  }
}
