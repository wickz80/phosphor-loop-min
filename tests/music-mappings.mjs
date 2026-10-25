import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const context = { window: {} };
vm.runInNewContext(
  await readFile(new URL('../js/audio/mappings.js', import.meta.url), 'utf8'),
  context
);
const { defaults, evaluate, sanitize } = context.window.PhosphorMappings;
const silent = { beat: 0, low: 0, mid: 0, high: 0 };
const kick = evaluate(defaults(), { ...silent, beat: 1 }, { bpmBeat: 1 });
assert.equal(kick.forward, 0.85);
assert.equal(kick.shimmer, 0);
assert.equal(kick.color, 0);
const percussion = evaluate(defaults(), { ...silent, mid: 1 }, null);
assert.equal(percussion.forward, 0);
assert.equal(percussion.shimmer, 0.4);
const disabled = evaluate(
  [{ source: 'kick', effect: 'none', strength: 100 }],
  { ...silent, beat: 1 },
  null
);
assert.equal(disabled.forward, 0);
const capped = evaluate(
  Array(3).fill({ source: 'kick', effect: 'forward', strength: 100 }),
  { ...silent, beat: 1 },
  null
);
assert.equal(capped.forward, 1);
const a = evaluate(defaults(), silent, { pitch: { midi: 69 }, tonal: 1 });
const b = evaluate(defaults(), silent, { pitch: { midi: 81 }, tonal: 1 });
const c = evaluate(defaults(), silent, { pitch: { midi: 72 }, tonal: 1 });
assert.equal(a.hue, b.hue);
assert.notEqual(a.hue, c.hue);
assert.equal(a.color, 0.55);
const restored = sanitize([
  { source: 'invalid', effect: 'invalid', strength: 500 },
]);
assert.equal(restored[0].source, 'bpm');
assert.equal(restored[0].effect, 'forward');
assert.equal(restored[0].strength, 100);
assert.equal(sanitize(null).length, 3);
console.log(
  'PASS: isolated sources, None, bounded stacking, pitch-class color, saved-data validation.'
);

// The default pulse follows the grid, regardless of irregular kick events.
assert.equal(
  evaluate(defaults(), { ...silent, beat: 1 }, { bpmBeat: 0 }).forward,
  0
);
assert.equal(evaluate(defaults(), silent, { bpmBeat: 1 }).forward, 0.85);
vm.runInNewContext(
  await readFile(new URL('../js/audio/beat-clock.js', import.meta.url), 'utf8'),
  context
);
vm.runInNewContext(
  await readFile(new URL('../js/audio/rhythm.js', import.meta.url), 'utf8'),
  context
);
const Clock = context.window.PhosphorBeatClock;
const clock = new Clock();
clock.setTempo(120, 0, 0);
const beats = [];
let previous = clock.read(0).gridBeat;
for (let i = 1; i <= 2000; i++) {
  const time = i / 200;
  const before = clock.read(time);
  if (i === 800 || i === 1600) {
    clock.setTempo(120, time + 0.06, time);
    assert.equal(
      clock.read(time).phase,
      before.phase,
      'analysis update cannot reset phase'
    );
  }
  const state = clock.read(time);
  if (state.gridBeat !== previous) beats.push(time);
  previous = state.gridBeat;
}
assert.ok(beats.length >= 19 && beats.length <= 20);
for (let i = 1; i < beats.length; i++)
  assert.ok(
    Math.abs(beats[i] - beats[i - 1] - 0.5) < 0.015,
    'steady beat despite shifted observations'
  );
const ctx = { currentTime: 0.5 };
const rhythm = new context.window.PhosphorRhythm(ctx, null);
rhythm.clock.setTempo(120, 0, 0);
rhythm.tempo = { bpm: 120, end: 0 };
rhythm.lastAudioTime = 0.5;
rhythm.features = { time: 0.5, rms: 0.1, lastKick: -1 };
assert.equal(rhythm.read().bpmBeat, 1, 'beat without detected kick');
rhythm.features.lastKick = 0.48;
assert.equal(rhythm.read().bpmBeat, 1, 'jittery kick cannot move the clock');
ctx.currentTime = 1.3;
rhythm.features.time = 1.3;
rhythm.features.rms = 0;
assert.equal(rhythm.read().bpmBeat, 0, 'mute after sustained silence');
ctx.currentTime = 20;
rhythm.features.time = 20;
rhythm.lastAudioTime = 20;
assert.equal(rhythm.read().bpmBeat, 0, 'expired tempo cannot pulse');
console.log(
  'PASS: continuous BPM grid, phase slew, kick independence, silence and stale-tempo handling.'
);

for (const effect of ['travel', 'surface', 'orbit', 'turn45', 'turn90']) {
  assert.equal(
    Object.hasOwn(context.window.PhosphorMappings.effects, effect),
    false
  );
}
assert.equal(
  sanitize([{ source: 'bass', effect: 'surface', strength: 70 }])[0].effect,
  'forward'
);
