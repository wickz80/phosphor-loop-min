import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
const slice = (start, end) =>
  source.slice(
    source.indexOf(start),
    source.indexOf(end, source.indexOf(start))
  );
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
const context = {
  is3D: (src) => worlds.includes(src),
  liveActive: () => false,
  loops: { A: { tgt: {}, cur: {} }, B: { tgt: {}, cur: {} } },
  edit: 'A',
  mix: { tgt: { view: 0 } },
  weights: () => [1, 1],
  lookOnScreen: 0,
  clearLoop: () => {},
  takeOver: () => {},
  setDrift: () => {},
  markPreset: () => {},
  settleDevices: () => {},
  syncUI: () => {},
  saveSession: () => {},
};
vm.runInNewContext(
  slice('const SRC_ID =', '// The sliders under') +
    slice('const STARTERS =', '/* ================= state') +
    slice('function patchLoop(', 'function applyPatch(') +
    slice('const RECIPES =', 'function recipeBlocked(') +
    `this.visuals = {loopDefaults,inputDefaults,patchLoop,resetInputDefaults,RECIPES,STARTERS,supportedInput};`,
  context
);
const v = context.visuals;
assert.equal(
  v.loopDefaults().trails,
  0,
  'missing fields never default to long trails'
);
for (const src of [
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
]) {
  const defaults = v.inputDefaults(src);
  assert.equal(defaults.in1, src);
  assert.equal(defaults.trails, 0, src + ' starts clean');
  v.patchLoop('A', defaults, true);
  assert.equal(
    context.loops.A.tgt.in1,
    src,
    src + ' is accepted by preset loading'
  );
}
for (const name of [
  'Fractal garden',
  'Shattered mirror',
  'Prism',
  'Kaleidoscope drawing',
  'Marbled',
]) {
  const recipe = v.RECIPES.find((r) => r.name === name);
  assert.ok(recipe, name);
  v.patchLoop('A', recipe.patch.A, true);
  for (const [key, value] of Object.entries(recipe.patch.A))
    if (key !== 'shift')
      assert.equal(context.loops.A.tgt[key], value, name + ' retains ' + key);
}
const bloom = v.STARTERS.find((r) => r.name === 'Bloom');
assert.equal(bloom.A.mirror, 6);
v.patchLoop('A', { ...bloom.A, textureLook: 'Bloom' }, true);
assert.equal(context.loops.A.tgt.in1, 'wave');
v.patchLoop('B', { in1: 'shape', trails: 42 }, true);
const other = JSON.stringify(context.loops.B);
v.resetInputDefaults('mercury');
assert.equal(
  context.loops.A.tgt.textureLook,
  null,
  'reset clears the named selection'
);
assert.equal(context.loops.A.tgt.trails, 0);
assert.equal(context.loops.A.cur.trails, 0, 'old feedback stops immediately');
assert.equal(context.loops.A.tgt.size, 100, 'main world starter lens size');
assert.equal(
  JSON.stringify(context.loops.B),
  other,
  'reset only affects the edited loop'
);
v.patchLoop('A', { in1: 'cameraSphere', in2: 'missing' }, true);
assert.equal(context.loops.A.tgt.in1, 'mercury');
assert.equal(context.loops.A.tgt.in2, 'none');

// Verify the real session sanitizer keeps ordinary 2D inputs and drops live sources.
Object.assign(context, {
  LAST_KEY: 'session',
  camDeviceId: '',
  loopbackDeviceId: '',
  lsGet: () =>
    JSON.stringify({
      look: {
        A: {
          in1: 'shape',
          julia: 100,
          trails: 90,
          textureLook: 'Fractal garden',
        },
        B: { in1: 'patchwork', trails: 0 },
      },
    }),
  loadPreset: ({ data }) => {
    v.patchLoop('A', data.A, true);
    v.patchLoop('B', data.B, true);
  },
  showOSD: () => {},
  toast: () => {},
  setAutopilot: () => {},
});
vm.runInNewContext(
  slice('function restoreSession()', 'function offlineStatus()') +
    'this.restore = restoreSession;',
  context
);
assert.equal(context.restore(), true);
assert.equal(
  context.loops.A.tgt.textureLook,
  'Fractal garden',
  'named texture survives reload'
);
assert.equal(context.loops.A.tgt.in1, 'shape');
assert.equal(context.loops.A.tgt.julia, 100);
assert.equal(
  context.loops.A.tgt.trails,
  90,
  'saved deliberate settings survive'
);
assert.equal(context.loops.B.tgt.in1, 'patchwork');
assert.equal(context.loops.B.tgt.trails, 0);
context.lsGet = () =>
  JSON.stringify({ look: { A: { in1: 'camera' }, B: { in1: 'video' } } });
context.restore();
assert.equal(context.loops.A.tgt.in1, 'mercury');
assert.equal(context.loops.B.tgt.in1, 'cavern');
console.log(
  'PASS: clean source defaults, original 2D recipes, A/B isolation, unsupported-input fallback, and 2D session restore without device prompts.'
);
