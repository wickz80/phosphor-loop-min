# Current handoff — 2026-10-25

## User direction

Continue the TypeScript migration only where it improves real boundaries and maintainability. Pair discrete units with a few useful TypeScript unit tests beside their source. Every function has an explicit return type. Keep ESLint recommended rules and consistent formatting. Do not chase exhaustive coverage, migrate dead features, or add trivial tests.

Autopilot will be redesigned: skip new Autopilot tests/migration. Existing regressions are retained. The final project-cleanup pass must remain uncommitted; the user withdrew the earlier request for ongoing commits for this pass. Do not push or send email without a new instruction.

## Current state

Seven strict TypeScript modules build from `src/` into tracked browser scripts in `js/`: control routing, dependencies, LFO engine, LFO state, LFO UI, beat clock and video grading. Shared browser globals are a temporary compatibility layer, not a completed module architecture.

Production automation uses the typed router for actual model writes, scopes and ownership. Manual handlers, reset and persistence are not yet consolidated. LFO restore rejects invalid IDs/scopes/configurations; manual/reset transitions and three-character readouts have focused tests. The full DOM adapter is typed; pointer/focus/layout behavior still requires browser verification.

Unit tests for migrated code are `src/**/*.test.ts`, typechecked with `tsconfig.tests.json` and excluded from browser output. The VM helper in `tests/support/` only exposes requested globals and verifies that they were installed. Native imports/exports should replace this harness when module boundaries are modernized.

## Latest cleanup, intentionally uncommitted

- README.md is authoritative for setup, commands, limitations and upstream attribution. README.txt is a pointer; outdated personal agent instructions were replaced with current conventions.
- Browser, worker, service-worker, AudioWorklet and Node lint environments are scoped separately. Legacy browser-automation callbacks have an explicit mixed environment.
- `npm run verify` runs types, lint, format, generated-file checks and all non-browser regressions. Unit, legacy and integration checks have separate commands. CI uses `npm test`, preserving all previous checks.
- Removed the eager startup build of unsupported Ribbit. Its remaining legacy integration is still present and should be reviewed for removal.
- Reprioritized TODO/tech-typescript-migration.md around actual engineering boundaries. No new Autopilot tests or scheduler migration were started.

## Verified

After the latest changes, `npm run verify` covers named TypeScript suites for migrated modules, legacy mapping/defaults, deployment/cache packaging and app/audio wiring. All non-browser regressions use `describe`/`it` with fresh fixtures and separate setup/execution/assertion blocks; simulation helpers return observations instead of hiding assertions. Tests are colocated beside source, including legacy JavaScript sources; production packaging excludes `.test.ts` files. The latest verification passes 60 named cases across 12 suites. No statement/branch coverage percentage is claimed.

Browser/GPU verification is pending. Capture-server tests were attempted earlier but could not bind localhost (`listen EPERM`) in this environment. This is a sandbox restriction; do not claim browser rendering, device behavior or perceived audio latency has passed. Current browser scripts hardcode a macOS Chrome path; portability remains backlog work.

## Git and checkpoint recovery

The real checkout's `.git` is not writable in this session. Its original HEAD remains `5fec960`; current working files contain all changes. Shell push also failed DNS resolution, and the GitHub write connector required unavailable approval. Nothing was pushed or deployed.

Earlier authorized checkpoints were committed in a temporary Git copy at `/tmp/phosphor-publish.GHVi8I/git`, using this repository as its working tree:

- `b6d2bbf` — upstream visuals and consolidated beat-synced controls.
- `9c80cc5` — initial strict TS/tooling migration and tested routing; includes nature-asset removal.
- `70d6ad8` — LFO UI migration and colocated typed tests.

A verified complete-history bundle is saved at `/tmp/phosphor-migration-checkpoints.bundle`, with checkpoint `70d6ad8` as main. It does not contain the intentionally uncommitted final cleanup. The current workspace does contain that cleanup. These are local checkpoints, not commits on the checkout's branch or GitHub.

## Next useful work

1. Explicit module imports/exports for migrated code, with one narrow legacy browser adapter. Avoid a large framework/bundler change solely for appearance.
2. Consolidate manual/reset/preset state ownership into the existing typed parameter boundary; do not create another parallel registry.
3. Migrate audio mappings and coordinator/message contracts with the existing focused tests; then media lifecycle.
4. Remove disabled legacy code deliberately and shrink the app.js lint baseline. Confirm project licensing/attribution documentation and make browser-test configuration portable.

See TODO/tech-typescript-migration.md for the complete ranked list. Dated audit and streaming handoff documents are historical evidence, not current setup or authorization to restart publishing.
