Phosphor Loop — minimal 3D visualizer

Browser-only proof of concept for a personal site. No build step.
Serve this folder over localhost or HTTPS (for example: python3 -m http.server 8000).
Keep that process running and open http://localhost:8000/ in Chrome or Edge.
Opening index.html as a file:// URL does not support the BPM/pitch analysis workers.

The page opens a 3D texture. Click Share audio, choose a tab playing music, and enable
Share tab audio in the browser picker. Screen/system audio can also be selected
when offered by your browser and operating system. No BlackHole installation or
microphone access is required. Desktop Chrome or Edge is the suggested starting
point; audio-capture support varies. If sharing is unavailable, visuals still work.

Sharing requires a user click and fresh permission each visit. Browser security
prevents automatically restoring screen/audio sharing after reload. If embedded
in another site, allow display-capture in the iframe's permissions policy.

Audio, Visualizer, and Autopilot are the three control sections. Choose a world or
fractal, adjust effects, or let Autopilot change looks. The current look,
audio response, and Autopilot settings persist in this browser. Space freezes,
P toggles Autopilot, L advances a look, and F toggles full screen.

Rendering follows the canvas's displayed dimensions multiplied by device pixel
ratio, including fullscreen. The top-right readout shows the actual internal pixel
resolution. Native (100%) is the default; choose 75% or 50% under Visualizer to reduce
output pixels. The persistent 3D detail selector offers:
- Auto: balance detail with about 60 FPS, adapting 3D sampling when frames run long.
- Smooth: prioritize the browser's measured display refresh, with fewer 3D march/
  shading samples and reduced internal effects resolution. Output stays at the
  selected Render resolution; fine detail and trails can look softer.
- Full: use every render pixel for 3D (Nebula retains its existing half sampling).
Refresh is measured at startup with rendering idle. Reload after changing display
refresh rates or moving the tab to a display with a different refresh rate. Browser
presentation settings can differ from a display's advertised maximum refresh.
The readout shows the internal effects resolution; in Smooth it may be lower than
the output canvas resolution. Capture configurations keep their explicit resolution.
Resizes preserve the feedback picture and
reallocate after the resize settles; time-warp history has a bounded memory budget.

Android packaging, phone camera pairing, QR codes, and the Android release workflow
have been deleted. The web layout still renders in mobile browsers. Taste training
and show mode are disabled; unused desktop controls remain isolated with the older
engine bindings for this initial simplification.

Verification: npm ci && npm run test:minimal
The browser test uses installed Google Chrome on macOS and simulated browser audio sharing.
It covers startup, controls, saved defaults, Autopilot, and responsive layout.
Actual capture sources depend on your browser and operating system.

Music response uses an AudioWorklet for continuous kick/band activity and an
Essentia.js 0.1.3 worker for tempo (12 seconds of history, refreshed every 4 seconds).
The BPM status and progress strip show estimated tempo and beat phase. The BEAT
light and default forward pulse follow a continuous BPM clock, independent of
individual kicks. They start after tempo is found (about 12 seconds), continue
through short gaps, and mute after sustained silence. Tempo updates gently steer
the clock rather than jumping its phase. Stale tempo expires after 16 seconds.
The overlay shows BPM beside resolution and FPS (Finding BPM while acquiring). Bands are approximate activity, not instrument separation.
Open Music mappings under Amount to configure three Sound → Effect → Strength
rows. Defaults: BPM beat → Forward pulse, Percussion → Light shimmer, and Dominant
pitch → Structure color (Scene color for worlds). None disables a row; Reset mappings
restores the defaults. Mappings persist with the look. Rotation accent and
Deformation also work with trails off. Multiple routes into one effect are capped.

Dominant pitch uses confidence-gated PitchYin estimates, not melody separation or
key detection. It can follow vocals or bass in a mix. Notes use consistent colors
across octaves, with smooth transitions and the last color held when uncertain.
Fractal color changes affect material shading without tinting the background.
Unsupported worklets retain basic audio response.

Essentia.js is distributed under AGPL-3.0; its license and upstream link are in
vendor/essentia/. The pinned assets are served locally without a CDN. Source for
this integration is in js/audio/. Synthetic audio checks: npm run test:rhythm.
Routing checks: npm run test:mappings.
Real-track detection quality and perceived capture latency still need listening tests.

Older saved Kick mappings upgrade to BPM beat once. Kick remains selectable for
attack-driven effects; a newly selected Kick mapping stays Kick on future reloads.

Mapping strength controls cover subtle through pronounced responses. The slider
fill follows its value, including after restoring or resetting mappings.
Rendered effect checks: npm run test:music-response (fixed-scene peak vs neutral).

Production deployment: pushes to main publish independently to https://wix.fyi/loop/.
See docs/deployment.md for the GitHub OIDC role, hosting integration, and checks.
