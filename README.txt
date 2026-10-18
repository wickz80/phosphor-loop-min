Phosphor Loop — minimal 3D visualizer

Browser-only proof of concept for a personal site. No build step.
Serve this folder over localhost or HTTPS (for example: python3 -m http.server 8000).

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
resolution. Native (100%) is the default; choose 75% or 50% under Visualizer for
slower GPUs. This preference persists. Resizes preserve the feedback picture and
reallocate after the resize settles; time-warp history has a bounded memory budget.

Android packaging, phone camera pairing, QR codes, and the Android release workflow
have been deleted. The web layout still renders in mobile browsers. Taste training
and show mode are disabled; unused desktop controls remain isolated with the older
engine bindings for this initial simplification.

Verification: npm ci && npm run test:minimal
The browser test uses installed Google Chrome on macOS and simulated browser audio sharing.
It covers startup, controls, saved defaults, Autopilot, and responsive layout.
Actual capture sources depend on your browser and operating system.
