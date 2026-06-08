# Validation Runs (v2.0)

Records of `agentguard new` runs across the five built-in architectures, per
`agentguard-mvp-v2/03-AI-Coding-实现提示词.md` Phase F.1.

## Routing matrix

All five documented ideas route to the expected architecture (covered by an
automated regression test in `tests/core/questionnaire.test.ts`):

| Idea | Slug | Architecture |
|---|---|---|
| `B 站浏览记录知识管理工具` | `bilibili-history-kb-manager` | web-spa |
| `团队任务协作 SaaS 平台` | `team-task-collab-saas` | web-fullstack |
| `Chrome 网页摘要插件` | `chrome-wang-ye-summary-cha` | browser-ext |
| `用 GPT 批量处理 Excel 数据` | `gpt-excel-shu-ju` | python-ai |
| `Git 提交信息生成器` | `git-ti-jiao-xin` | node-cli |

## Real install validation

### node-cli — `Git 提交信息生成器`  ✅ PASS

```
~/AI-Projects/git-ti-jiao-xin/
├── .agentguard/        (config + danger/secret patterns + 5 hooks)
├── .claude/settings.json
├── AGENTS.md           (126 lines, < 250 ✓)
├── CLAUDE.md / .cursorrules / .clinerules / .trae/rules.md  (symlinks → AGENTS.md)
├── docs/IDEA.md, DECISION_LOG.md, PROJECT_STATE.md
├── src/cli.ts          (rendered: name = git-ti-jiao-xin)
├── package.json        (type: module, bin: git-ti-jiao-xin, scripts: build/dev/test/start)
├── tsconfig.json
└── node_modules/       (npm install succeeded)
```

Checks:
- [x] AGENTS.md total lines < 250 (126)
- [x] `npm install` succeeded
- [x] `git log` has exactly 1 commit (`chore: bootstrap with AgentGuard`)
- [x] Defense hooks active: `echo '{"tool_input":{"command":"rm -rf /"}}' | node .agentguard/hooks/pre-bash.js` exits 2
- [x] package.json patched with slug-based `bin`

### generic (fallback) — desktop ideas  ✅ PASS

Desktop ideas (e.g. `一个简单的桌面便签工具`) route to the `generic` fallback:
rule files + git + gitignore only, no scaffold command. Verified by
`tests/new.test.ts`.

## Notes

- `web-spa` / `web-fullstack` / `browser-ext` / `python-ai` real installs depend
  on external toolchains (Vite/Next/Plasmo/uv) and network access. Their step
  definitions live in `src/data/architectures.json`; routing, AGENTS.md assembly,
  and the scaffolder step engine are covered by unit/e2e tests. The node-cli real
  run above exercises the full exec → write → patch → defense → git pipeline.
- On a network with peer-dependency conflicts, the scaffolder moves the partial
  project to `<dir>.agentguard-failed-<ts>/` and surfaces the underlying error.
