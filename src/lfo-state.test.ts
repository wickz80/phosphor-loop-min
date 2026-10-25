import assert from 'node:assert/strict';
import { loadBrowserScripts } from '../tests/support/browser-scripts.ts';
const context = {
  window: loadBrowserScripts([
    'video-grade',
    'control-routing',
    'lfo-engine',
    'lfo-state',
  ]),
};
const state = context.window.PhosphorLFOState,
  engineApi = context.window.PhosphorLFOEngine;
const limits = { min: -100, max: 100, step: 1 };
const config = { enabled: true, x: -20, y: 80, beats: 4, curve: 'sine' };
const raw = {
  'A:spin': { ...config, x: -1000 },
  'B:spin': { ...config, y: 50 },
  'global:videoGamma': config,
  'global:spin': config,
  'A:videoGamma': config,
  'A:spin:extra': config,
  'A:missing': config,
  'A:trails': null,
  'global:view': [],
  'global:sndAmt': 'bad',
};
const restored = state.restore(
  raw,
  (id): { min: number; max: number; step: number } | null =>
    ['spin', 'videoGamma'].includes(id) ? limits : null
);
assert.deepEqual(Object.keys(restored), [
  'A:spin',
  'B:spin',
  'global:videoGamma',
]);
assert.equal(restored['A:spin'].x, -100);
assert.equal(restored['B:spin'].y, 50);
for (const invalid of [null, [], 42, 'broken'])
  assert.equal(
    Object.keys(
      state.restore(
        invalid,
        (): { min: number; max: number; step: number } => limits
      )
    ).length,
    0
  );
const written: [string, number][] = [],
  events: [string, string?][] = [];
const engine = engineApi.createEngine({
  bindings: restored,
  resolve: (
    key
  ): {
    key: string;
    limits: { min: number; max: number; step: number };
  } | null =>
    ['A:spin', 'B:spin', 'global:videoGamma'].includes(key)
      ? { key, limits }
      : null,
  apply: (target, value): number => written.push([target.key, value]),
});
const actions = state.createActions(
  engine,
  (key): number => events.push(['enable', key]),
  (): number => events.push(['change'])
);
actions.release('A:spin');
assert.equal(engine.bindings['A:spin'].enabled, false);
assert.equal(engine.bindings['B:spin'].enabled, true);
const before = events.length;
actions.release('A:spin');
assert.equal(events.length, before, 'manual release is idempotent');
assert.equal(actions.commit('A:spin', config), true);
assert.equal(events.filter((e): boolean => e[0] === 'enable').length, 1);
actions.commit('A:spin', { ...config, beats: 8 });
assert.equal(
  events.filter((e): boolean => e[0] === 'enable').length,
  1,
  'editing settings does not retrigger ownership'
);
assert.equal(actions.commit('A:missing', config), false);
actions.reset('A:spin', (): void => {
  assert.equal(
    engine.bindings['A:spin'].enabled,
    false,
    'release before resetting value'
  );
  events.push(['reset']);
});
engine.tick(1);
assert.ok(
  written.every(([key]): boolean => key !== 'A:spin'),
  'reset value cannot be overwritten next frame'
);
assert.ok(
  written.some(([key]): boolean => key === 'B:spin'),
  'reset leaves other loop running'
);
for (const value of [
  0,
  99,
  100,
  -100,
  -180,
  1.25,
  -0.125,
  1000,
  1e20,
  NaN,
  Infinity,
])
  assert.ok(state.formatReadout(value).length <= 3, String(value));
assert.equal(state.formatReadout(1000), '1k');
assert.equal(state.formatReadout(-180), '-1…');
assert.equal(state.formatReadout(NaN), '—');
console.log(
  'PASS: LFO restore validation, A/B isolation, enable/manual/reset transitions and compact readouts.'
);
