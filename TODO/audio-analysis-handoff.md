# EDM audio reactivity: findings and next steps

Date: 2026-10-18
Status: first integrated implementation completed on 2026-10-18. Earlier research
and the original proposed plan are preserved below; see this checkpoint first.

## Camera rollback (2026-10-19)

User requested reverting the camera experiment. Restored the pre-experiment
wandering controller and forward-pulse timing; removed styles, camera-specific
mapping effects, and sphere/cube references. BPM, pitch color, and the other
music mappings remain. Saved reference scenes fall back to existing worlds;
retired mapping effects sanitize to the corresponding default effect.
The camera sections below describe historical work, not the current app.

## Commit/push checkpoint (2026-10-19)

User confirmed the recovered reference scenes look good and requested a commit
and push before continuing iteration later. Target: origin/main on
wickz80/phosphor-loop-min. No remote broadcast restart or audio routing changes.

The required `python3 tests/check.py` pre-push check now supports versioned script
URLs, the minimal UI workout, fixed low test resolution, and installed Mac Chrome.
Passed using /tmp/phosphor-check-venv (Python Playwright + Pillow installed there).
Mapping, camera-motion and surface-circuit tests also passed at this checkpoint;
full browser/audio/render/recovery checks passed during the implementation above.

Next work: assess the plain sphere/cube surface behavior with real music, then
adapt the coherent surface controller to the complex fractals. Actual musical key
extraction, manual tempo/timing controls, and rigorous real-track latency tests
remain unfinished. Keep the local preview running if it is still in use.

## Reference-scene freeze recovery (latest)

User reported freeze/black specifically when selecting Camera sphere/cube.
Fresh no-cache browser tests passed; reproduced the freeze by serving an older
camera export with the new app: makeSurfaceCamera is not a function stops RAF.
Missing shader exports likewise leave new scenes unavailable. Actual user's
browser console was not directly accessible, so cache mismatch is a reproduced
failure path consistent with symptoms, not a confirmed inspection of their tab.

Fixes:
- Same version query (surface-recovery-1) on first-party scripts/styles, new SW
  cache name, and HTTP revalidation for SW network fetches.
- Only offer reference scenes if camera functions, distance functions, and shader
  exports all exist. Stale saved scenes use existing source fallback to Mercury.
- Catch camera advance/render failures and shader-link failure. Mark failed scene,
  return active loops to a working texture, disable failed option, keep RAF/audio
  running, and show a short recovery toast. No full settings reset.
- test:scene-recovery exercises older camera/shader exports, camera exception,
  shader failure, normal sphere/cube, saved selections, continuing RAF, responsive controls, and a nonblack rendered image.
- Local Python preview remains running on port 8000; no restart required.

## Plain surface references (latest follow-up)

User says the movement still does not resemble a toy car driven around a ball.
Asked whether fractal complexity/rendering prevents solid surface interaction and
suggested a simple cube. Explained that implicit raymarched surfaces have matching
CPU distance functions; the earlier controller blended explorer steering, auto
Dive, bank/roll and local tangents instead of maintaining one coherent track.

Added Camera sphere / Camera cube (source IDs 32/33), under Texture, excluded from
Autopilot. Simple exact SDFs and gridded/face-colored materials share fractalFS.
These scenes use `makeSurfaceCamera` rather than `makeDrone`:
- Tangential translation + projection to a fixed offset surface. Heading is
  parallel-transported as the normal changes, including around cube edges.
- No random steering, dive, global-up tangent switching, or automatic roll.
- Glide shows the whole object; Runner/Crawler give local on-surface POV.
  Clearance and viewing-mode changes are eased. Existing sound mappings adjust
  speed/heading; surface drive/release uses radial spring motion.
- CPU reference tests perform full sphere and cube circuits at fixed clearance,
  verify closure (<0.025 world units; observed ~0.00005 sphere / .00034 cube),
  orthogonal/up-normalized views, acceleration, radial launch/return and freeze.
- Existing fractal controller is deliberately unchanged in this checkpoint.
  User should assess the reference behavior before porting to complex folds.
- npm run test:surface-camera; browser response script now captures both reference
  scenes in overview and surface modes, alongside existing motion checks.

## Camera movement and surface POV (latest follow-up)

User requested camera XYZ/velocity changes, racing along and launching away from
surfaces, 45°/90° turns, orbit, and Runner/Crawler-inspired switchable POVs.

