# TypeScript migration

The migration is incremental. Converted modules live in `src/`; the larger browser application and media/UI adapters remain JavaScript. `strict: true` applies to every TypeScript file. ESLint also requires explicit return types on functions, methods and callbacks (constructors cannot have return annotations), with no `any` or `@ts-nocheck` escape hatches in this first batch.

## Source and generated files

| Edit this source | Generated browser script |
| --- | --- |
| `src/control-routing.ts` | `js/control-routing.js` |
| `src/lfo.ts` | `js/lfo.js` |
| `src/lfo-state.ts` | `js/lfo-state.js` |
| `src/lfo-engine.ts` | `js/lfo-engine.js` |
| `src/audio/beat-clock.ts` | `js/audio/beat-clock.js` |
| `src/control-dependencies.ts` | `js/control-dependencies.js` |
| `src/video-grade.ts` | `js/video-grade.js` |

Shared browser and dependency interfaces live in `src/browser-globals.d.ts`. The LFO DOM adapter, state transitions and engine are now TypeScript. Unit tests are colocated as `*.test.ts` beside their sources in `src/`, `js/` and `tools/`, checked by `tsconfig.tests.json` and run with Node’s TypeScript stripping (Node 22.18+). They and the shared VM helper are excluded from production builds. Legacy app/audio integration checks are also colocated TypeScript tests; remaining browser/capture suites live under `tests/`. Browser scripts retain their existing global API; the engine loads before its UI adapter. No bundler or framework is required.

Generated scripts are committed so plain static previews, capture tools and offline loading continue to work. Do not hand-edit them. `npm run build` checks types and emits formatted browser JavaScript; `npm run build:check` compares the expected output without changing files. The deployed site includes JavaScript, not TypeScript sources or development dependencies.

## Commands

```sh
npm ci
npm run format
npm run build
npm run check
npm test
```

`check` enforces strict TypeScript, ESLint, formatting and generated-file consistency. Deployment runs these checks before uploading. Pull requests also run the server/capture tests; browser/GPU suites remain separate.

Formatting uses Prettier defaults with the repository's single-quote convention, across owned JavaScript, TypeScript, tests and tools. ESLint uses `@eslint/js` recommended rules and `typescript-eslint` recommended rules for TypeScript. Vendor and generated files are excluded. AudioWorklet runtime globals are declared explicitly.

## Existing lint debt

`eslint-suppressions.json` records the existing legacy violations by file/rule. Rules are not globally switched off to make old code pass. Ordinary lint runs fail on new unsuppressed violations; do not run `--suppress-all` as a normal development command. Converted TypeScript modules have no suppression entries. Remove obsolete entries with `eslint . --prune-suppressions` when fixing legacy debt.

This baseline is deliberately temporary. It does not make the entire legacy codebase type-safe, nor does lint replace browser, audio or shader verification.

## Next batches

The ranked status list is maintained in [TODO/tech-typescript-migration.md](../TODO/tech-typescript-migration.md). Parameter routing and automation ownership have now been extracted into a typed module with direct tests; manual/reset/persistence consolidation remains outstanding.

1. Replace broad browser-global module coupling with explicit imports/exports; keep a narrow adapter for the legacy app. The LFO DOM adapter is already migrated.
2. Introduce a typed parameter registry and make manual/LFO/reset/persistence paths use it.
3. Type audio messages and isolate worker/worklet compilation contexts.
4. Extract loop state and media coordination from `js/app.js`, converting one boundary at a time. Defer Autopilot to its planned redesign.
5. Retire unused legacy surfaces and reduce the lint baseline as those modules are touched.

Shader source remains GLSL strings; TypeScript cannot check shader syntax or rendering quality. This phase preserves runtime behavior rather than redesigning effects.

## Verification commands

`npm run verify` runs checks plus all non-browser regressions. `test:unit` means colocated TypeScript unit tests only; `test:legacy` runs typed regression tests for state/math code whose implementation remains JavaScript, and `test:integration` covers app/audio wiring. Packaging and cache-isolation tests are colocated TypeScript cases in `test:unit`. `test:browser` and `capture:test` are separate. No coverage percentage is claimed.

## Unit test structure

Use `describe` to group a module's behavior and `it` to name each independently runnable case. Inside a case, separate setup, execution and assertions with blank lines (Arrange / Act / Assert). Mutable state and recording callbacks belong in a fresh local fixture for each case; immutable APIs may be shared. Simulation helpers return observations rather than hiding assertions inside the simulation loop. Do not place executable assertions at file scope or print custom PASS messages in unit tests: let the runner identify the failing behavior.
