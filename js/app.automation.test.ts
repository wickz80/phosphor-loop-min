import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import vm from 'node:vm';
import {
  readScript,
  section,
  installScripts,
} from '../tests/support/legacy-scripts.ts';

interface AutomationFixture {
  bindings: Record<string, boolean>;
  sliderEls: Record<string, { value: number }>;
  events: (string | [string, boolean])[];
  start(): void;
  sync(): void;
  beatTransition(): boolean;
}
const source = readScript('js/app.js');
function createFixture(): AutomationFixture {
  const bindings: Record<string, boolean> = {
    'A:flow': true,
    'B:trails': true,
    'global:view': true,
    'global:videoGamma': true,
    'global:adj-video-bright': true,
    'global:sndAmt': true,
  };
  const events: AutomationFixture['events'] = [];
  const sliderEls = {
    flow: { value: 0 },
    trails: { value: 0 },
    view: { value: 0 },
  };
  const context = vm.createContext({
    window: {},
    localStorage: { getItem: (): null => null, setItem(): void {} },
    ap: { pins: new Set() },
    watch: {},
    apSet: { touch: 'play' },
    edit: 'A',
    loops: { A: { cur: { flow: 24, trails: 50 } }, B: {} },
    mix: { cur: { view: 42 } },
    LOOP_SLIDERS: ['flow', 'trails'],
    MIX_SLIDERS: ['view'],
    sliderEls,
    showSlider: (id: string): void => {
      events.push(id);
    },
    document: { documentElement: { classList: { toggle(): void {} } } },
    apBtns: [],
    performance: { now: (): number => 100 },
    eyeReset(): void {},
    setDrift(): void {},
    apEverySec: (): number => 30,
    apIntoLimits(): void {},
    settleDevices(): void {},
    syncUI(): void {},
    apStatus(): void {},
    showOSD(): void {},
    toast(): void {},
    lfoUI: {
      disableWhere: (predicate: (key: string) => boolean): void => {
        for (const key of Object.keys(bindings))
          if (predicate(key)) bindings[key] = false;
      },
    },
  });
  installScripts(context, ['js/video-grade.js', 'js/control-routing.js']);
  vm.runInContext(
    section(
      source,
      'function isAutopilotSlider(',
      'function applyAutomatedSlider('
    ) +
      section(
        source,
        'function setAutopilot(',
        '// Manual controls play along'
      ),
    context
  );
  return {
    bindings,
    sliderEls,
    events,
    start(): void {
      vm.runInContext('setAutopilot(true, true)', context);
    },
    sync(): void {
      vm.runInContext('syncAutomationSliders()', context);
    },
    beatTransition(): boolean {
      const audio = { analyser: {}, amount: 0, rhythmSample: { gridBeat: 10 } };
      Object.assign(context, {
        snd: audio,
        apSet: { beat: true },
        ap: { beatWait: null, rush: false },
        apStep: (_now: number, onBeat: boolean): void => {
          events.push(['step', onBeat]);
        },
      });
      vm.runInContext(
        section(source, 'function apTick(', 'function apStep('),
        context
      );
      vm.runInContext('apTick(100)', context);
      const wasWaiting = context.ap.beatWait !== null;
      audio.rhythmSample.gridBeat = 11;
      vm.runInContext('apTick(200)', context);
      return wasWaiting;
    },
  };
}

// Preserve existing integration checks only; Autopilot is deferred for redesign.
describe('Existing automation integration', (): void => {
  it('releases loop/mix LFOs while retaining independent controls', (): void => {
    const fixture = createFixture();

    fixture.start();

    for (const key of ['A:flow', 'B:trails', 'global:view'])
      assert.equal(fixture.bindings[key], false, key);
    for (const key of [
      'global:videoGamma',
      'global:adj-video-bright',
      'global:sndAmt',
    ])
      assert.equal(fixture.bindings[key], true, key);
  });

  it('refreshes readouts without rewriting unchanged values', (): void => {
    const fixture = createFixture();

    fixture.sync();
    const firstWrites = fixture.events.length;
    fixture.sync();

    assert.equal(Number(fixture.sliderEls.flow.value), 24);
    assert.equal(Number(fixture.sliderEls.view.value), 42);
    assert.equal(fixture.events.length, firstWrites);
  });

  it('retains existing beat alignment when music response is muted', (): void => {
    const fixture = createFixture();

    const wasWaiting = fixture.beatTransition();

    assert.equal(wasWaiting, true);
    assert.ok(
      fixture.events.some(
        (event): boolean =>
          Array.isArray(event) && event[0] === 'step' && event[1]
      )
    );
  });
});