- One Camera style selector under Visualizer: Glide, Runner, Crawler, Mix it up.
  Saved with the look as snd.cameraStyle. Enabled for the six drone-based fractals;
  worlds keep their shader-defined paths. Mix cycles every 16 grid beats, falling
  back to 8 seconds when no BPM exists. Style parameters ease over .65 seconds.
- Existing three mapping rows gain Camera speed, Surface ride, Orbit, Turn 45°,
  Turn 90°. Surface/turn/orbit choices disabled on worlds. Speed affects worlds'
  travel timeline too. Existing user routes are preserved; no new sliders.
- `makeDrone.fly(dt, motion)` integrates actual inertial velocity with speed,
  surface-normal attraction/release launch, tangent orbit, and step turns. Runner
  travels faster/closer with larger gait impulses and uses Forward pulse as a
  surface-drive input; Crawler has smaller, quicker steps and closer clearance.
- Camera time is no longer accelerated by the forward pulse for fractals; music
  changes displacement speed separately from steering. Surface-driven look blends
  toward the tangent so it can look along geometry instead of directly into walls.
- Each substep displacement capped at 35% of estimated surface distance and checked
  before applying position. Reject unsafe movement; stop its velocity. No changes
  to geometry shaders or external audio routing.
- Turn angle is 45°/90°; strength controls turn rate. BPM token gives one turn per
  beat, activity envelopes trigger on their rising edge. Turns steer the heading,
  and the existing look smoothing/banking follows it.
- CPU tests check increased XYZ travel, velocity relative to clearance, closer
  styles, outward release displacement, fixed turns, zero-time freeze, and finite,
  exterior positions on all six fractals with aggressive music/style changes.
- Browser regression covers style availability and persistence. Rendered response
  test also unpins camera/time and captures Runner/Crawler with synthetic drive,
  checking actual uCam movement and visible surface detail. Real-track feel still
  needs the user's assessment; this is a camera metaphor, not animal locomotion.

## Response range and slider fill (latest follow-up)

User confirmed BPM acquisition over localhost, but found full-strength effects
weak and mapping slider fill stuck. Fixed:
- Mapping sliders now call fillTrack on creation, drag/input, saved-state restore,
  source/effect changes and Reset mappings. Their CSS --b follows the actual value.
- Increased maximum source deformation .018 → .16, rotation .09 → .4 radians,
  forward pulse .025 → .075 and flight surge .6 → 1.8, shimmer glow .35 → 1.2.
  Master Amount and individual route strengths still scale these bounds. No new
  feedback zoom or full-screen flash. Reduced-motion scaling remains in place.
- Browser regression verifies fill at initial 85%, edited/restored 37%, and reset.
- `npm run test:music-response` fixes camera/time on Sierpinski and compares each
  effect at maximum to neutral, takes 120-frame screenshots, and verifies neutral
  restoration. Fixtures override only music feature intensity, not effect uniforms.

User asked about hot reload then explicitly declined when told app-code changes
require a reload/reconnecting audio. No hot reload or dev-server changes added.
Existing Python localhost preview stays running; only reload the browser page.

## File-open BPM failure (latest follow-up)

User reported BPM never acquired, then identified their URL as
file:///Users/wix/phosphor-loop-min/index.html. No local HTTP server was running.
The earlier browser tests all used localhost and missed the file-open restriction.
Started `python3 -m http.server 8000 --bind 127.0.0.1` (PID 17765, exec session
85569); verified HTTP 200. User was given http://localhost:8000/ and asked to
reconnect Share audio there. Keep this local preview process running.

Added a visible file-open notice/link; skip unavailable file-origin DSP and show
its reason rather than indefinite Searching. Worklet startup failure now has an
explicit status and BPM unavailable overlay. Added file-open notice regression.
No tempo algorithm changes were needed to address this identified origin issue.
Actual music acquisition still needs confirmation in the user's localhost tab.

## Steady BPM pulse and overlay (follow-up)

User found kick pulses jittery and requested a solid BPM-driven beat instead,
plus BPM in the resolution/FPS overlay. Implemented:
- `js/audio/beat-clock.js`: continuous audio-time oscillator. Accepted tempo/phase
  estimates steer BPM over 4 seconds; phase correction capped at .015 cycles/sec.
  Updates do not reset phase or manufacture extra kick triggers.
