import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import vm from 'node:vm';
import { readScript, section } from '../tests/support/legacy-scripts.ts';

type Look = Record<string, unknown>;
interface VisualApi {
  loopDefaults(): Look;
  inputDefaults(source: string): Look;
  patchLoop(loop: 'A' | 'B', look: Look, force: boolean): void;
  resetInputDefaults(source: string): void;
  RECIPES: { name: string; patch: { A: Look } }[];
  STARTERS: { name: string; A: Look }[];
}
interface VisualFixture {
  visuals: VisualApi;
  loops: Record<'A' | 'B', { tgt: Look; cur: Look }>;
  restore(saved: unknown): boolean;
}
const worlds = [
  'cubes',
  'horizon',
  'cavern',
  'blackhole',
  'aurora',
  'mercury',
  'fractal',
  'nebula',
  'city',
  'sponge',
  'mandelbulb',
  'mandelbox',
  'sierpinski',
  'julia3d',
  'kaleido',
];
const source = readScript('js/app.js');
function createFixture(): VisualFixture {
  const loops = {
    A: { tgt: {} as Look, cur: {} as Look },
    B: { tgt: {} as Look, cur: {} as Look },
  };
  const context = vm.createContext({
    is3D: (input: string): boolean => worlds.includes(input),
    liveActive: (): boolean => false,
    loops,
    edit: 'A',
    mix: { tgt: { view: 0 } },
    weights: (): number[] => [1, 1],
    lookOnScreen: 0,
    clearLoop(): void {},
    takeOver(): void {},
    setDrift(): void {},
    markPreset(): void {},
    settleDevices(): void {},
    syncUI(): void {},
    saveSession(): void {},
  });
  // Compatibility extraction until these state functions become an importable module.
  vm.runInContext(
    section(source, 'const SRC_ID =', '// The sliders under') +
      section(source, 'const STARTERS =', '/* ================= state') +
      section(source, 'function patchLoop(', 'function applyPatch(') +
      section(source, 'const RECIPES =', 'function recipeBlocked(') +
      'this.visuals = {loopDefaults,inputDefaults,patchLoop,resetInputDefaults,RECIPES,STARTERS};',
    context
  );
  const visuals = context.visuals as VisualApi;
  Object.assign(context, {
    LAST_KEY: 'session',
    camDeviceId: '',
    loopbackDeviceId: '',
    loadPreset: ({ data }: { data: { A: Look; B: Look } }): void => {
      visuals.patchLoop('A', data.A, true);
      visuals.patchLoop('B', data.B, true);
    },
    showOSD(): void {},
    toast(): void {},
    setAutopilot(): void {},
  });
  vm.runInContext(
    section(source, 'function restoreSession()', 'function offlineStatus()') +
      'this.restore = restoreSession;',
    context
  );
  return {
    visuals,
    loops,
    restore(saved): boolean {
      context.lsGet = (): string => JSON.stringify(saved);
      return context.restore();
    },
  };
}

describe('Visualizer defaults and session compatibility', (): void => {
  it('starts every supported plain input without accumulated trails', (): void => {
    const { visuals, loops } = createFixture();
    const inputs = [
      ...worlds,
      'patchwork',
      'wave',
      'shape',
      'bars',
      'sparks',
      'ink',
      'text',
      'spectro',
      'picture',
      'video',
      'camera',
      'screen',
      'loop',
      'none',
    ];

    const results = inputs.map(
      (input): { input: string; defaults: Look; loaded: unknown } => {
        const defaults = visuals.inputDefaults(input);
        visuals.patchLoop('A', defaults, true);
        return { input, defaults, loaded: loops.A.tgt.in1 };
      }
    );

    assert.equal(visuals.loopDefaults().trails, 0);
    for (const result of results) {
      assert.equal(result.defaults.in1, result.input);
      assert.equal(result.defaults.trails, 0, result.input);
      assert.equal(result.loaded, result.input);
    }
  });

  it('preserves the deliberate values of named feedback recipes', (): void => {
    const { visuals, loops } = createFixture();
    const names = [
      'Fractal garden',
      'Shattered mirror',
      'Prism',
      'Kaleidoscope drawing',
      'Marbled',
    ];

    for (const name of names) {
      const recipe = visuals.RECIPES.find(
        (entry): boolean => entry.name === name
      );
      if (!recipe) throw new Error(`Missing recipe ${name}`);

      visuals.patchLoop('A', recipe.patch.A, true);

      for (const [key, value] of Object.entries(recipe.patch.A))
        if (key !== 'shift')
          assert.equal(loops.A.tgt[key], value, name + ' / ' + key);
    }
  });

  it('resets only the selected loop and clears its named look and old feedback', (): void => {
    const { visuals, loops } = createFixture();
    const bloom = visuals.STARTERS.find(
      (entry): boolean => entry.name === 'Bloom'
    );
    if (!bloom) throw new Error('Missing Bloom starter');
    visuals.patchLoop('A', { ...bloom.A, textureLook: 'Bloom' }, true);
    visuals.patchLoop('B', { in1: 'shape', trails: 42 }, true);
    const untouched = JSON.stringify(loops.B);
    const previousInput = loops.A.tgt.in1;

    visuals.resetInputDefaults('mercury');

    assert.equal(bloom.A.mirror, 6);
    assert.equal(previousInput, 'wave');
    assert.equal(loops.A.tgt.textureLook, null);
    assert.equal(loops.A.tgt.trails, 0);
    assert.equal(loops.A.cur.trails, 0);
    assert.equal(loops.A.tgt.size, 100);
    assert.equal(JSON.stringify(loops.B), untouched);
  });

  it('replaces unsupported saved inputs with supported defaults', (): void => {
    const { visuals, loops } = createFixture();

    visuals.patchLoop('A', { in1: 'cameraSphere', in2: 'missing' }, true);

    assert.equal(loops.A.tgt.in1, 'mercury');
    assert.equal(loops.A.tgt.in2, 'none');
  });

  it('restores named 2D looks and deliberate feedback settings', (): void => {
    const { restore, loops } = createFixture();
    const saved = {
      look: {
        A: {
          in1: 'shape',
          julia: 100,
          trails: 90,
          textureLook: 'Fractal garden',
        },
        B: { in1: 'patchwork', trails: 0 },
      },
    };

    const restored = restore(saved);

    assert.equal(restored, true);
    assert.equal(loops.A.tgt.textureLook, 'Fractal garden');
    assert.equal(loops.A.tgt.in1, 'shape');
    assert.equal(loops.A.tgt.julia, 100);
    assert.equal(loops.A.tgt.trails, 90);
    assert.equal(loops.B.tgt.in1, 'patchwork');
    assert.equal(loops.B.tgt.trails, 0);
  });

  it('does not restore live camera or local-video permissions from storage', (): void => {
    const { restore, loops } = createFixture();
    const saved = { look: { A: { in1: 'camera' }, B: { in1: 'video' } } };

    restore(saved);

    assert.equal(loops.A.tgt.in1, 'mercury');
    assert.equal(loops.B.tgt.in1, 'cavern');
  });
});
