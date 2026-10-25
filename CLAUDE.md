# Repository development notes

Read README.md and docs/typescript-migration.md for current setup and conventions.
The ranked backlog is TODO/tech-typescript-migration.md.

- Keep TypeScript strict and give functions explicit return types.
- Colocate focused TypeScript unit tests with the modules they test.
- Edit src/ for migrated code, then run npm run build; do not hand-edit generated js/ files.
- Run npm run verify after a completed unit. Browser/GPU and capture-server checks are separate.
- Do not expand the legacy ESLint suppression baseline.
- Preserve vendor assets and upstream attribution.
- Autopilot is deferred for redesign; do not add tests or migrate it merely to preserve its current design.
- Report environmental test restrictions honestly. Do not describe source checks as rendered verification.
