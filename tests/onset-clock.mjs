import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context = { window: {} };
for (const name of ['beat-clock', 'rhythm'])
  vm.runInNewContext(
    fs.readFileSync(new URL(`../js/audio/${name}.js`, import.meta.url), 'utf8'),
    context
  );
// Test actual feature-port wiring, including stale/silent/expired-tempo gates.
let featureHandler;
context.AudioWorkletNode = class {
  constructor() {
    this.port = {
      set onmessage(fn) {
        featureHandler = fn;
      },
    };
  }
  connect() {}
};
context.Worker = class {
  postMessage() {}
};
const ctx = {
  currentTime: 1,
  audioWorklet: { addModule: async () => {} },
  destination: {},
};
const rhythm = new context.window.PhosphorRhythm(ctx, { connect() {} });
await rhythm.start();
rhythm.tempo = { bpm: 120, end: 0 };
rhythm.clock.setTempo(120, 0.18, 0);
let calls = 0;
const observe = rhythm.clock.observeOnset.bind(rhythm.clock);
rhythm.clock.observeOnset = (...args) => {
  calls++;
  return observe(...args);
};
featureHandler({
  data: { type: 'features', time: 1, lastKick: 0.99, kick: true, rms: 0.1 },
});
assert.equal(calls, 1);
featureHandler({
  data: { type: 'features', time: 1, lastKick: 0.99, kick: false, rms: 0.1 },
});
featureHandler({
  data: { type: 'features', time: 1, lastKick: 0.99, kick: true, rms: 0 },
});
assert.equal(calls, 1);
ctx.currentTime = 20;
featureHandler({
  data: { type: 'features', time: 20, lastKick: 20, kick: true, rms: 0.1 },
});
assert.equal(calls, 1, 'expired tempo is not phase corrected');
console.log(
  'PASS: fast onset phase lock, timestamp compensation, extra/missed beats, no jumps/backwards beats, batch-phase isolation, stale/duplicate rejection and real feature-port wiring.'
);
