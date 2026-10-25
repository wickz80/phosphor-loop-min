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

Audio, Visualizer, and Autopilot are the three control sections. Choose an input,
adjust effects, or let Autopilot change looks. The current look,
audio response, and Autopilot settings persist in this browser. Space freezes,
P toggles Autopilot, L advances a look, and F toggles full screen.

Rendering uses the main app's Picture sharpness control:
- Auto starts at 576 lines and raises detail while frames stay smooth. It backs off
  when rendering slows, with a delay before retrying an unsuccessful level.
- Standard keeps 576 lines for the lightest rendering load.
- High draws up to 1080 lines, depending on the displayed size.
- Full follows the display up to 4K, subject to graphics and memory limits.
The resolution readout shows the internal feedback size. The output canvas may
have a different resolution. Effects retain their size when sharpness changes;
resizes preserve feedback. Capture sessions keep their configured resolution.

Under Visualizer, select Loop A or Loop B to edit its input and effects. What you
see blends between A, both loops, and B; choosing an input does not change the
other loop. Choosing a plain input resets only that loop to clean defaults with
Trails off. Reset input defaults also clears effects from an existing saved look.
Input size widens or narrows the 3D camera view. Fractals use the main
app's Glide camera, with an independent route per loop.

The 2D patterns include Wave, Shape, Bars, Sparks, Ink, Patchwork, Text and
Spectrograph. The Texture dropdown's 2D looks group contains the main app's Bloom kaleidoscope,
Fractal garden (Julia feedback), Coral, Ink, Ribbons, Shattered mirror, Prism,
Marbled and Kaleidoscope drawing. Named looks keep their original recipe values,
including long Trails when the effect requires feedback. Kaleidoscope drawing
starts blank: drag on the display to draw. More effects exposes Fractal fold,
Crystal, Color chase, Grow and Mirror along with the other feedback controls.

Every visible numeric slider has a tiny LFO checkbox. When enabled, drag the two
orange ticks on the slider to set its From/To bounds; the numbers are shown on
the ticks. The ticks also support arrow keys, Shift+arrow for larger steps, and
Home/End. Dragging the main knob instead returns that slider to manual control.
The knob's center is orange in LFO mode and bright green in manual mode.
N sets the full From → To → From cycle to 1/8, 1/4, 1/2, 1, 2, 4, 8, 16, 32 or
64 beats. The adjacent tiny curve selector offers Sine (the original default),
Linear, Log and Exp. Log/Exp shape normalized motion, so negative and reversed
ranges work too. The slider and readout follow the modulation each rendered frame.
Loop A and B have independent settings; audio reactions and Autopilot are shared.
LFOs wait until shared audio has a tracked BPM. Silence/tempo loss holds the
current value; Freeze pauses modulation, and resuming rejoins the BPM grid.
Texture LFOs stop Autopilot and auto-drift to give them control; global Video
LFOs run independently alongside Autopilot. Turning the
checkbox off holds its last value. Settings persist in this browser separately
from looks. Reset input defaults resets the underlying look; disable its LFOs
as well if you want the values to stay still.

Picture, Video, Camera, Screen and Other loop inputs expose their original source
controls. Video includes seeking, speed, playback and repeat points. Loaded media
are shared across loops. Camera permission is requested only when you select the
Camera input; audio sharing does not request a microphone. You can also drop a
picture or video onto the display. Local files and live sources need selecting
again after reload. Neutral resets both loops and shows loop A.

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
Music reactions use fixed defaults: BPM beat → Forward pulse, Percussion → Light
shimmer, and Dominant pitch → Structure color (Scene color for worlds). Amount
controls their overall strength. The editable music-mapping section has been
removed; see TODO/music-mapping-editor.md for the deferred design.

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

Rendered effect checks: npm run test:music-response (fixed-scene peak vs neutral).

Production deployment: pushes to main publish independently to https://wix.fyi/loop/.
See docs/deployment.md for the GitHub OIDC role, hosting integration, and checks.

Control descriptions now live behind inline ? buttons beside their labels. Hover,
focus with the keyboard, or tap to read them; Escape dismisses the tooltip. Live
audio/tempo status and actionable messages remain visible. The control UI uses
smaller semibold Barlow text rather than the former terminal-style typeface.

The whole workspace stays at the viewport width and height. Only the right
controls column scrolls; the canvas and header stay fixed, including on reload.

Beat alignment uses fresh kick onsets from the existing 10 ms audio worklet to
steer the BPM clock. Three consistent hits establish phase; nearby hits refine
it continuously without resetting the beat counter. Extra offbeat hits are
rejected and missing beats are predicted. Initial BPM acquisition still uses
the existing Essentia history; no new audio library is required.

Unavailable sliders are disabled and dimmed. Their label tooltips explain what
is needed: feedback effects require Trails above zero, Blend needs a second
input, and audio response needs shared audio. The four
main sections can be collapsed independently; their state is remembered. Button
help appears on hover or focus without an extra question-mark control.

04 / Video contains global output controls: picture sharpness, screen shape,
gamma, exposure, contrast, saturation, hue rotation, red/green/blue gains, sepia
mix and a shadow-to-highlight hue gradient. These affect the combined final
image, including recordings and the output window; they do not modify either
loop's feedback. Neutral defaults preserve the original colors. Global settings
persist independently from looks. Reset video effects restores neutral grading
and stops LFOs on the global grading controls; it leaves quality and textures alone.
