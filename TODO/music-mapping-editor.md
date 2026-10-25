# Deferred music-mapping editor

The mapping editor has been removed from the active UI at the user's request. Default BPM pulse, percussion shimmer and pitch-color reactions remain, with the global audio Amount slider. Old editable route data in presets is ignored on load so removed controls cannot leave invisible custom behavior. The routing evaluator and analysis engine remain for audio response and a possible future editor.

A future version should expose a small set of clear musical macros before restoring a modulation matrix. Use named sources, effect prerequisites, a consistent amount scale and explicit ownership against LFOs/Autopilot. Include audition/disable, reset, persistence in a unified project schema, and device/tempo status. Do not bring back pinning with this UI.

The older mapping unit tests still validate the underlying evaluator, not an exposed editing feature. Browser tests should verify that the editor and old pin controls are absent and that default audio reactions continue.
