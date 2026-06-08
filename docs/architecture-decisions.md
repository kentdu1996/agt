# Architecture Decisions (v2)

Key engineering decisions behind the `agentguard new` flow. See
`agentguard-mvp-v2/` for the full product specs.

## Idea → slug

- **Deterministic, no LLM.** `concept-dict.json` maps common Chinese concepts to
  English (longest-match first, whitespace-tolerant for `B 站`), then `pinyin-pro`
  converts any leftover Chinese, then stop-words are removed and the result is
  kebab-cased. Falls back to `project-<random>`.
- Capped at 6 segments / 40 chars to keep directory names sane.

## Architecture routing

- **Decision tree, not ML.** `questionnaire.infer()` derives `{ui, data, users,
  aiInvolved}` from keyword heuristics; `architecture-router.route()` applies a
  fixed priority list. 100% predictable and unit-tested (`tests/core`).
- Desktop and anything unmatched fall back to `generic` (rule files only) so a
  user is never blocked.

## AGENTS.md assembly

- **6 sections, template + injected data.** Universal NEVER rules (13, hardcoded)
  + architecture rules + scene rules (keyword-matched) + done criteria.
- Hard cap of 250 lines; scene rules capped at 10 to protect the cap.
- Built as a pure string function (`agents-md-builder.build`) for testability.

## Scaffolder

- **execa + Handlebars.** `init_steps` (`exec` / `write` / `patch` / `mkdir`) run
  in order; `write` content is Handlebars-rendered against a flat context.
- On failure the partial project is moved to `<dir>.agentguard-failed-<ts>/`.
- `--dry-run` short-circuits all side effects.

## Defense reuse (v1)

- `defense-bundle.installDefenseBundle()` extracts v1's hook/pattern install
  logic into one reusable function called by both `new` and (conceptually) `init`.
- v1 `init` / `doctor` / `rollback` behavior is unchanged.

## Hard constraints honored

- No LLM API, no external binary dependency in our own package, no network
  listeners, no telemetry. Static data lives in `src/data/`.
