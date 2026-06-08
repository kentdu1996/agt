# Decision Log

> Append-only record of architectural and significant technical decisions.
> AI agents MUST NOT delete or rewrite past entries — only append new ones.

## Format

Each entry: date, decision, context, alternatives considered, rationale.

---

### {{date}} — Adopt AgentGuard guardrails

- **Decision**: Use AgentGuard to manage agent rules, dangerous-command blocking, secret scanning, and auto-checkpoints.
- **Context**: Project initialized.
- **Rationale**: Establish safe defaults for AI-assisted development from day one.