- New BPM beat source is the default forward pulse. Kick remains selectable.
  Existing routes migrate Kick to BPM once using saved mappingVersion 2; explicitly
  choosing Kick afterward persists. Custom strengths/effects remain unchanged.
- BEAT light, phase strip, and Autopilot beat waits follow the grid. Actual kick
  envelope remains separate. No kick fallback while waiting for a tempo estimate.
- Tempo coasts through weak estimates up to 16 seconds after last accepted result;
  brief audio gaps do not interrupt pulses. Sustained silence (>750 ms) mutes
  pulses while preserving phase. Stale feature/capture handling still applies.
- Overlay displays tracked BPM, Finding BPM while acquiring, or — BPM when off;
  tooltip shows tracking state.
- Mapping/clock tests cover steady intervals under displaced phase observations,
  no phase reset, kick independence, silence, stale tempo. Browser checks cover
  overlay placement/state, new defaults, saved migration and existing flows.
- Real-track phase accuracy and capture latency remain listening-test work.

## Configurable music mappings (follow-up, 2026-10-18)

User approved a minimalist three-row mapping panel and requested a better term
than constellation. UI uses Structure color for fractals, Scene color for worlds.

- Collapsed Music mappings panel below Amount. Three Sound / Effect / Strength
  rows, None to disable, Reset mappings. Saved through existing look/session data.
  Sources: Kick, Percussion, Dominant pitch, Bass, Highs, Tonal activity. Effects:
  Forward pulse, Light shimmer, Structure/Scene color, Rotation accent, Deformation.
  Pitch intentionally offers color or None only. Other sources can use any effect.
- Replaces the prior hardcoded render mappings. Routes sum into bounded effect
  amounts; master Amount still scales the result. Kick defaults to 85% forward,
  percussion to 40% shimmer, pitch to 55% color. No stacked feedback zoom.
- Rotation/deformation operate on source coordinates, so they work at zero trails.
  Fractal color tints base/emission before lighting, retaining shading and leaving
  background/fog intact; world color tints the scene output. No geometry rebuild.
- Existing tempo worker now computes PitchYin roughly eight times per second on
  recent 2048-sample windows at 44.1 kHz. Confidence >= .85, 110–1200 Hz. Controller
  stores the last accepted note; note classes map to hues independent of octave,
  with circular hue smoothing. This is approximate dominant periodic pitch, NOT
  lead melody separation or musical key estimation. Bass/vocal capture is expected.
- `npm run test:mappings` checks source isolation, None, stacking caps, pitch-class
  consistency and saved-data validation. Rhythm tests also check 440/523 Hz at
  different sample rates and rejection of seeded noise. Browser regression checks
  include live synthetic pitch, mapping edits, None, reset, saved values, Sierpinski
  shader rendering at 120 frames, and narrow-screen layout. Real-track tuning remains.

## Integrated checkpoint (2026-10-18)

The user asked to resume, then explicitly preferred modifying the app directly
over building a separate demo. No separate demo was built.

Implemented:
- Existing Share audio now feeds Web Audio plus `js/audio/rhythm-worklet.js`.
  Audio-clock 10 ms feature hops and low-band attacks replace render-frame kick
  detection when the worklet is available. Frame-based analysis remains a fallback.
- Local, pinned Essentia.js 0.1.3 ES modules in `vendor/essentia/`, including
  AGPL-3.0 license. npm dependency/lockfile pinned too. No CDN/server processing.
- `js/audio/tempo-worker.js`: bounded 12-second mono ring, stateful resampling to
  44.1 kHz, multifeature RhythmExtractor2013 every 4 seconds. Deletes Embind vectors.
  Main-thread queue is capped; overflow resets history rather than splicing gaps.
- `js/audio/rhythm.js`: lifecycle, confidence handling, half/double normalization,
  smoothed BPM/phase corrections, stale-feature expiry, and recent kick envelopes.
  Large tempo changes need a second matching estimate. Tempo prediction is used
  for the phase display; actual kick pulses require observed attacks.
- Smaller kick pulse/flight surge; removed kick-driven feedback zoom and sharply
  reduced bass-driven size. Bass deforms, percussion accents rotation/shake, highs
  shift hue, smoothed mid-band activity drives slower color. Approximate bands
  are not instrument classification or harmonic source separation.
