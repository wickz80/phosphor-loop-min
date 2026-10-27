import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadBrowserScripts } from '../tests/support/browser-scripts.ts';

const api = loadBrowserScripts(['lfo-engine']).PhosphorLFOEngine;
const limits: LfoLimits = { min: -100, max: 100, step: 1 };
interface TestTarget extends LfoTarget {
  key: string;
}
function createEngine(bindings: Record<string, LfoConfig> = {}): {
  engine: LfoEngine;
  calls: [string, number][];
} {
  const calls: [string, number][] = [];
  const engine = api.createEngine({
    bindings,
    resolve: (key): TestTarget => ({ key, limits }),
    apply: (target, value): void => {
      calls.push([target.key, value]);
    },
  });
  return { engine, calls };
}

describe('LFO engine', (): void => {
  it('preserves endpoints and stays bounded at every supported cycle length', (): void => {
    for (const beats of api.BEATS) {
      const config = { x: -40, y: 60, beats };

      const endpoints = [0, 0.25, 0.5, 0.75, 1].map((fraction): number =>
        api.valueAt(config, fraction * beats)
      );
      const sweep = Array.from({ length: 500 }, (_, index): number =>
        api.valueAt(config, index / 73)
      );

      for (const [index, expected] of [-40, 10, 60, 10, -40].entries())
        assert.ok(Math.abs(endpoints[index] - expected) < 1e-9);
      assert.ok(sweep.every((value): boolean => value >= -40 && value <= 60));
    }
    assert.equal(
      api.valueAt({ x: 90, y: -10, beats: 4 }, 2),
      -10,
      'reversed ranges'
    );
  });

  it('sanitizes invalid bounds, timing and legacy curve settings', (): void => {
    const dirty = { enabled: true, x: -1000, y: Infinity, beats: 0 };

    const actual = api.sanitize(dirty, limits);
    const invalidCurve = api.sanitize({ curve: 'invalid' }, limits);
    const legacy = api.sanitize({}, limits);

    assert.equal(actual.x, -100);
    assert.equal(actual.y, 100);
    assert.equal(actual.beats, 4);
    assert.equal(invalidCurve.curve, 'sine');
    assert.equal(legacy.curve, 'sine');
  });

  it('advances independent bindings and ignores disabled ones', (): void => {
    const { engine, calls } = createEngine();
    engine.set('A:spin', { enabled: true, x: -20, y: 40, beats: 4 });
    engine.set('B:spin', { enabled: true, x: 10, y: 50, beats: 8 });
    engine.set('global:amount', { enabled: false, x: 0, y: 100, beats: 1 });

    engine.tick(2);

    assert.deepEqual(calls, [
      ['A:spin', 40],
      ['B:spin', 30],
    ]);
  });

  it('holds values during missing tempo or freeze', (): void => {
    const { engine, calls } = createEngine();
    engine.set('A:spin', { enabled: true, x: -20, y: 40, beats: 4 });

    engine.tick(null);
    engine.tick(NaN);
    engine.tick(3, true);

    assert.equal(calls.length, 0);
  });

  it('disables one loop without stopping the other and restores saved motion', (): void => {
    const { engine, calls } = createEngine();
    engine.set('A:spin', { enabled: true, x: -20, y: 40, beats: 4 });
    engine.set('B:spin', { enabled: true, x: 10, y: 50, beats: 8 });
    engine.set('A:spin', { ...engine.bindings['A:spin'], enabled: false });

    engine.tick(4);
    const restored = createEngine(JSON.parse(JSON.stringify(engine.bindings)));
    restored.engine.tick(6);

    assert.deepEqual(calls, [['B:spin', 50]]);
    assert.deepEqual(restored.calls, [['B:spin', 30]]);
  });

  for (const curve of ['sine', 'linear', 'log', 'exp'] as const) {
    it(`${curve} sweeps monotonically outward and symmetrically back`, (): void => {
      const config = api.sanitize(
        { enabled: true, x: -60, y: 40, beats: 4, curve },
        limits
      );

      const outward = Array.from({ length: 101 }, (_, index): number =>
        api.valueAt(config, index / 50)
      );
      const returning = Array.from({ length: 101 }, (_, index): number =>
        api.valueAt(config, 4 - index / 50)
      );

      assert.equal(config.curve, curve);
      assert.ok(Math.abs(api.valueAt(config, 0) + 60) < 1e-8);
      assert.ok(Math.abs(api.valueAt(config, 2) - 40) < 1e-8);
      assert.ok(Math.abs(api.valueAt(config, 4) + 60) < 1e-8);
      for (const [index, value] of outward.entries()) {
        assert.ok(value >= -60 - 1e-9 && value <= 40 + 1e-9);
        if (index > 0) assert.ok(value >= outward[index - 1] - 1e-9);
        assert.ok(Math.abs(value - returning[index]) < 1e-8);
      }
    });
  }

  it('gives linear, log and exponential curves distinct intermediate values', (): void => {
    const base = { x: 0, y: 100, beats: 4 };

    const linear = api.valueAt({ ...base, curve: 'linear' }, 1);
    const log = api.valueAt({ ...base, curve: 'log' }, 1);
    const exp = api.valueAt({ ...base, curve: 'exp' }, 1);

    assert.equal(linear, 50);
    assert.ok(log > 50);
    assert.ok(exp < 50);
  });
});
