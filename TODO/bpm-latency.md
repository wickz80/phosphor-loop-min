# BPM timing investigation and onset alignment

The original investigation below was read-only. On user approval, onset-based phase alignment was subsequently implemented without changing libraries or the batch BPM acquisition window.

## Current timing path

- `tempo-worker.js`: twelve seconds of history at 44.1 kHz; recompute every four seconds with Essentia RhythmExtractor2013 multifeature. The current working tree already uses an 80–190 BPM range; that existing edit was not made by this UI task.
- Beat timestamps are mapped from their analysis window back to the audio clock, so a batch window does not inherently impose twelve seconds of steady-state visual delay.
- `rhythm-worklet.js`: feature/onset messages approximately every 10 ms; sample chunks are 2048 frames (about 43 ms at 48 kHz).
- `beat-clock.js`: continuous extrapolation at the estimated BPM; tempo eases with a four-second time constant; phase corrects at no more than 0.015 beats per second. A wrong phase can therefore linger.
- The AudioContext already requests `latencyHint: 'interactive'`; adding the same hint would not be a new improvement.
- LFO sine cycles start at X and reach Y halfway through N beats. A visual maximum is not necessarily meant to occur at the instant of a beat. At N=2 and 120 BPM the first maximum is half a second after the cycle starts.

## Recommended order if approved later

1. Measure beat-indicator timing separately from LFO maxima, using a known click track. Distinguish steady phase error from wrong BPM, capture delay, display delay and intentionally eased animation. Add an explicit timing-offset/calibration control only after measuring.
2. Keep a stable tempo estimate but correct clock phase using reliable worklet onsets near predicted beats. Use a bounded phase-locked clock, confidence gating and missing-beat prediction rather than resetting on every drum hit. This is the smallest likely useful improvement to steady synchronization.
3. For faster acquisition/tempo changes, evaluate shorter windows/more frequent estimation, accepting accuracy and CPU tradeoffs. A faster batch algorithm alone does not fix phase alignment. Essentia Degara is faster than multifeature but supplies no confidence, so the current confidence gate must be adapted if it is used.
4. Consider an online tracker such as aubio if the current batch pipeline remains limiting. It accepts successive analysis hops and exposes beat timestamps, BPM/confidence and delay adjustment; integration would require a browser/WASM implementation and benchmarking.

## Sources checked

- Essentia tutorial explicitly notes that RhythmExtractor2013 relies on whole-track statistics and is not suited to real-time detection; it contrasts faster Degara with slower multifeature: https://essentia.upf.edu/tutorial_rhythm_beatdetection.html
- Algorithm parameters/confidence: https://essentia.upf.edu/reference/std_RhythmExtractor2013.html
- Aubio's block-based tempo API and delay controls: https://aubio.org/doc/latest/tempo_8h.html
- AudioContext output clock/presentation timestamps: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/getOutputTimestamp

The output timestamp API can help align rendering when the same context produces audible audio. Here the analyzed capture stream feeds a silent worklet, so that API alone cannot reveal the source tab's full audible capture delay. End-to-end measurement is still needed.

## Implemented onset alignment

`Rhythm` now consumes timestamped kick onsets directly from the existing 10 ms worklet feature messages. It calls `BeatClock.observeOnset` only for audible, fresh input while a tempo estimate is still valid.

Three tempo-consistent onsets establish an initial phase reference. Once established, only hits within 0.18 beats of the predicted grid can refine phase; half-beat extras and hits closer than 0.75 periods are ignored. Missing beats are predicted by the clock. Onsets older than 250 ms, future timestamps and duplicates are rejected.

The clock uses the measured onset timestamp, compensating for message delivery age. It slews continuously at no more than 0.35 beats/second with a 0.2-second settling constant while onset timing is fresh; it never resets position or moves backward. A fresh onset reference takes precedence over a batch window's phase for four seconds. Without fresh onsets, the previous conservative batch-only correction remains available.

No new library was added. No BPM-window/cadence change was made. Initial acquisition still needs the existing history. This corrects beat alignment rather than promising lower end-to-end capture or display latency.

`npm run test:onset-clock` passed simulations with positive/negative phase offsets, 30–80 ms message delivery delays, offbeat extras, missed beats, duplicate/stale onsets and batch phase updates. It also exercises the actual feature-message handler in Rhythm. Existing mapping/clock tests pass. Browser/music-listening verification remains pending.

Useful real-time documentation:
- Essentia OnsetDetection exposes a per-frame detection score and describes 1024-frame/512-hop analysis at 44.1 kHz (11.6 ms hop resolution), with onset post-processing required: https://essentia.upf.edu/reference/streaming_OnsetDetection.html
- Essentia Onsets describes adaptive thresholds, smoothing and a configurable frame-based filter window; a streaming API name alone should not be read as a guarantee of zero lookahead or total latency: https://essentia.upf.edu/reference/streaming_Onsets.html
