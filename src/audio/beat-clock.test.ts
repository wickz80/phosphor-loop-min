import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadBrowserScripts } from '../../tests/support/browser-scripts.ts';

const Clock = loadBrowserScripts(['audio/beat-clock']).PhosphorBeatClock;
const wrap = (value: number): number => (((value % 1) + 1.5) % 1) - 0.5;
interface Scenario {
  offset?: number;
  extras?: boolean;
  drop?: boolean;
  delivery?: number;
}
interface SimulationResult {
  accepted: number;
  maxError: number;
  wentBackwards: boolean;
  jumped: boolean;
  targetBpm: number;
}
function simulate({
  offset = 0.18,
  extras = false,
  drop = false,
  delivery = 0.03,
}: Scenario): SimulationResult {
  const clock = new Clock();
  clock.setTempo(120, offset, 0);
  const events: number[] = [];
  for (let time = 0.5; time <= 10; time += 0.5) {
    if (!(drop && time >= 4 && time <= 5)) events.push(time);
    if (extras) events.push(time + 0.25);
  }
  events.sort((a, b): number => a - b);
  let next = 0,
    previous = clock.position,
    accepted = 0,
    wentBackwards = false,
    jumped = false;
  const errors: number[] = [];
  for (let frame = 1; frame <= 2200; frame++) {
    const now = frame / 200;
    clock.read(now);
    while (next < events.length && events[next] + delivery <= now) {
      const before = clock.position;
      if (clock.observeOnset(events[next++], now)) accepted++;
      jumped ||= clock.position !== before;
    }
    if (frame === 800 || frame === 1600) clock.setTempo(120, now + 0.15, now);
    const value = clock.read(now);
    wentBackwards ||= clock.position < previous;
    previous = clock.position;
    if (now >= 3) errors.push(Math.abs(wrap(value.phase - now * 2)) * 0.5);
  }
  return {
    accepted,
    maxError: Math.max(...errors),
    wentBackwards,
    jumped,
    targetBpm: clock.targetBpm,
  };
}

describe('Beat clock phase correction', (): void => {
  const scenarios: [string, Scenario][] = [
    ['regular onsets', {}],
    ['extra offbeats', { extras: true }],
    ['missing beats', { drop: true }],
    [
      'negative phase offset and delayed delivery',
      { offset: -0.2, delivery: 0.08 },
    ],
  ];
  for (const [name, scenario] of scenarios) {
    it(`settles continuously with ${name}`, (): void => {
      const input = { ...scenario };

      const result = simulate(input);

      assert.ok(result.accepted >= 8);
      assert.ok(
        result.maxError < 0.03,
        `phase error: ${result.maxError} seconds`
      );
      assert.equal(result.wentBackwards, false);
      assert.equal(result.jumped, false);
      assert.equal(result.targetBpm, 120);
    });
  }

  it('keeps a steady grid when tempo observations shift phase', (): void => {
    const clock = new Clock();
    clock.setTempo(120, 0, 0);
    const beats: number[] = [];
    let previous = clock.read(0).gridBeat;
    let phaseReset = false;

    for (let frame = 1; frame <= 2000; frame++) {
      const now = frame / 200;
      const before = clock.read(now);
      if (frame === 800 || frame === 1600) {
        clock.setTempo(120, now + 0.06, now);
        phaseReset ||= clock.read(now).phase !== before.phase;
      }
      const state = clock.read(now);
      if (state.gridBeat !== previous) beats.push(now);
      previous = state.gridBeat;
    }

    assert.equal(phaseReset, false);
    assert.ok(beats.length >= 19 && beats.length <= 20);
    for (let index = 1; index < beats.length; index++)
      assert.ok(Math.abs(beats[index] - beats[index - 1] - 0.5) < 0.015);
  });

  it('rejects stale, future and non-finite onset timestamps', (): void => {
    const clock = new Clock();
    clock.setTempo(120, 0, 0);

    const stale = clock.observeOnset(0.5, 1);
    const future = clock.observeOnset(2, 1);
    const invalid = clock.observeOnset(NaN, 1);

    assert.equal(stale, false);
    assert.equal(future, false);
    assert.equal(invalid, false);
  });

  it('rejects duplicate and offbeat hits after acquiring phase', (): void => {
    const clock = new Clock();
    clock.setTempo(120, 0, 0);
    for (const onset of [0.5, 1, 1.5]) clock.observeOnset(onset, onset + 0.01);

    const duplicate = clock.observeOnset(1.5, 1.52);
    const aligned = clock.read(1.52).phase;
    const offbeat = clock.observeOnset(1.75, 1.76);

    assert.equal(duplicate, false);
    assert.equal(offbeat, false);
    assert.ok(Math.abs(wrap(aligned - 0.04)) < 0.01);
  });
});
