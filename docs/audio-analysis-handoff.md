# EDM audio reactivity: findings and next steps

Date: 2026-10-18
Status: research and proposed design only. The audio analysis changes below have **not** been implemented.

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
