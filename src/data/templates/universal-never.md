1. **NEVER** modify files outside `{{projectRoot}}`
2. **NEVER** modify or delete `docs/DECISION_LOG.md`
3. **NEVER** hardcode API keys, tokens, passwords — use environment variables
4. **NEVER** commit `.env`, `*.key`, `*.pem` files
5. **NEVER** read `.env` files into your context — environment variables are loaded at runtime
6. **NEVER** install new dependencies without explaining the reason in your response
7. **NEVER** refactor unrelated code while fixing a specific bug
8. **NEVER** rewrite the entire project — make minimal targeted changes
9. **NEVER** claim a task is complete if tests are failing
10. **NEVER** use mock/fake data and present it as a working implementation
11. **NEVER** run destructive commands: `rm -rf`, `git push -f`, `drop database`
12. **NEVER** modify auth, payment, or database schema code without explicit user confirmation
13. **NEVER** silently update other packages when only one was requested
