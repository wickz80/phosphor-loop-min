# Main → min audit, 2026-10-24

Compared local main at `545aabe` with min at `5fec960`. This is a local checkout audit, not a remote freshness check.

## First port

- Restore the existing A/B tabs and What you see blend fader inside the compact Visualizer section. Reuse engine bindings rather than duplicate state.
- Input selection edits only the selected loop. It now resets that loop to clean source defaults with Trails off; named looks supply their original recipe values.
- Copy main's `js/fractal-math.js` verbatim and use its camera view position. Explicitly request Glide with no style drive, matching main `668652a`. Retain min's scene recovery and music mappings.
- Browser regression now exercises independent textures/effects and the visible blend control.

## Rendering and source-control port

- Restore all 15 world/fractal shader implementations from main. The six fractal materials keep min's pitch tint hook; with tint removed, all 15 generated shader sources match local main exactly. Remove the custom Mercury bounds/uniform optimization and reduced-detail shader paths.
- Replace min's Smooth/Auto/Full 3D sampling and percentage resolution controls with main's Picture sharpness model: Standard 576 lines, High up to 1080, Full up to displayed size/4K, and adaptive Auto. Use the upstream frame-window thresholds and retry ceiling. Skip adaptation while frozen as well as hidden.
- Bring over main's output pixel budgets and resolution-independent effect sampling (`uPxK`) together. Keep min's GPU dimension checks, allocation fallback, feedback-copy resize path, display-density listener, and bounded time-warp storage. Explicit capture resolution still takes precedence.
- Restore original Picture, Video, Camera, Screen, Other loop and Nothing inputs in the compact selector. Reveal only the selected source's original deck: video playback/seek/speed/repeat, camera selector/retry/off, and screen sharing controls. Devices start from the source-selection gesture.
- Restore image/video file drop. Remember the selected loop while media decodes asynchronously. JSON drops stay disabled. Media resources remain shared across loops, as in the original engine.
- Label Neutral explicitly as affecting both loops. Match the selected loop's control colors. Retain the three-section compact layout and fold secondary effects.
- Retire the unused min-only quality controller, update cache revisions and offline assets, and update browser/performance/deployment checks for the new control model.

Main's compositor now supports four loops (`d10c63e`) and per-loop Show faders. That expansion remains deferred: this port retains min's two-loop compositor and adopts the rendering changes without bringing in four-loop state/UI/persistence. Video clip-library integration also remains deferred; the original local video deck is available now.

## 2D visuals and defaults

- Add the complete Patchwork tile shader from main unchanged, plus its source ID, starter and selector entry.
- Expose Wave, Shape, Bars, Sparks, Ink, Patchwork, Text and Spectrograph in the grouped Texture dropdown. Restore Text/Spectrograph source panels.
- Add a 2D looks group in that same Texture dropdown, with selected-loop application of original Bloom, Coral, Ink and Ribbons starters, plus Fractal garden, Shattered mirror, Prism, Marbled and Kaleidoscope drawing recipes. Their parameter data match local main exactly. Bloom is labelled Kaleidoscope (2D); named selections persist with each loop and remain visible when switching tabs or reloading; the separate 3D Kaleidoscope remains under 3D fractals.
- Expose Fractal fold, Mirror, Crystal, Color chase, Grow, Flow and Melt in More effects. These were present in the renderer but inaccessible from the compact controls.
- Remove remaining 3D-only filters from patch/preset loading, session restoration, Autopilot and Surprise. Those filters silently converted 2D recipes to Mercury or excluded their inputs.
- Set missing/default Trails to zero. New plain inputs reset only the selected loop; worlds use main's clean starter values (including size 100, color zero), and Patchwork uses its exact upstream starter. Existing explicit saved settings remain intact until changed or Reset input defaults is pressed.
- Named feedback looks deliberately keep main's longer Trails. Lowering those defaults globally would change how Fractal garden, drawing and Ink work.

## Other upstream candidates

| Change | Main commit | Assessment |
| --- | --- | --- |
| Per-loop sound response | `0eaa137`, `12c5ade` | Useful: a manual loop can stay calm while another reacts. Needs both shader and scene-motion gating. |
| Autopilot chooses loops, together or taking turns | `042ca8b` | Useful after A/B exposure. Port ownership and transition logic with controls. |
| Per-loop recoloring | `bc5d680` | Useful compact control; requires matching shader and persistence. |
| Shift-wheel faders, delayed name tooltips | `9966a70`, `90f6349` | Small usability candidates. |
| Video clip library and categories | `0e99933` | Restore only with source selection and video controls; local video/source controls are now exposed; library integration remains separate. |
| Patchwork | `c501bf7`, `1740e21`, `ae5abd2` | Ported: shader, clean starter and 2D source selection. |
| Spotify sequencer and silhouettes | `545aabe` | Separate feature, substantial UI/dependencies. |
| Stream/record app and BT.709 updates | `478fb66`, `e94be80` | Separate capture audit; do not replace min's capture tools casually. |

## Validation

Passed here:
- `npm run test:visual-defaults`: zero-trail source defaults, original 2D recipe parameters, A/B isolation, retired-source fallback and 2D session restoration.
- Local-main comparison: all exposed named 2D patches, clean world starters and Patchwork shader match the originals.
- Syntax checks for modified JavaScript and `git diff --check`.
- `npm run test:render-quality`: actual app controller, resolution modes, capture override, memory limits, adaptive frame windows, hidden/frozen handling, failed-level retry delay.
- `node --experimental-strip-types --test tools/deploy/package.test.ts sw.test.ts`: packaged browser assets and scoped offline cache revisions.
- `npm run test:mappings`: mapping behavior and continuous BPM clock.
- Camera math simulation: all six fractals move with finite camera vectors over 600 Glide frames.
- Generated source comparison: all 15 world/fractal shaders match local main apart from the preserved pitch material tint.

The session denies binding localhost ports (`EPERM`). The Browser plugin reports no connected browser; standalone Chrome exits during launch in this session. Browser/visual checks, webcam/video playback and rendered GPU shader checks are pending. The browser suite has regression cases for independent A/B settings, source decks, sharpness, saved defaults, responsive layout and audio permission behavior, but has not run successfully here.

In a session permitting local servers:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
npm run test:minimal
npm run test:scene-recovery
npm run test:music-response
SHADER_BASELINE=../phosphor-loop/js/shaders.js npm run test:shaders
```