- Visible BPM/state and estimated phase strip, BASS/PERC/HIGHS meters and KICK light.
- Stops terminate worker, disconnect worklet, and close the audio context. Offline
  cache includes local audio modules/assets.

Validation:
- `npm run test:rhythm`: offline audio frames at 44.1 kHz/120 BPM and 48 kHz/128 BPM,
  followed by a break, plus silence. 65/65 kicks detected within 80 ms, no extra
  detections; tempo within 1 BPM in observed runs. Worker analysis about 370–440 ms
  per 12-second synthetic window on this Mac. This is not a live GPU benchmark.
- `npm run test:minimal`: PASS including new worklet feature startup/status visibility,
  existing sharing/disconnect/stale-stream flows and renderer checks.
- JS syntax and diff whitespace checks passed. Inspected browser screenshot.

Remaining:
- Real EDM listening and capture-latency calibration; representative genre/transition
  precision/recall and real native-resolution hardware performance are unmeasured.
- No manual tap/BPM/timing-offset controls yet. No bar/downbeat identification.
- Beat phase currently informs the indicator; Autopilot still waits for detected
  kicks using its existing beat setting, rather than quantizing to the tempo grid.
- Confidence thresholds and tempo-change behavior are initial tuning choices.
- No deployment, push, broadcast restart, or system audio routing changes.

## Original research and proposal


## Goal and user preferences

This fork, phosphor-loop-min, is a browser-only proof of concept intended for a personal website. Music will mostly be EDM. Prioritize kick tracking and stable tempo synchronization, with distinct visual responses to bass, percussion, and melodic activity. Avoid the current excessive zooming and reacting to every sound.

Everything should run locally in the visitor's browser with no native app, audio driver installation, or analysis server. The existing Share audio flow should remain the input. Actual available capture sources depend on the browser/OS; a click and fresh sharing permission are required each visit.

The user is interested in Essentia as a potential engine. This is a candidate, not a finalized dependency decision.

## What is already implemented in this session

