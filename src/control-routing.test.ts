import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadBrowserScripts } from '../tests/support/browser-scripts.ts';

interface RoutingFixture {
  routing: ControlRoutingApi;
  grade: VideoGradeApi;
  state: ControlModel;
  writer: ControlWriter;
  changes: RoutedControl[];
  seeks: number[];
}
function createFixture(): RoutingFixture {
  const { PhosphorControlRouting: routing, PhosphorVideoGrade: grade } =
    loadBrowserScripts(['video-grade', 'control-routing']);
  const values = <Id extends string>(ids: readonly Id[]): Record<Id, number> =>
    Object.fromEntries(ids.map((id): [Id, number] => [id, 0])) as Record<
      Id,
      number
    >;
  const loop = (): ControlModel['loops']['A'] => ({
    tgt: values(routing.loopIds),
    cur: values(routing.loopIds),
  });
  const state: ControlModel = {
    loops: { A: loop(), B: loop() },
    mix: { tgt: values(routing.mixIds), cur: values(routing.mixIds) },
    audio: { amount: 60 },
    autopilot: { every: 30, fade: 10, wild: 50, mix: 50, taste: 0 },
    adjustments: {
      video: { tracking: 0, bright: 0, contrast: 0, sat: 0, key: 0 },
    },
  };
  const changes: RoutedControl[] = [],
    seeks: number[] = [];
  const writer = routing.createWriter({
    getState: (): ControlModel => state,
    setGrade: grade.setSlider,
    seek: (value): void => {
      seeks.push(value);
    },
    onChange: (target): void => {
      changes.push(target);
    },
  });
  return { routing, grade, state, writer, changes, seeks };
}

describe('Control routing', (): void => {
  it('writes both target and rendered values on the requested loop only', (): void => {
    const { routing, state, writer } = createFixture();

    for (const id of routing.loopIds) writer.apply(id, 37, 'B');

    for (const id of routing.loopIds) {
      assert.equal(state.loops.B.tgt[id], 37, id);
      assert.equal(state.loops.B.cur[id], 37, id);
      assert.equal(state.loops.A.tgt[id], 0, id);
    }
  });

  it('routes global, source and playback values to their real owners', (): void => {
    const { state, writer, grade, seeks } = createFixture();

    const accepted = [
      writer.apply('view', 42, 'global'),
      writer.apply('adj-video-bright', 70, 'global'),
      writer.apply('videoGamma', 1.5, 'global'),
      writer.apply('sndAmt', 25, 'global'),
      writer.apply('vidPos', 100, 'global'),
    ];

    assert.ok(accepted.every(Boolean));
    assert.equal(state.mix.tgt.view, 42);
    assert.equal(state.mix.cur.view, 42);
    assert.equal(state.adjustments.video!.bright, 70);
    assert.equal(grade.state.videoGamma, 1.5);
    assert.equal(state.audio.amount, 25);
    assert.deepEqual(seeks, [100]);
  });

  it('rejects invalid IDs, scopes and non-finite values without side effects', (): void => {
    const { state, writer, changes, seeks, grade } = createFixture();
    const before = JSON.stringify({ state, grade: grade.state });
    const invalid = [
      ['flow', 5, 'global'],
      ['flow', 5, 'missing'],
      ['view', 5, 'A'],
      ['videoGamma', 2, 'B'],
      ['adj-video-bright', 4, 'A'],
      ['flow', NaN, 'A'],
      ['sndAmt', Infinity, 'global'],
      ['not-a-control', 1, 'global'],
      ['adj-video-missing', 1, 'global'],
      ['adj-video-bright-extra', 1, 'global'],
      ['adj-camera-bright', 1, 'global'],
    ] as const;

    const accepted = invalid.map(([id, value, scope]): boolean =>
      writer.apply(id, value, scope as ControlScope)
    );

    assert.ok(accepted.every((value): boolean => !value));
    assert.equal(JSON.stringify({ state, grade: grade.state }), before);
    assert.equal(changes.length, 0);
    assert.equal(seeks.length, 0);
  });

  it('classifies loop/mix bindings separately from independent global controls', (): void => {
    const { routing } = createFixture();
    const owned = ['A:flow', 'B:trails', 'global:view'];
    const independent = [
      'global:videoGamma',
      'global:adj-video-bright',
      'global:sndAmt',
      'global:apWild',
      'global:flow',
      'A:view',
      'A:flow:extra',
    ];

    const ownedResults = owned.map((key): boolean =>
      routing.isAutopilotBinding(key)
    );
    const independentResults = independent.map((key): boolean =>
      routing.isAutopilotBinding(key)
    );
    const loopScope = routing.scopeFor('flow', 'B');
    const globalScope = routing.scopeFor('videoGamma', 'B');

    assert.ok(ownedResults.every(Boolean));
    assert.ok(independentResults.every((value): boolean => !value));
    assert.equal(loopScope, 'B');
    assert.equal(globalScope, 'global');
  });

  it('uses current state after the owner replaces a restored settings object', (): void => {
    const { state, writer } = createFixture();
    const previous = state.autopilot;
    state.autopilot = { ...previous, wild: 10 };

    writer.apply('apWild', 20, 'global');

    assert.equal(state.autopilot.wild, 20);
    assert.equal(previous.wild, 50);
  });
});
