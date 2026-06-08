# Contributing to AgentGuard (`agt`)

Thanks for your interest! AgentGuard is a local, zero-telemetry CLI.

## Dev setup

```bash
git clone https://github.com/kentdu1996/agt.git
cd agt
npm install
npm run build      # tsc + copy data/templates into dist
npm link           # makes `agt` available globally for local testing
```

## Useful commands

```bash
npm test           # run the vitest suite
npm run lint       # tsc --noEmit (type check)
npm run build      # compile to dist/
npm run dev -- new "a pomodoro web app"   # run from source via tsx
```

## Project layout

- `src/commands/` — CLI command handlers (`new`, `init`, `doctor`, ...)
- `src/core/` — slug, router, scaffolder, agents-md-builder, defense-bundle, ...
- `src/data/` — `architectures.json`, `scene-rules.json`, dictionaries, project templates
- `src/templates/` — defense hook scripts + base rule templates
- `tests/` — vitest unit + e2e tests

## Hard rules (do not break)

- No LLM API calls.
- No external binary dependencies.
- No network listeners, no telemetry.
- Don't bind to a single IDE/agent.
- Generated `AGENTS.md` must stay under 250 lines.

## Pull requests

1. Add/keep tests green (`npm test`).
2. Keep changes focused.
3. Update `CHANGELOG.md` for user-facing changes.
