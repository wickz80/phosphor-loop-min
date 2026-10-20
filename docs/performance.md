# Native-resolution performance

Latest follow-up: [shader simplification and display-refresh Smooth mode](smooth-shaders.md).
The results below preserve the earlier optimization checkpoint.

Measured on 2026-10-19 using installed Google Chrome with the Apple M3 Max Metal
renderer. The external display is 6016 × 2538; the benchmark's 3008 × 1269 CSS
viewport at device scale 2 gives a 5372 × 2460 canvas after the control panel and
page margins. That is 13.2 million pixels per full-screen pass, 4× the pixel count
at the 50% render setting. The headless benchmark has a 60 Hz animation clock;
its results do not establish 120/165 Hz performance in an interactive browser.

## Findings and changes

- Scene shaders raymarch geometry per pixel (up to 110 steps for the fractal
  flights, plus normal/AO samples; individual worlds use their own march loops).
  At native Retina/6K resolutions, this work dominates the frame budget.
- The feedback shader used to transform and sample history even with trails at
  zero. It now skips the history calculation when decay is zero, and avoids blur
  samples unless blur, restless, or grow uses them. Disabled brush, source warp,
  static, and shake work is also skipped. These changes preserve active effects.
- A single visible loop used to require a separate full-resolution compositing
  pass. The display and Autopilot analysis now read that loop directly. Blended
  loops still use the original compositor.
- A/B shared scene render targets. Differently sized scenes could repeatedly
  delete and allocate each other's targets during a crossfade. Targets now belong
  to each loop and input slot.
- New persistent **3D detail** selector: **Auto** starts with a scene budget of
  2560 × 1440 pixels and lowers only scene sampling if smoothed frame time exceeds
  18 ms. It cautiously restores detail after eight seconds of headroom. **Full** keeps the previous scene sampling. Output and feedback still use
  the selected Render resolution. Nebula keeps its existing half-size ceiling.
  Capture configurations retain their explicit scene dimensions. Auto targets
  approximately 60 FPS, not a guarantee for every shader, camera position, or
  combination of effects. Raymarch detail is a visual quality tradeoff.

## Measured results

Native output: **5372 × 2460** throughout. Before uses the camera rollback state
before these performance changes. FPS below is the first uninstrumented sample;
the accompanying JSON also records a second frame/passes sample.

| Scene | Before | Auto | Full after optimization |
| --- | ---: | ---: | ---: |
| mercury | 27.7 FPS | 60.0 FPS | 30.2 FPS |
| cubes | 34.5 FPS | 60.0 FPS | — |
| sponge | 46.8 FPS | 60.0 FPS | — |
| mandelbulb | 28.0 FPS | 58.0 FPS | 30.3 FPS |

Auto sampled the first three scenes at 2837 × 1299 and Mandelbulb at 2412 × 1104
in the second window. Mandelbulb settled at 60 FPS in that window after adaptation.
Full output and feedback remained 5372 × 2460. The genuine pass optimizations
alone provide modest gains at full scene detail; most of the FPS improvement
comes from rendering fewer 3D samples.

At 50% output resolution, the mixed Nebula/Mercury case allocated **120 textures
in 60 frames before**, versus **zero after** at Full detail. FPS in those two
samples was 49.0 before and 43.8 after: the allocation fix removes churn but this
measurement does not demonstrate a crossfade FPS improvement. Auto is still
needed for expensive combinations.

Raw results: [performance-results.json](performance-results.json).

## Reproduction

Run `npm run perf -- /tmp/phosphor-perf.json`. This starts an isolated local HTTP
server and a fresh Chrome profile, uses the hardware GPU, samples Mercury, Cubes,
Sponge, and Mandelbulb at native and 50% render resolution, and closes both when
finished. JSON includes uninstrumented RAF pacing, pass counts, target sizes, and
texture allocations in a second sample window. It does not insert GPU waits or
claim CPU submission time is GPU time.

Useful environment variables:

- `PERF_DETAIL=full`: compare optimizations at full scene detail.
- `PERF_SCENES=mercury,mandelbulb`, `PERF_SCALES=1`: select cases.
- `PERF_MIX=1 PERF_DETAIL=full PERF_SCALES=0.5`: exercise a Nebula/Mercury crossfade and assert
  settled frames allocate no textures.
- `PERF_BASELINE_DIR=/path/to/snapshot`: serve that directory's `app.js` and
  `shaders.js` in place of current versions for a before/after comparison.

Measurements sample live camera motion, so scene position and thermal/browser
conditions can change timings. Run comparisons without other browser tests.

## Validation

`npm run test:minimal` passes, including native/HiDPI/fullscreen dimensions,
persisted detail selection, audio sharing, mappings, Autopilot, and responsive UI.
`npm run test:music-response` passes for visible deformation, rotation, forward
pulse, and shimmer with a return to neutral. That fixed-pixel test selects Full
3D detail so adaptation cannot change its sampling grid between comparisons.
`npm run test:scene-recovery` and `npm run test:mappings` also pass. The hardware
crossfade benchmark asserts zero settled texture allocations at Full detail.
