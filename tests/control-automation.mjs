import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(
  new URL('../js/app.js', import.meta.url),
  'utf8'
);
const part = (start, end) => {
  const first = source.indexOf(start),
    last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, 'app integration boundary exists');
  return source.slice(first, last);
};
const bindings = {
  'A:flow': true,
  'B:trails': true,
  'global:view': true,
  'global:videoGamma': true,
  'global:adj-video-bright': true,
  'global:sndAmt': true,
};
const events = [];
const context = {
  window: {},
  localStorage: { getItem: () => null, setItem() {} },
  ap: { pins: new Set() },
  watch: {},
  apSet: { touch: 'play' },
  edit: 'A',
  loops: { A: { cur: { flow: 24, trails: 50 } }, B: {} },
  mix: { cur: { view: 42 } },
  LOOP_SLIDERS: ['flow', 'trails'],
  MIX_SLIDERS: ['view'],
  sliderEls: { flow: { value: 0 }, trails: { value: 0 }, view: { value: 0 } },
  showSlider: (id) => events.push(id),
  document: { documentElement: { classList: { toggle() {} } } },
  apBtns: [],
  performance: { now: () => 100 },
  eyeReset() {},
  setDrift() {},
  apEverySec: () => 30,
  apIntoLimits() {},
  settleDevices() {},
  syncUI() {},
  apStatus() {},
  showOSD() {},
  toast() {},
  lfoUI: {
    disableWhere: (predicate) => {
      for (const key of Object.keys(bindings))
        if (predicate(key)) bindings[key] = false;
    },
  },
};
vm.createContext(context);
for (const file of ['video-grade', 'control-routing'])
  vm.runInContext(
    fs.readFileSync(new URL(`../js/${file}.js`, import.meta.url), 'utf8'),
    context
  );
vm.runInContext(
  part('function isAutopilotSlider(', 'function applyAutomatedSlider(') +
    part('function setAutopilot(', '// Manual controls play along'),
  context
);
context.setAutopilot(true, true);
for (const key of ['A:flow', 'B:trails', 'global:view'])
  assert.equal(bindings[key], false, key);
for (const key of [
  'global:videoGamma',
  'global:adj-video-bright',
  'global:sndAmt',
])
  assert.equal(bindings[key], true, key);
context.syncAutomationSliders();
assert.equal(Number(context.sliderEls.flow.value), 24);
assert.equal(Number(context.sliderEls.view.value), 42);
const before = events.length;
context.syncAutomationSliders();
assert.equal(
  events.length,
  before,
  'unchanged frames avoid redundant UI writes'
);
Object.assign(context, {
  snd: { analyser: {}, amount: 0, rhythmSample: { gridBeat: 10 } },
  apSet: { beat: true },
  ap: { beatWait: null, rush: false },
  apStep: (now, onBeat) => events.push(['step', onBeat]),
});
vm.runInContext(part('function apTick(', 'function apStep('), context);
context.apTick(100);
assert.ok(context.ap.beatWait);
context.snd.rhythmSample.gridBeat = 11;
context.apTick(200);
assert.ok(
  events.some((e) => Array.isArray(e) && e[0] === 'step' && e[1] === true)
);
console.log(
  'PASS: app integration respects typed ownership, updates live readouts and aligns beats at zero Amount.'
);
