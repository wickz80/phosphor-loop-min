import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import vm from 'node:vm';
import { installScripts } from '../../tests/support/legacy-scripts.ts';

interface Features {
  type?: 'features';
  time: number;
  rms: number;
  lastKick: number;
  kick?: boolean;
}
interface RhythmInstance {
  start(): Promise<void>;
  read(): { bpmBeat: number } | null;
  clock: PhosphorBeatClock;
  tempo: { bpm: number; end: number };
  lastAudioTime: number;
  features: Features;
}
interface FakeAudioContext {
  currentTime: number;
  audioWorklet: { addModule(): Promise<void> };
  destination: object;
}
interface RhythmFixture {
  rhythm: RhythmInstance;
  audio: FakeAudioContext;
  observeCalls: number[];
  send(features: Features): void;
}
async function createFixture(): Promise<RhythmFixture> {
  let receive: ((event: { data: Features }) => void) | null = null;
  class FakeWorklet {
    port = {
      set onmessage(handler: ((event: { data: Features }) => void) | null) {
        receive = handler;
      },
    };
    connect(): void {}
  }
  class FakeWorker {
    postMessage(): void {}
  }
  const context = vm.createContext({
    window: {},
    AudioWorkletNode: FakeWorklet,
    Worker: FakeWorker,
  });
  installScripts(context, ['js/audio/beat-clock.js', 'js/audio/rhythm.js']);
  const Rhythm = context.window.PhosphorRhythm as new (
    audio: FakeAudioContext,
    source: { connect(): void }
  ) => RhythmInstance;
  const audio: FakeAudioContext = {
    currentTime: 1,
    audioWorklet: { addModule: async (): Promise<void> => {} },
    destination: {},
  };
  const rhythm = new Rhythm(audio, { connect(): void {} });
  await rhythm.start();
  if (!receive) throw new Error('Rhythm did not install its feature handler');
  rhythm.tempo = { bpm: 120, end: 0 };
  rhythm.clock.setTempo(120, 0, 0);
  const observeCalls: number[] = [];
  const observe = rhythm.clock.observeOnset.bind(rhythm.clock);
  rhythm.clock.observeOnset = (time, now): boolean => {
    observeCalls.push(time);
    return observe(time, now);
  };
  return {
    rhythm,
    audio,
    observeCalls,
    send(features): void {
      receive?.({ data: { ...features, type: 'features' } });
    },
  };
}

describe('Rhythm feature wiring', (): void => {
  it('forwards fresh audible kicks to the beat clock', async (): Promise<void> => {
    const fixture = await createFixture();

    fixture.send({ time: 1, lastKick: 0.99, kick: true, rms: 0.1 });

    assert.deepEqual(fixture.observeCalls, [0.99]);
  });

  it('does not phase-correct from non-kicks, silence or expired tempo', async (): Promise<void> => {
    const fixture = await createFixture();

    fixture.send({ time: 1, lastKick: 0.99, kick: false, rms: 0.1 });
    fixture.send({ time: 1, lastKick: 0.99, kick: true, rms: 0 });
    fixture.audio.currentTime = 20;
    fixture.send({ time: 20, lastKick: 20, kick: true, rms: 0.1 });

    assert.equal(fixture.observeCalls.length, 0);
  });

  it('reads the continuous grid independently of jittery kicks', async (): Promise<void> => {
    const { rhythm, audio } = await createFixture();
    audio.currentTime = 0.5;
    rhythm.lastAudioTime = 0.5;
    rhythm.features = { time: 0.5, rms: 0.1, lastKick: -1 };

    const withoutKick = rhythm.read();
    rhythm.features.lastKick = 0.48;
    const jitteryKick = rhythm.read();

    assert.equal(withoutKick?.bpmBeat, 1);
    assert.equal(jitteryKick?.bpmBeat, 1);
  });

  it('mutes the grid after sustained silence or expired tempo', async (): Promise<void> => {
    const { rhythm, audio } = await createFixture();
    rhythm.lastAudioTime = 0.5;
    audio.currentTime = 1.3;
    rhythm.features = { time: 1.3, rms: 0, lastKick: 0.48 };

    const silent = rhythm.read();
    audio.currentTime = 20;
    rhythm.features.time = 20;
    rhythm.lastAudioTime = 20;
    const expired = rhythm.read();

    assert.equal(silent?.bpmBeat, 0);
    assert.equal(expired?.bpmBeat, 0);
  });
});
