# Engineering and migration priorities

Prioritize coherent ownership, reproducible checks and understandable code over renaming files. Each migrated unit must be strict TypeScript with explicit return types, a few meaningful colocated TypeScript tests and production wiring. Do not target exhaustive coverage or test trivial wrappers, CSS geometry or behavior scheduled for removal.

| Priority | Unit / outcome | Status | Focused verification |
| --- | --- | --- | --- |
| 0 | Accurate setup, separate test categories, runtime-specific lint globals and trustworthy test fixtures | Complete for this pass | `npm run verify`; fixtures only expose requested exports and validate their presence. Browser/server checks remain separate. |
| 1 | Real module boundaries for migrated code | Next | Replace global-script dependencies with explicit imports/exports and a narrow legacy adapter. Retain direct behavior tests; avoid untyped casts that pretend globals are installed. |
| 2 | One parameter/state model for manual changes, LFO writes, reset and persistence | Partial | Typed automation router is complete. Consolidate the remaining manual/reset/preset paths; test actual writes, scope isolation and schema round trips. Do not add another parallel parameter table. |
| 3 | Audio mappings and message/lifecycle contracts | Pending; beat clock complete | Migrate mappings with existing focused assertions; cover stale/out-of-order messages and stop/restart. Real music quality and latency need listening checks. |
| 4 | Media lifecycle | Pending | Test superseded async loads, source switch/stop, permission failure and cleanup with small adapters. Use browser checks for actual permissions. |
| 5 | Renderer sizing and allocation policy | Pending | Test resolution selection, valid dimensions and fallback decisions. GLSL and appearance stay in browser/GPU checks. |
| 6 | Fractal/camera math | Pending | A few representative finite-output, distance-bound and recovery regressions. Keep visual validation separate. |
| 7 | Recording-format handling and output lifecycle | Pending | Representative valid/truncated/unsupported binary inputs and close/cleanup. Retain capture/stream integration tests. |
| 8 | Remaining UI, helpers and developer tools | As touched | Migrate with the boundary that uses them. Avoid tests that only restate markup or implementation. |
| — | Hidden/retired features and lint baseline | Reduce before migrating | The unused Ribbit eager startup build is removed; its remaining integration and other dead surfaces still need deletion decisions. Remove rather than type unused code. |
| Deferred | Autopilot | Planned redesign | No new Autopilot tests or migration to preserve the current design. Existing regression checks are retained. |

## Completed units

- Typed routing IDs, scope selection, automation ownership and model writes; tests cover real state, A/B isolation and invalid inputs.
- LFO engine, full UI adapter and state/readout helpers; tests cover cycles, bounds, restore validation, manual/reset transitions and independent bindings. Pointer/focus/layout checks remain browser work.
- Beat clock; tests cover continuous timing and rejected stale/duplicate/offbeat events.
- Effect prerequisites and generated-scene normalization.
- Video grading state, bounds, defaults, storage validation and isolated reset.
- Migrated unit tests are colocated `src/**/*.test.ts`, typechecked separately and excluded from browser output. Legacy integration checks still live in `tests/`.

## Project cleanup still outstanding

- Split the large app along state/media/render/UI ownership; moving code without reducing coupling does not count as progress.
- Retire disabled taste/admin/phone/Ribbit code deliberately; do not replace dead paths with more no-op wrappers.
- Reduce the existing `app.js` lint baseline while touching those paths; do not expand it.
- Replace hardcoded macOS Chrome paths with portable browser-test configuration before claiming portable browser CI.
- Confirm and document the project's root license and attribution policy before presenting the fork as a reusable open-source package. Preserve existing third-party notices.
- Treat dated handoffs/audits as history, not current setup instructions. Keep README.md authoritative.

See [migration conventions](../docs/typescript-migration.md) and [the current handoff](../docs/handoff.md).
