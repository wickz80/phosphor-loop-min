import { EssentiaWASM } from '../../vendor/essentia/essentia-wasm.es.js';
import Essentia from '../../vendor/essentia/essentia.js-core.es.js';
const engine = new Essentia(EssentiaWASM);
const rate = 44100, ring = new Float32Array(rate * 12);
let nextPitch = 2048;
let written = 0, next = ring.length, sourcePosition = 0, previous = 0, sourceRate = 0;
postMessage({ type: 'ready' });
self.onmessage = ({ data }) => {
  if (data.type === 'reset') { written = 0; next = ring.length; nextPitch = 2048; sourcePosition = 0; previous = 0; return; }
  if (data.type !== 'samples') return;
  postMessage({ type: 'ack' });
  const samples = data.samples;
  if (data.rate !== sourceRate) {
    sourceRate = data.rate; written = 0; next = ring.length; nextPitch = 2048; sourcePosition = 0; previous = 0;
  }
  // Stateful linear resampling: preserve fractional position across capture blocks.
  for (let i = 0; i < samples.length; i++) {
    while (sourcePosition <= 1) {
      ring[written++ % ring.length] = previous + (samples[i] - previous) * sourcePosition;
      sourcePosition += sourceRate / rate;
    }
    sourcePosition -= 1; previous = samples[i];
  }
  if (written >= nextPitch) {
    nextPitch = written + 5292; // roughly eight pitch estimates per second
    const frame = new Float32Array(2048);
    let power = 0;
    for (let i = 0; i < frame.length; i++) {
      frame[i] = ring[(written - frame.length + i) % ring.length];
      power += frame[i] * frame[i];
    }
    let input;
    try {
      if (power / frame.length > 0.00001) {
        input = engine.arrayToVector(frame);
        const pitch = engine.PitchYin(input, 2048, true, 1200, 110, rate, 0.15);
        postMessage({ type: 'pitch', hz: pitch.pitch, confidence: pitch.pitchConfidence, time: data.end });
      }
    } catch (_) { /* pitch is optional; keep rhythm analysis alive */ }
    finally { input?.delete(); }
  }
  if (written < next) return;
  next = written + rate * 4;
  const window = new Float32Array(ring.length);
  let energy = 0;
  for (let i = 0; i < window.length; i++) {
    const v = ring[(written + i) % ring.length]; window[i] = v; energy += v * v;
  }
  if (energy / window.length < 0.000001) {
    postMessage({ type: 'tempo', bpm: 0, confidence: 0, end: data.end, cost: 0 }); return;
  }
  let vector, result;
  const start = performance.now();
  try {
    vector = engine.arrayToVector(window);
    result = engine.RhythmExtractor2013(vector, 190, 'multifeature', 80);
    const ticks = engine.vectorToArray(result.ticks);
    postMessage({
      type: 'tempo', bpm: result.bpm, confidence: result.confidence,
      beatTime: ticks.length ? data.end - window.length / rate + ticks[ticks.length - 1] : null,
      end: data.end, cost: performance.now() - start
    });
  } catch (error) { postMessage({ type: 'error', message: error.message }); }
  finally {
    vector?.delete();
    if (result) for (const value of Object.values(result)) if (value?.delete) value.delete();
  }
};
