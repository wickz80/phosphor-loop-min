# Global video controls

`04 / Video` holds output controls separately from per-loop texture effects. Picture sharpness and the original Screen shape control are moved here. `video-grade.js` supplies Gamma, Exposure, Contrast, Saturation, Hue rotation, RGB gains, Sepia mix and a two-hue luminance gradient. The latter's endpoint hues require Gradient mix above zero, with disabled-state tooltips.

Grading is applied once in FS_DISPLAY, after the two-loop composite and display/music transforms, before the final edge mask and clamp. It never feeds back into the loop textures or Autopilot's composite probe. Canvas captures and output-window copies include the result.

The global state persists under phosphor-global-video-v1. Defaults are identity: gamma/contrast/saturation/RGB gains = 1; exposure/hue/sepia/gradient mix = 0. Gamma is bounded to 0.25–3; exposure is -3 to +3 stops. The gradient maps luminance between shadow/highlight hues while preserving luminance before output clamping. Sepia blends a fixed warm channel matrix; channel gains and hue rotation offer raw filtering controls.

All global numeric controls participate in the existing LFO system with global scope. Their LFOs do not stop Autopilot. Reset video effects disables global grading LFOs and restores identity values, leaving sharpness, aspect ratio and texture settings intact.

Layout updates: playback buttons are always the first overlay grid row, with texture/readout text in the second row at the bottom edge. Buttons and selects use 1.1 line height, generally 11–12px type, with compact padding; main numbered headings use 15px text and no section separators. Slider label/help icons are grouped together to avoid the header flex gap pushing the icon away.

Passed: video-grade configuration, identity defaults, sanitization, persistence and reset tests; existing dependency, LFO and deployment tests; JS syntax and whitespace checks. GPU tests were added to test:shaders for neutral-output preservation, gamma, grayscale, sepia, red gain and gradient behavior. They have not been executed here because browser access/launch has been unavailable. Browser visual verification is pending.
