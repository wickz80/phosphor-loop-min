# Product and Autopilot audit

2026-10-25. Follow-up: the controls/automation pass now fixes source-adjustment LFO writes, makes Autopilot disable competing loop/mix LFOs (including restored startup state), applies scene prerequisites, refreshes live Autopilot values and decouples beat gating from audio Amount. `npm run test:control-automation` exercises the actual app functions; dependency tests cover scene normalization. The findings and sampling below describe the pre-fix audit snapshot. Browser/GPU verification remains pending. Broader registry/persistence/legacy cleanup remains open in `TODO/`.

Scope: current min working tree after upstream visual imports, LFOs, global video grading and UI simplification.

## Delivered UI simplification

Only the tiny per-slider reset and per-top-level-section reset controls remain exposed. Pin controls and the editable music-mapping section are removed. Saved pins are no longer restored; saved custom music routes are ignored on load in favor of fixed default reactions. Amount remains available. The future mapping-editor note is in [music-mapping-return.md](../TODO/music-mapping-editor.md). Hidden legacy controls still exist for compatibility; removing those implementations is separate cleanup.

## Autopilot coverage

| Feature | Current behavior | Gap / intended policy |
| --- | --- | --- |
| Restored worlds and fractals | Included when supported; all 15 shaders enter the fixture's pool | Weights favor worlds; comments and implementation disagree about the intended share |
| Restored 2D inputs | Wave, Shape, Bars, Sparks, Ink and Patchwork participate | Named UI recipes are not all explicit Autopilot candidates |
| Camera, screen, video, spectrum | Candidates depend on available media/audio | Correctly avoids selecting unavailable live sources |
| A/B loops | Scene switching, crossfades, crossfeed and world build-up ramps | Some generated effects are hidden from the simplified controls |
| Effect prerequisites | UI disables unavailable sliders | Scene generation does not enforce the same prerequisites |
| LFOs | Enabling a texture LFO stops Autopilot | Restarting Autopilot leaves LFOs active; both can write the same parameter |
| Global grading | Remains independent of Autopilot; global LFOs can coexist | Sensible master-look policy, but needs an explicit scope indicator |
| Output protection | Eye checks reject pathological composites | Checks run before global grading, so do not assess final graded brightness |
| Beat alignment | Scene changes can wait for a beat, with timeout | Depends on nonzero audio Amount; no musical phrase/drop understanding |
| UI feedback | Scene changes update controls | Ramps write model values without corresponding continuous slider refresh |

### Confirmed integration defects

1. **Source-adjustment LFO routing is incomplete.** The LFO callback in `js/app.js` handles loop, mix, audio Amount, Autopilot, grading and video position IDs, but not `adj-*`. A source-extracted callback test requested video brightness 70 and the model remained 0. The LFO module separately moves the DOM slider, so this can appear to work visually while having no image effect. Evidence: [automation-routing-audit.json](automation-routing-audit.json).
2. **Autopilot and LFO ownership can conflict.** The enable callback stops Autopilot, but the reverse path does not reconcile existing LFOs. Frame ordering lets LFO writes override the scene's current values. Define one owner per parameter or an explicit modulation composition rule; do not restore pins.
3. **Generated scenes can contain inactive feedback effects.** The dependency module protects manual UI, but is not consulted by scene generation. Trails-zero scenes may still have nonzero warp/flow/spin or other feedback parameters.
4. **Invisible state remains.** Autopilot can manipulate effects absent from the current sidebar. Legacy saved limits/allowlists can also constrain behavior without an exposed editor. Simplified UI needs equally simplified, inspectable state.

### Sampling evidence and limits

A deterministic source-extraction fixture used all 15 scene shaders, no live media/audio, mix=50 and wild=50, seed 4025, starting from clean Mercury/Cavern looks. Of 20,000 source picks, 62.1% were world/showcase picks, with another 3.6% ordinary fractal input picks. Of 5,000 raw scene candidates, 45.7% combined Trails zero with at least one nonzero feedback effect, and 99.4% contained at least one effect hidden from the simplified UI. No candidate carried the new named-texture metadata.

These are **raw candidates before validation, limits, ramping and display duration**, not rendered screen-time percentages or a performance benchmark. Some hidden state has little visible effect. Full results and fixture description: [autopilot-audit-samples.json](autopilot-audit-samples.json). Exact named recipes may be approximated randomly; missing metadata alone does not prove a look is unreachable.

