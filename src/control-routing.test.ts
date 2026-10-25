import assert from 'node:assert/strict';
import { loadBrowserScripts } from '../tests/support/browser-scripts.ts';

const context = {
  window: loadBrowserScripts(['video-grade', 'control-routing']),
};
const routing = context.window.PhosphorControlRouting;
const grade = context.window.PhosphorVideoGrade;
const values = <Id extends string>(ids: readonly Id[]): Record<Id, number> =>
  Object.fromEntries(ids.map((id): [Id, number] => [id, 0])) as Record<
    Id,
    number
  >;
const loop = (): ControlModel['loops']['A'] => ({
  tgt: values(routing.loopIds),
  cur: values(routing.loopIds),
});
const state: ControlModel = {
  loops: { A: loop(), B: loop() },
  mix: { tgt: values(routing.mixIds), cur: values(routing.mixIds) },
  audio: { amount: 60 },
  autopilot: { every: 30, fade: 10, wild: 50, mix: 50, taste: 0 },
  adjustments: {
    video: { tracking: 0, bright: 0, contrast: 0, sat: 0, key: 0 },
  },
};
const changes: { target: RoutedControl; scope: ControlScope; value: number }[] =
    [],
  seeks: number[] = [];
const writer = routing.createWriter({
  getState: (): ControlModel => state,
  setGrade: grade.setSlider,
  seek: (value): number => seeks.push(value),
  onChange: (target, scope, value): number =>
    changes.push({ target, scope, value }),
});
for (const id of routing.loopIds) {
  assert.equal(writer.apply(id, 37, 'B'), true, id);
  assert.equal(state.loops.B.tgt[id], 37);
  assert.equal(state.loops.B.cur[id], 37);
  assert.equal(state.loops.A.tgt[id], 0, 'B never writes A');
}
assert.equal(writer.apply('view', 42, 'global'), true);
assert.equal(state.mix.tgt.view, 42);
assert.equal(state.mix.cur.view, 42);
assert.equal(writer.apply('adj-video-bright', 70, 'global'), true);
assert.equal(state.adjustments.video!.bright, 70);
assert.equal(writer.apply('videoGamma', 1.5, 'global'), true);
assert.equal(grade.state.videoGamma, 1.5);
assert.equal(writer.apply('sndAmt', 25, 'global'), true);
assert.equal(state.audio.amount, 25);
assert.equal(writer.apply('apWild', 80, 'global'), true);
assert.equal(state.autopilot.wild, 80);
assert.equal(writer.apply('vidPos', 100, 'global'), true);
assert.deepEqual(seeks, [100]);
const before = JSON.stringify(state),
  count = changes.length;
for (const [id, value, scope] of [
  ['flow', 5, 'global'],
  ['flow', 5, 'missing'],
  ['view', 5, 'A'],
  ['videoGamma', 2, 'B'],
  ['adj-video-bright', 4, 'A'],
  ['flow', NaN, 'A'],
  ['sndAmt', Infinity, 'global'],
  ['not-a-control', 1, 'global'],
  ['adj-video-missing', 1, 'global'],
  ['adj-video-bright-extra', 1, 'global'],
  ['adj-camera-bright', 1, 'global'],
] as const)
  assert.equal(
    writer.apply(id, value, scope as ControlScope),
    false,
    id + ' / ' + scope
  );
assert.equal(JSON.stringify(state), before);
assert.equal(changes.length, count);
for (const key of ['A:flow', 'B:trails', 'global:view'])
  assert.equal(routing.isAutopilotBinding(key), true);
for (const key of [
  'global:videoGamma',
  'global:adj-video-bright',
  'global:sndAmt',
  'global:apWild',
  'global:flow',
  'A:view',
  'A:flow:extra',
])
  assert.equal(routing.isAutopilotBinding(key), false, key);
assert.equal(routing.scopeFor('flow', 'B'), 'B');
assert.equal(routing.scopeFor('videoGamma', 'B'), 'global');
// State owners can replace restored objects; subsequent writes must use the current state.
state.autopilot = { ...state.autopilot, wild: 10 };
writer.apply('apWild', 20, 'global');
assert.equal(state.autopilot.wild, 20);
console.log(
  'PASS: compiled routing module writes real state, isolates every loop control, handles global/source controls, and rejects invalid IDs, scopes and non-finite values.'
);
