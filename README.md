# Phosphor Loop

A browser visual instrument with two feedback loops, 2D patterns, 3D worlds, shared-audio response, beat-synced modulation and global color grading. This is a smaller personal-site fork of [nhillson/phosphor-loop](https://github.com/nhillson/phosphor-loop).

## Run locally

Use Node.js 22.18 or newer and Python 3:

```sh
npm ci
npm run build
python3 -m http.server 8000
```

Open http://localhost:8000 in desktop Chrome or Edge. Audio sharing requires localhost or HTTPS and an explicit browser permission. Opening `index.html` directly does not support the audio-analysis workers. Media capture support depends on the browser and operating system.

The four control sections are Audio, Visualizer, Autopilot and Video. Loop A/B settings are independent; loaded media and final-output grading are shared. The small orange LFO toggle enables beat-driven modulation; reset stops that slider's LFO and restores its value. Hover the help buttons for control descriptions.

## Development

```sh
npm run format
npm run build
npm run verify
```

`verify` checks types, ESLint, formatting, generated-file consistency, focused unit tests and existing non-browser regressions. It does not run browser/GPU or capture-server tests.

- Edit migrated modules in `src/`; the corresponding `js/` files are generated and committed for static previews.
- Unit tests are TypeScript `*.test.ts` files beside their source and are excluded from production output.
- Remaining JavaScript is formatted and linted. Existing `app.js` lint debt is recorded in `eslint-suppressions.json`; do not regenerate that baseline to make new code pass.
- `npm run capture:test` exercises the local capture server. `npm run test:browser` runs the current browser regression suite, which expects installed Google Chrome at the macOS path used by the test harness.

See [migration conventions](docs/typescript-migration.md), the [ranked work list](TODO/tech-typescript-migration.md) and [deployment setup](docs/deployment.md). Pushes to `main` deploy to https://wix.fyi/loop/ after the workflow checks pass.

## Current boundaries

The renderer, media coordination and much of the UI still live in a large JavaScript application. Migrated modules retain a browser-global compatibility layer; native module boundaries and consistent state ownership remain outstanding. LFO settings and global grading persist separately from saved looks. Autopilot is scheduled for redesign; its behavior is not a migration priority.

Focused unit and packaging checks run locally and in CI. Browser appearance, device permissions, real music latency and GPU behavior require separate verification; passing unit tests do not establish those properties.

The upstream fork retains third-party code under `vendor/`, including Essentia.js and its accompanying license. Keep upstream attribution and vendor notices intact.
