import type { Messages } from "./en.js";

// Chinese strings. Activated when LANG/LC_ALL starts with "zh" (default for v1) unless AGENTGUARD_LANG=en.
export const zh: Messages = {
  cli: {
    description: "一句话开项目，自带 AI 专家级工程姿势与运行时护栏。",
  },
  common: {
    issuesHint: "遇到问题？https://github.com/kentdu1996/agt/issues",
  },
  init: {
    todo: "TODO: init",
    dirNotEmptyPrompt:
      "目录已有内容。继续会写入规则文件（不会删除任何现有文件），是否继续？",
    aborted: "已取消。",
    qType: "项目类型？",
    qAgents: "你主要使用哪些 AI Agent？",
    qProtected: "哪些目录/文件禁止 Agent 修改？",
    qTest: "测试命令是什么？",
    qStrictness: "规则严格度？",
    creating: "正在生成 AgentGuard 文件...",
    gitInit: "正在初始化 git 仓库...",
    installingHooks: "正在安装 Agent hooks...",
    done: "AgentGuard 初始化完成！",
  },
  doctor: { todo: "TODO: doctor" },
  rollback: { todo: "TODO: rollback" },
  fix: { todo: "TODO: fix" },
  hooks: { todo: "TODO: hooks" },
  allow: { todo: "TODO: allow" },
  scan: { todo: "TODO: scan" },
};
