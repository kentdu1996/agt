# Changelog

## 2.0.0

Major direction shift: from "defense tool" to **"AI coding scaffold expert"**.
The new flagship command is `agentguard new`.

### Added
- **`agentguard new "<idea>"`** — bootstrap an AI-friendly project from a one-line
  idea in ~30s. Flags: `--here`, `--name`, `--arch`, `--yes`, `--dry-run`.
- **Idea → slug** (`core/slug.ts`) — deterministic Chinese/English → kebab-case via
  a concept dictionary + `pinyin-pro`, no LLM.
- **Architecture decision engine** — 5 built-in architectures (web-spa,
  web-fullstack, browser-ext, python-ai, node-cli) + `generic` fallback, defined in
  `data/architectures.json`; keyword questionnaire + priority router.
- **Dynamic `AGENTS.md` builder** — 6-section assembly (identity, stack, universal
  NEVER ×13, architecture NEVER, scene NEVER, done criteria), hard-capped at 250 lines.
- **Scaffolder** — runs `exec`/`write`/`patch`/`mkdir` steps via execa + Handlebars;
  moves failed projects aside; supports `--dry-run`.
- **Global config** (`~/.agentguard/global-config.json`) + project-location resolver
  (default root `~/AI-Projects/`, conflict suffixes).
- **`core/defense-bundle.ts`** — reusable installer for the v1 "core four", now shared
  by `new`.
- Scene rules (`data/scene-rules.json`) inject extra constraints for bilibili/微信/
  支付/登录/AI/上传 etc.

### Changed
- `init` is now positioned as the secondary entry point for **existing** projects.
- CLI tagline updated to the v2 positioning.

### Unchanged (backward compatible)
- v1 `init` / `doctor` / `rollback` / `scan` / `fix` / `hooks` / `allow` behavior and
  the dangerous-command / secrets / auto-checkpoint defenses.
- No LLM API, no external binaries, no network ports, no telemetry.

## 0.1.0

First release. The P0 "core four":

- **`init`** — one-command setup: writes `AGENTS.md` + agent rule symlinks, a 200+ line `.gitignore`, `.env.example`, `.agentguard/` config and hook scripts, `docs/PROJECT_STATE.md` + `docs/DECISION_LOG.md`, runs `git init` + first commit, and installs Claude Code hooks.
- **Dangerous-command interception** — `PreToolUse` Bash hook blocks `rm -rf /`, force-pushes to protected branches, `drop database`, `dd`/`mkfs`, piped remote scripts, and more, with quote-aware false-positive guarding and an allowlist.
- **Secrets scanning** — pre-commit, pre-read, and pre-write hooks plus `scan` / `fix --secrets`, covering OpenAI/Anthropic/Google/AWS/GitHub/Stripe/Slack/JWT/private keys.
- **Auto-checkpoint** — snapshots the working tree before agent actions via hidden git refs (no `git log` pollution); `rollback` and `rollback --gc`.
- **`doctor`** — weighted 0–100 project health report.
- i18n (en/zh), MIT license, zero external binaries, no network, no telemetry.
