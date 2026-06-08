import { select } from "@inquirer/prompts";
import type { Answers, UiKind, DataKind, UsersKind } from "./types.js";

export interface AskOptions {
  yes?: boolean;
  archOverride?: string;
}

const AI_KEYWORDS = [
  "ai", "gpt", "llm", "claude", "gemini", "大模型", "翻译", "总结", "摘要",
  "chatbot", "聊天机器人", "rag", "openai", "anthropic",
];
const WEB_KEYWORDS = ["网页", "网站", "页面", "web", "site", "网址", "前端", "h5"];
const EXT_KEYWORDS = ["插件", "扩展", "extension", "chrome", "edge", "firefox", "浏览器扩展"];
const DESKTOP_KEYWORDS = ["桌面", "desktop", "客户端", "electron", "tauri", "exe", "安装包"];
const CLI_KEYWORDS = [
  "命令行", "cli", "脚本", "script", "终端", "terminal",
  "git", "生成器", "generator", "格式化", "转换", "重命名", "批处理", "命令",
];
const MULTI_KEYWORDS = ["登录", "注册", "账号", "多人", "共享", "team", "团队", "协作", "saas"];
const LOCAL_KEYWORDS = ["本地", "离线", "自己用", "单机", "local"];
const DATA_KEYWORDS = ["数据", "保存", "记录", "数据库", "存储", "db", "database"];

function hit(idea: string, words: string[]): boolean {
  const lower = idea.toLowerCase();
  return words.some((w) => lower.includes(w.toLowerCase()));
}

/** Infer best-guess answers from the idea text (no LLM). */
export function infer(idea: string): Answers {
  const aiInvolved = hit(idea, AI_KEYWORDS);

  let ui: UiKind;
  if (hit(idea, EXT_KEYWORDS)) ui = "browser-ext";
  else if (hit(idea, DESKTOP_KEYWORDS)) ui = "desktop";
  else if (hit(idea, CLI_KEYWORDS)) ui = "cli";
  else if (hit(idea, WEB_KEYWORDS)) ui = "web";
  else if (aiInvolved) ui = "cli"; // AI-first ideas default to a script
  else ui = "web";

  let users: UsersKind = hit(idea, MULTI_KEYWORDS) ? "multi" : "single";

  let data: DataKind;
  if (users === "multi") data = "db";
  else if (hit(idea, LOCAL_KEYWORDS)) data = "local";
  else if (hit(idea, DATA_KEYWORDS)) data = "local";
  else data = "local";

  return { ui, data, users, aiInvolved };
}

/**
 * Ask up to 3 questions (UI, data, users), pre-selecting keyword-inferred
 * defaults. Skips later questions when irrelevant. `--yes` / `archOverride`
 * skip prompting entirely.
 */
export async function ask(idea: string, opts: AskOptions = {}): Promise<Answers> {
  const inferred = infer(idea);
  if (opts.yes || opts.archOverride) {
    return inferred;
  }

  const ui = (await select({
    message: "这工具用户怎么用？",
    default: inferred.ui,
    choices: [
      { name: "网页（浏览器打开）", value: "web" },
      { name: "浏览器扩展", value: "browser-ext" },
      { name: "桌面 App", value: "desktop" },
      { name: "命令行", value: "cli" },
    ],
  })) as UiKind;

  // Data question only relevant for web.
  let data: DataKind = inferred.data;
  if (ui === "web") {
    data = (await select({
      message: "需要保存数据吗？",
      default: inferred.data === "none" ? "none" : inferred.data,
      choices: [
        { name: "浏览器本地（无需登录）", value: "local" },
        { name: "自己的数据库（云端）", value: "db" },
        { name: "不需要保存", value: "none" },
      ],
    })) as DataKind;
  } else {
    data = ui === "cli" || ui === "browser-ext" ? "none" : inferred.data;
  }

  // Users question only relevant when data is persisted in a web app.
  let users: UsersKind = inferred.users;
  if (ui === "web" && data !== "none") {
    users = (await select({
      message: "一个人用还是多人用？",
      default: data === "db" ? "multi" : inferred.users,
      choices: [
        { name: "一个人", value: "single" },
        { name: "多人（需要登录）", value: "multi" },
      ],
    })) as UsersKind;
  } else {
    users = "single";
  }

  return { ui, data, users, aiInvolved: inferred.aiInvolved };
}