- Main title and browser tab: phosphor-loop-min; green interface theme.
- Focused controls: Audio, Visualizer, Autopilot. Worlds and fractals are the available visuals; Mount Ribbit is excluded.
- Taste training and show mode disabled. Much of the legacy desktop engine and hidden control bindings still remains; this is an initial simplification, not a complete removal of unused code/assets.
- Deleted Android packaging, native audio bridge implementation, Android release workflow, phone page, QR library, and phone-pairing implementation.
- Browser audio sharing replaces automatic BlackHole startup. Share audio prefers a music tab and requests system audio where available. No microphone request in the normal visitor flow.
- Fixed a likely legacy loopback discovery issue: keep the temporary permission stream alive until after enumerating device labels. The user's specific BlackHole failure was not reproduced with real hardware.
- Visual defaults persist. Capture permissions/sessions do not reconnect automatically after reload.
- Rendering and feedback buffers follow the canvas's physical pixel dimensions, including fullscreen/HiDPI. Saved Native / 75% / 50% resolution selection; hardware-size limits and allocation fallback. Time-warp history capped at approximately 32 MiB per loop.
- Header is compact and credits [nhillson/phosphor-loop](https://nhillson.github.io/phosphor-loop).
- Controls and metadata overlay the canvas and remain within its fullscreen element. Translucent normally, brighter on hover/focus, dimmer when idle in fullscreen.
- Overlay includes current texture(s), runtime, actual internal resolution, measured render FPS, Freeze (Space), Autopilot (P), Next look (L), Full screen (F).

## Why current music integration feels wrong

Relevant code: `js/app.js`, especially `analyzeSound`, `drawMeter`, `sndPower`, audio modulation in `drawLoop`, the 3D-flight update, and the final display pass.

- No BPM estimation, beat phase, or persistent musical clock.
- The beat heuristic detects a sudden positive change in bass-spectrum bins, with a 170 ms minimum interval. Bass attacks can be mistaken for kicks; missed/extra hits have no tempo model to correct them.
- Spectrum analysis and beat decisions run from the graphics frame loop. Normalizing flux by frame time does not make the analysis independent of rendering stalls or recover missed events.
- Low/mid/high envelopes normalize against recent average/peak levels. They show relative activity rather than instrument identity or a meaningful beat grid.
- Several effects stack: feedback zoom, input size, flight speed, and final display punch all respond to bass/beat. A better detector alone will not fix excessive movement.
- All six mappings (kick, size, spin, color, warp, flash) default to enabled. Their individual toggles remain in hidden legacy UI; the focused interface exposes mainly Amount.

## Browser feasibility and Essentia findings

**Browser-only live analysis is feasible.** Essentia.js compiles the C++ library to WebAssembly and documents live analysis using AudioWorklets. It can consume samples from our existing captured MediaStream through Web Audio; its microphone examples do not imply we must request microphone access.

However, Essentia is a toolkit, not a drop-in live EDM kick/snare classifier.

### Immediate features versus musical context

- Frame-based spectral/energy features and attack detection can run continuously.
- Stable BPM requires multiple beats of history.
- BPM alone does not say when the next beat occurs: a separate phase/alignment tracker is needed.
- `RhythmExtractor2013` returns tempo, beat positions, and confidence for supplied audio. Its C++ streaming implementation waits until input ends before producing its aggregated results. “Streaming” in the API name does not mean an immediate callback on every live beat.
- A practical adaptation is to analyze bounded recent audio windows in a worker and use the results to guide a continuously running beat clock.
- `RhythmExtractor2013` requires 44.1 kHz input; captured streams can be 48 kHz, so explicitly handle resampling.
- `multifeature` provides a confidence value; the `degara` method's confidence output is always zero and must not be treated as a useful confidence measurement.
- Essentia.js is AGPL-3.0 licensed. Include its licensing in the dependency decision; no licensing integration has been done.

### Instrument detection limits

Frequency ranges overlap. Snare-like attacks can also be claps or bright synth attacks; high-frequency events can be hats, noise, or sibilance. Tonal activity is a realistic initial feature, but it does not reliably identify a lead synth rather than vocals or another harmonic instrument.

Use labels such as Kick, Bass, Percussion, Highs, and Tonal initially. Reliable event-level instrument classification or source separation would be a separate, larger ML effort. Music tagging models are not automatically suitable for per-hit timing.

## Recommended design to prototype

Use a hybrid architecture:

1. **AudioWorklet:** receive audio continuously on the audio clock, independent of graphics. Maintain bounded buffers and lightweight attack/envelope extraction. Avoid expensive batch analysis and unbounded allocations here.
2. **Background Web Worker + Essentia WASM:** perform slower tempo/context analysis. A rolling 8–16 second window refreshed periodically is an initial design candidate, not a measured requirement or guarantee.
3. **Beat clock:** track BPM and beat phase, correct against observed kicks, reject abrupt implausible changes, and handle half/double tempo ambiguity.
4. **Renderer:** consume timestamped features/events and apply independent, bounded visual envelopes.

The fast kick path should not wait for the slower tempo worker. During a breakdown, the musical clock may continue while actual kick-triggered pulses stop. Silence and weak confidence should fade toward ambient movement instead of generating confident-looking false beats.

Timestamp signals using the audio timeline and map them to the rendering timeline. Browser capture latency plus analysis and display latency can make otherwise correct detections look late. Calibration and a timing adjustment are worthwhile. Prediction can help steady EDM, but must not manufacture kicks through every break or transition.

### Proposed visual mappings

| Signal | Detection approach | Visual behavior |
| --- | --- | --- |
| Kick | Low-frequency attack plus transient shape, adaptive thresholds, and beat-timing evidence | Small sharp pulse or bounded forward movement |
| Bassline | Smoothed bass envelope separated from kick attacks | Continuous depth or deformation |
| Snare/clap-like percussion | Short broadband mid/high attack | Brief rotation, edge accent, or color change |
| Hi-hats/high percussion | High-frequency transient activity | Fine shimmer or detail changes |
| Tonal/melodic activity | Sustained harmonic energy and harmonic changes | Slower color or texture movement |
| Tempo/phase | Repeating attack patterns with confidence and alignment tracking | Stable animation timing and autopilot transitions |

These are proposed mappings, not measured classifier capabilities. Do not let all signals stack into zoom again. Separate sensitivities and visual response intensity, apply caps, and use different attack/release times by channel.

## Replace the current audio meters

Suggested interface:

- BPM plus a clear state: Listening / Finding tempo / Locked / Low confidence.
- A small beat-phase indicator, explicitly distinct from detected kick activity.
- Activity indicators or short traces for Kick, Bass, Percussion, Highs, and Tonal.
- Tap tempo, BPM override, half/double tempo, and timing offset as recovery controls.
- A restrained Response setting; individual channel strengths can be tucked into advanced settings.

Avoid implying bar/downbeat identification unless it is actually implemented. A row of four beat lights alone does not prove we know the first beat of the bar.

## Effort estimates discussed

Engineering estimates, not commitments. They include implementation and basic validation, not guaranteed performance across all music/devices.

| Approach | Estimated effort |
| --- | --- |
| Retune existing mappings, cap zoom, smooth bass response; no tempo tracking | 0.5–1 day |
| Lightweight custom audio-clock rhythm tracker | 3–5 days |
| Browser BPM-library integration plus beat alignment/mappings | 2–4 days |
| Essentia-based hybrid with separate musical channels | Approximately 1–2 weeks |
| Manual sync controls | 0.5–1 day additional |

For the EDM-focused Essentia design: **one-day feasibility spike, then roughly another 5–9 days** for integration, UI, mappings, listening tests, and tuning. Full source separation or robust lead/instrument identification is outside that estimate.

An alternative to benchmark is `realtime-bpm-analyzer`, an AudioWorklet-based browser tempo library. Its tempo estimates still need beat-phase alignment and the other musical channels; integrating it alone will not solve the visual mapping problem.

## Resume here

1. Pin an Essentia.js release and confirm the required algorithms/API and distribution assets.
2. Build a small isolated feasibility harness using the existing Share audio stream. Measure feature timing, tempo update cost, memory, and event latency before changing the renderer.
3. Compare a lightweight kick detector against Essentia-derived features and tempo estimates. Verify cross-frame state is preserved for the chosen APIs.
4. Test representative house/techno, trance, drum-and-bass, dubstep/half-time, breakdowns, builds, drops, and DJ transitions. Include quiet/silent sections and tracks with sustained/sub bass.
5. Check onset precision/recall and timing error, BPM stability, half/double errors, time to lock/reacquire, and false activity during breaks. Synthetic known-BPM fixtures complement listening tests; they are not sufficient alone.
6. Benchmark with actual native-resolution 3D rendering enabled, especially demanding fractals. Existing software-browser checks are not a hardware performance benchmark.
7. Choose the analysis engine based on the spike, then integrate bounded mappings and replace the meters.

## Current validation and limitations

`npm run test:minimal` passed after the overlay work. It checks native feedback sizing, viewport changes, fullscreen/HiDPI sizing, resolution persistence, fullscreen overlay containment and Freeze interaction, source labels/FPS, simulated browser audio sharing, missing-audio/cancellation/disconnect/stale-stream handling, saved visual defaults, autopilot, responsive layout, and no page errors.

`node --check js/app.js` and `git diff --check` also passed. Screenshots were inspected during the UI work.

These checks do **not** establish beat detection quality, real capture latency, real BlackHole behavior, sustained 4K GPU performance, or Essentia throughput. No new audio DSP or Essentia dependency has been implemented.

## Primary sources

- [Essentia.js repository and licensing](https://github.com/MTG/essentia.js)
- [Real-time audio tutorial, including AudioWorklets](https://github.com/MTG/essentia.js/blob/master/docs/tutorials/2.%20Real-time%20analysis.md)
- [Getting started: worker/worklet guidance](https://github.com/MTG/essentia.js/blob/master/docs/tutorials/1.%20Getting%20started.md)
- [Essentia.js algorithm API](https://mtg.github.io/essentia.js/docs/api/Essentia.html)
- [OnsetDetection methods and limitations](https://essentia.upf.edu/reference/std_OnsetDetection.html)
- [RhythmExtractor2013 parameters and sample-rate requirement](https://essentia.upf.edu/reference/streaming_RhythmExtractor2013.html)
- [RhythmExtractor2013 source: aggregated output at input completion](https://raw.githubusercontent.com/MTG/essentia/master/src/algorithms/rhythm/rhythmextractor2013.cpp)
- [Essentia.js ML tutorial: real-time model processing architecture](https://github.com/MTG/essentia.js/blob/master/docs/tutorials/3.%20Machine%20learning%20inference%20with%20Essentia.js.md)
- [Alternative: realtime-bpm-analyzer](https://github.com/dlepaux/realtime-bpm-analyzer)
- [Browser audio-sharing API and restrictions](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)
