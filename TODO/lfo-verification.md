> Current controls pass: restarting Autopilot disables loop/mix LFOs; source and master LFOs remain independent. The mapping editor has been removed. Older behavior notes below are historical.

# Beat-synced slider LFOs — implementation and resumption

## Implemented

- `js/lfo.js` contains a DOM-independent engine and a small UI adapter. It is loaded before `app.js` and included in the offline service-worker assets.
- Every range input exposed in the compact UI gets a labelled LFO checkbox. This includes effect sliders, A/B mix, sound amount, music-route strengths, Autopilot settings and the video seek slider. Dropdowns/buttons are not oscillated. Hidden legacy UI is excluded.
- Enabling reveals draggable orange bounds on the original slider and a beat-duration selector: 1/8, 1/4, 1/2, 1, 2, 4, 8, 16, 32, 64.
- Duration is one complete X → Y → X cycle. Sine remains the default; Linear, Log and Exp are selectable. Reverse ranges work. Output respects slider limits and quantization. The tiny N selector is labelled as the cycle duration for assistive technology.
- Compact orange checkbox and slider identify active modulation. The slider fill, thumb and numeric output update each render frame. Model values and render values are written together, bypassing ordinary slider easing so short beat divisions are not smoothed away.
- `app.js` calls `lfoUI.tick()` after the current audio-analysis sample and before rendering. Tempo/phase come from the existing shared `snd.rhythmSample.gridBeat + phase`, driven by the continuous BeatClock; no separate timer or fake BPM.
- Missing tempo or silent audio (null beat position) holds values and displays Waiting for BPM. Freeze holds values; resuming rejoins the clock. No wall-clock catch-up loop.
- Loop sliders store separate A/B configurations; both loops advance, including the hidden loop. Global sliders remain shared. Switching edit tabs refreshes checkboxes, bound ticks and curve/duration selectors.
- LFO writes go directly to model state, avoiding synthetic user input, Autopilot pinning and localStorage writes every frame. Video seek uses its existing input handler.
- Enabling an LFO turns off Autopilot and drift. If the user deliberately restarts Autopilot later, LFO values take precedence immediately before rendering. Disabling holds the last value.
- Configuration persists under `phosphor-min-lfo-v1`. Configuration changes save immediately, independently from the current look/session. Runtime slider movement does not rewrite LFO configuration.

## Verification

`npm run test:lfo` covers all cycle lengths, quarter/half/full-cycle endpoints, bounds, reverse ranges, independent A/B bindings, disabled bindings, missing tempo, Freeze and serialized configuration restoration. Existing visual-default, sharpness and deployment tests also pass. Syntax checks cover the integration.

Browser verification remains pending: this session has denied local server binds and Chrome launch, and the Browser plugin had no connected browser. No rendered UI check has been claimed.

## Next visual verification

1. Serve this repository at localhost:8000 from an unrestricted Terminal; reload to get cache revision `lfo-track-bounds-1`.
2. Share a music tab and wait until BPM is found. Enable Input size LFO, drag the orange endpoints to From 25 / To 100 and set N to 4; verify the 3D lens and thumb match.
3. Enable Spin LFO from -60 to 60 at 1/2 beat, then 1/8. Verify immediate model movement and orange indication. Integer slider steps remain integer; drawing cadence is bounded by actual FPS.
4. Switch to B: A's configuration must not appear as B's. Enable a different range on B, show both loops and verify both move.
5. Check audio Amount and a mapping-strength LFO. A route whose effect is None is inactive until re-enabled.
6. Freeze/unfreeze, disconnect/reconnect shared audio, and reload. Values should hold without a beat, then rejoin the shared beat grid; configuration should restore.
7. Inspect mobile layout and keyboard focus, including draggable bound ticks and the two tiny selectors. Check toggling off keeps the last value.
8. Test video-seek modulation only with an expendable local clip: repeated seeking is intentionally supported but can be decoder-heavy.

## Known boundaries / possible follow-up

- There is no manual fallback tempo: waiting for a real tracked BPM avoids silently inventing a beat rate.
- X/Y/N settings are browser-global user configuration, scoped per loop, rather than embedded in exported presets. Preset portability would need explicit LFO schema handling.
- Reset input defaults/Neutral currently leave LFO configurations enabled. Disable the relevant checkbox to restore manual control. A future Stop all LFOs button would make this easier.
- Bounds update during pointer dragging and persist on release; arrow keys, Shift+arrows and Home/End support keyboard adjustment. N and curve selectors persist on change.
- Modulated sliders retain their original step sizes. Smooth sinusoidal timing does not turn a discrete parameter into a continuous one.

## Compact layout update

LFO controls now sit between the slider title and track. The checkbox is 10px; active settings share one 18px row with X, Y and N fields. Full status is available on hover and to assistive technology. Mapping strength controls explicitly select their range input because the checkbox now precedes it in the DOM.

## Manual-control recovery

A pointer drag or slider keyboard gesture now disables that slider's LFO before the original input handler runs, preventing the oscillator from immediately overwriting manual values. LFO setup, UI refresh and frame ticks are isolated so an optional-module failure cannot stop ordinary sliders or the renderer. Cache revision: `lfo-manual-fix-1`. Browser reproduction is still pending.

## Track-bound design update

- Removed numeric X/Y fields. Bound ticks overlay the main range track and show their values. Their pointer hit targets occupy the top portion, leaving the main knob center available for manual takeover.
- Added pointer capture and touch dragging, plus keyboard control. Endpoints can cross; reversed ranges are intentional.
- Tiny checkbox/text use 8px type and a 9px checkbox; N and curve selectors have explicit 14px height and zero minimum height to override the app's 36px global select minimum. Sine/Linear/Log/Exp fit alongside N.
- Log is log1p(9*t)/log(10), Exp is expm1(log(10)*t)/9, applied to a mirrored linear sweep t. This shapes progression rather than taking the logarithm of raw slider values, supporting zero/negative ranges.
- Slider thumb center stripe is bright green manually and orange while enabled; its housing remains unchanged.
- Cache revision is lfo-track-bounds-1. Math and deployment checks passed; the Browser plugin again reported no browser, so rendered pointer/layout checks remain pending.

## Dependency-aware controls

`control-dependencies.js` derives availability from shader prerequisites. Feedback-only effects are disabled at zero Trails; direct effects remain available. LFO evaluation checks the target loop's state, not the currently visible DOM input's disabled state, so an unavailable A control cannot incorrectly stop B. Disabled ranges include native dependency tooltips and their inline label-help also reads current prerequisites. Main 01/02/03 sections are native details elements with persistent independent open state. Manual knob centers are dark again, thumbs are about 30% shorter, control gaps are increased and corner radii are halved. Cache revision: controls-deps-1.
