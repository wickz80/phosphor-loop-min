import assert from 'node:assert/strict';
import { loadBrowserScripts } from '../../tests/support/browser-scripts.ts';
const context = { window: loadBrowserScripts(['audio/beat-clock']) };
const Clock = context.window.PhosphorBeatClock;
const wrap = (value: number): number => (((value % 1) + 1.5) % 1) - 0.5;
function simulate({
  offset = 0.18,
  extras = false,
  drop = false,
  delivery = 0.03,
} = {}): PhosphorBeatClock {
  const clock = new Clock();
  clock.setTempo(120, offset, 0);
  const events = [];
  for (let time = 0.5; time <= 10; time += 0.5) {
    if (!(drop && time >= 4 && time <= 5)) events.push(time);
    if (extras) events.push(time + 0.25);
  }
  events.sort((a, b): number => a - b);
  let next = 0,
    previous = clock.position,
    accepted = 0;
  const errors = [];
  for (let i = 1; i <= 2200; i++) {
    const now = i / 200;
    clock.read(now);
    while (next < events.length && events[next] + delivery <= now) {
      const before = clock.position;
      if (clock.observeOnset(events[next++], now)) accepted++;
      assert.equal(
        clock.position,
        before,
        'onset never resets phase immediately'
      );
    }
    if (i === 800 || i === 1600) clock.setTempo(120, now + 0.15, now);
    const value = clock.read(now);
    assert.ok(clock.position >= previous, 'clock never runs backwards');
    previous = clock.position;
    if (now >= 3) errors.push(Math.abs(wrap(value.phase - now * 2)) * 0.5);
  }
  assert.ok(accepted >= 8, 'regular beats accepted');
  assert.ok(
    Math.max(...errors) < 0.03,
    'settles within 30 ms by three seconds: ' + Math.max(...errors)
  );
  assert.equal(clock.targetBpm, 120, 'onset alignment does not alter tempo');
  return clock;
}
simulate();
simulate({ extras: true });
simulate({ drop: true });
simulate({ offset: -0.2, delivery: 0.08 });
const clock = new Clock();
clock.setTempo(120, 0, 0);
assert.equal(clock.observeOnset(0.5, 1), false, 'stale onset rejected');
assert.equal(clock.observeOnset(2, 1), false, 'future onset rejected');
assert.equal(clock.observeOnset(NaN, 1), false);
for (const onset of [0.5, 1, 1.5]) clock.observeOnset(onset, onset + 0.01);
assert.equal(clock.observeOnset(1.5, 1.52), false, 'duplicate rejected');
const aligned = clock.read(1.52).phase;
assert.equal(
  clock.observeOnset(1.75, 1.76),
  false,
  'offbeat cannot shift a locked clock'
);
assert.ok(Math.abs(wrap(aligned - 0.04)) < 0.01);