## Product assessment

The strongest direction is a lightweight browser visual instrument: select a look, share sound, make a few understandable adjustments and let it evolve. Two feedback loops, restored 3D worlds, beat-driven motion and final-output grading are a useful combination. More controls are currently less valuable than predictable controls and recoverable looks.

The biggest user-facing gaps are:

- **Trust:** the moving-slider/no-effect case, conflicting automation and hidden state undermine confidence. Disabled controls are a good improvement, but prerequisites must apply everywhere.
- **Recall:** `snapshot()` saves loops, mix, adjustments and audio state, while LFO and video-grade settings use separate local-storage records. A portable complete look/session needs a versioned schema, import/export and a clear distinction between scene settings and master output. Media will still require browser permissions or re-selection.
- **Musical direction:** current Autopilot is a scene randomizer with image-quality heuristics. Curated families, intensity limits and repeatable playlists would improve it more than additional random parameters. Initial tempo acquisition still uses the existing history; the fast onset phase path does not establish a measured end-to-end latency guarantee. Add tempo/phase diagnostics and manual tap/resync before promising tight sync.
- **Scope:** distinguish selected loop, shared source adjustments, audio and final output. Source adjustments are shared per source, whereas texture settings are per loop; users cannot reliably infer that from a slider alone.
- **Reliability and access:** cover startup layout, sidebar scrolling, keyboard/touch operation, media lifecycle and clear offline/build status. Recording/output infrastructure exists but much of its UI is hidden; decide what this product actually exposes before adding more integrations.

Comparable products suggest patterns, not a feature checklist. [Resolume](https://resolume.com/support/parameter-animation) makes parameter animation modes explicit and supports beat-based timing and audio analysis. [Synesthesia](https://synesthesia.live/docs/manual/presets.html) treats presets, favorites and playlists as a core workflow, including separate scene/meta/media recall. [TouchDesigner's LFO](https://derivative.ca/UserGuide/LFO_CHOP) exposes waveform and reset behavior. The useful lessons here are clear ownership, complete recall and deliberate sequencing; a node editor or full professional VJ suite would be unnecessary scope.

## Technical assessment

The integration layer has substantial debt. `js/app.js` is 7,292 lines combining DOM wiring, state, renderer coordination, audio, Autopilot, media, storage and legacy tools. `js/shaders.js` is 2,378 lines, but shader volume itself is normal for this kind of app. More concerning is duplicated knowledge of parameter IDs/defaults/dependencies across manual handlers, LFO dispatch, resets, persistence and scene generation. The confirmed adjustment-routing gap is a direct example.

There is useful engineering to retain: the rendering and audio engines, asynchronous image checks, allocation fallbacks, feedback-preserving resize work, and newer isolated LFO/grading/dependency modules. A wholesale rewrite would discard that work without automatically fixing the ownership model.

Incrementally introduce a parameter registry with scope, get/set, default, dependency, formatter, automation policy and serialization. Route existing manual/LFO/reset paths through it, then split state, automation and DOM coordination out of the large app. Retire inactive legacy surfaces after coverage; for example, the excluded Ribbit scene still schedules a build at startup (`app.js:678`). Profile before claiming it is a significant bottleneck.

Historical performance reports predate the restored shader/quality pipeline and final grading. Rebaseline current GPU timings, allocation behavior and output resolutions; do not reuse old FPS numbers as current evidence.

## Recommended sequence

1. Fix source-adjustment LFO writes and automation ownership. Add regression checks that assert actual model/output changes, not only thumb movement.
2. Make Autopilot dependency-aware, refresh its visible values and constrain generation to understandable scene families/effects. Decide whether final-output safety should inspect grading without silently undoing a user's master look.
3. Unify complete look/session persistence and make save/restore accessible. Keep the mapping editor deferred.
4. Establish browser/GPU interaction coverage and current performance/audio-latency measurements; add build/version visibility to reduce stale-service-worker confusion.
5. Extract the shared registry and retire unused legacy wiring incrementally. Expand features only after these paths are reliable.

## Validation boundary

Findings combine source tracing, deterministic candidate sampling and isolated routing tests. Node checks can validate state/math/contracts; they cannot establish visual quality, GPU correctness or perceived audio timing. Browser/GPU tests were not executable in this environment, and rendered layout needs local verification. This report does not claim the identified integration defects have been repaired.
