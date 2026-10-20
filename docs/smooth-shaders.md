# Shader simplification and Smooth mode

Follow-up on 2026-10-19. Previous camera rollback and music mappings are preserved.

## Shader changes

- Mercury: compute the seven animated blob centers/radii once per draw in JS and
  upload a uniform array. Distance/normal/reflection evaluations no longer carry
  the animation trig. Intersect both primary and floor-reflection rays with a
  conservative sphere before marching. Its radius includes the maximum expansion
  of all six smooth unions, plus a small numerical margin.
- Mandelbulb: replace polar/azimuth inverse trig and trig with three algebraic
  angle doublings for the power-eight fold. Replace fractional/integer powers with
  multiplications and the already-needed square root. The mathematical shape is
  unchanged; float rounding differs slightly.
- Fractal flights: traverse with distance-only evaluations, then obtain the orbit
  trap/color at the final hit. This lets the shader compiler discard trap work
  during traversal and normal/AO samples. Skip material-tint work when disabled.
- Smooth only: cap fractal traversal at 76 rather than 110 steps and AO at two
  rather than four samples; use a pixel-sized hit tolerance. Mercury uses 64
  primary/28 reflection steps rather than 90/50. This is a quality tradeoff.

## Frame pacing

**Auto** remains the balanced ~60 FPS choice. **Smooth — prioritize frame rate**
uses an idle startup RAF calibration, rather than mistaking slow loaded rendering
for the display refresh. The policy detects 60/120/144/165 Hz in synthetic tests
with missed refreshes. A background-tab timeout falls back to 60 Hz.

Both adaptive modes react after sustained misses within ~400 ms, with a smoothed
threshold 8% above their frame interval. Detail bottoms out at 30% linear scale
and recovers by 5% only after eight seconds of good pacing to avoid quality pumping.

Smooth starts with a ~2.1-million-pixel 3D budget and limits internal feedback/
effects to ~3.7 million pixels. Its display pass still uses the selected output
resolution. Native output therefore remains native, while scene detail, trails,
and other effects can become softer. Full and capture settings retain their
specified sampling. Refresh calibration runs once at load; reload after changing
monitors/refresh settings. This is a target, not a guaranteed high-refresh lock.

## Results and verification

Installed Chrome reported `ANGLE Metal Renderer: Apple M3 Max`. Canvas output was
5372 × 2460. The fresh before/after run measured:

| Scene | Previous Full | Simplified Full | Smooth |
| --- | ---: | ---: | ---: |
| Mercury | 54.5 FPS | 60.0 FPS | 60.0 FPS |
| Mandelbulb | 55.1 FPS | 60.0 FPS | 60.0 FPS |

Smooth also held ~60 FPS for Cubes and Sponge. Smooth used a 2837 × 1299 effects
buffer and a 2128 × 974 scene buffer in the final sample. All settled sample
windows allocated zero textures. The test's headless animation clock is only
60 Hz: these results establish neither 120 nor 165 FPS, nor the amount of extra
GPU headroom above 60. Live camera motion and system conditions affect timings;
earlier runs had lower baseline FPS. [Raw samples](smooth-shader-results.json).

Full-detail standalone image checks compare seven shaders with the earlier
version at four time/camera positions, including deeper dives. Maximum measured
mean error was <0.05/255 per color channel. Smooth outputs remain nonblack; visual
inspection of paired Mercury, Mandelbulb, and Mandelbox renders confirms softer/
lighter shading with the scene structure intact. The existing startup, saved
settings, music response, scene recovery, and mapping tests pass.

Commands:

- `npm run test:render-quality`: calibration, missed-refresh response, hysteresis,
  recovery, and bounds at 60/120/144/165 Hz.
- `npm run test:shaders`: image equivalence and Smooth rendering. Set
  `SHADER_BASELINE=/path/to/shaders.js` to use a saved baseline, and optionally
  `SHADER_PREVIEW_DIR=/tmp/previews` to save paired Full/Smooth renders.
- `PERF_DETAIL=smooth PERF_SCALES=1 npm run perf -- /tmp/smooth.json`.

## Web API versus hardware

The measured renderer already translates WebGL to Metal through ANGLE; it is not
using software rendering or necessarily Apple's legacy desktop OpenGL driver.
[ANGLE's documentation](https://github.com/google/angle/blob/main/doc/DebuggingTips.md)
describes the Metal backend and WebGL entry points. WebGL has validation and
command submission costs, and the browser/OS controls presentation timing.

Our evidence points primarily to per-pixel shader work and intermediate-buffer
traffic: reducing the work improves performance without changing APIs. This is
consistent with [Khronos's fragment-bound performance guidance](https://wikis.khronos.org/opengl/Performance).
It does not quantify how much an equivalent native Metal implementation would
save. WebGPU/native could enable different algorithms and resource strategies,
but simply switching API does not remove the same raymarching arithmetic and
pixel traffic. Assigning a percentage to browser overhead would require a
matched native baseline, which this project does not have.
