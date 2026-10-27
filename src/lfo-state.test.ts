import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadBrowserScripts } from '../tests/support/browser-scripts.ts';

const limits: LfoLimits = { min: -100, max: 100, step: 1 };
const config: LfoConfig = {
  enabled: true,
  x: -20,
  y: 80,
  beats: 4,
  curve: 'sine',
};
interface StateFixture {
  state: LfoStateApi;
  engine: LfoEngine;
  actions: LfoBindingActions;
  written: [string, number][];
  enabled: string[];
  changes: string[];
}
function createFixture(): StateFixture {
  const { PhosphorLFOState: state, PhosphorLFOEngine: api } =
    loadBrowserScripts([
      'video-grade',
      'control-routing',
      'lfo-engine',
      'lfo-state',
    ]);
  const written: [string, number][] = [],
    enabled: string[] = [],
    changes: string[] = [];
  const engine = api.createEngine({
    bindings: { 'A:spin': { ...config }, 'B:spin': { ...config, y: 50 } },
    resolve: (key): (LfoTarget & { key: string }) | null =>
      ['A:spin', 'B:spin'].includes(key) ? { key, limits } : null,
    apply: (target, value): void => {
      written.push([target.key, value]);
    },
  });
  const actions = state.createActions(
    engine,
    (key): void => {
      enabled.push(key);
    },
    (): void => {
      changes.push('change');
    }
  );
  return { state, engine, actions, written, enabled, changes };
}

describe('LFO UI state', (): void => {
  it('restores valid bindings, clamps their limits and rejects invalid shapes/scopes', (): void => {
    const { state } = createFixture();
    const saved = {
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

    const restored = state.restore(saved, (id): LfoLimits | null =>
      ['spin', 'videoGamma'].includes(id) ? limits : null
    );
    const invalidRoots = [null, [], 42, 'broken'].map(
      (raw): Record<string, LfoConfig> =>
        state.restore(raw, (): LfoLimits => limits)
    );

    assert.deepEqual(Object.keys(restored), [
      'A:spin',
      'B:spin',
      'global:videoGamma',
    ]);
    assert.equal(restored['A:spin'].x, -100);
    assert.equal(restored['B:spin'].y, 50);
    assert.ok(
      invalidRoots.every((value): boolean => Object.keys(value).length === 0)
    );
  });

  it('releases manual control once without stopping the other loop', (): void => {
    const { engine, actions, changes } = createFixture();

    actions.release('A:spin');
    actions.release('A:spin');

    assert.equal(engine.bindings['A:spin'].enabled, false);
    assert.equal(engine.bindings['B:spin'].enabled, true);
    assert.equal(changes.length, 1);
  });

  it('claims ownership only when enabling, not when editing enabled settings', (): void => {
    const { actions, enabled, engine } = createFixture();
    actions.release('A:spin');

    const accepted = actions.commit('A:spin', config);
    actions.commit('A:spin', { ...config, beats: 8 });
    const unknown = actions.commit('A:missing', config);

    assert.equal(accepted, true);
    assert.equal(unknown, false);
    assert.deepEqual(enabled, ['A:spin']);
    assert.equal(engine.bindings['A:spin'].beats, 8);
  });

  it('stops modulation before resetting so the next frame cannot overwrite the reset', (): void => {
    const { engine, actions, written } = createFixture();
    let enabledAtReset: boolean | undefined;

    actions.reset('A:spin', (): void => {
      enabledAtReset = engine.bindings['A:spin'].enabled;
    });
    engine.tick(1);

    assert.equal(enabledAtReset, false);
    assert.ok(written.every(([key]): boolean => key !== 'A:spin'));
    assert.ok(written.some(([key]): boolean => key === 'B:spin'));
  });

  it('keeps readouts within three characters with explicit fallback for invalid values', (): void => {
    const { state } = createFixture();
    const values = [
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
    ];

    const readouts = values.map((value): string => state.formatReadout(value));

    assert.ok(readouts.every((text): boolean => text.length <= 3));
    assert.equal(state.formatReadout(1000), '1k');
    assert.equal(state.formatReadout(-180), '-1…');
    assert.equal(state.formatReadout(NaN), '—');
  });
});
