import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadBrowserScripts } from '../tests/support/browser-scripts.ts';

const { reason, FEEDBACK, normalizeScene } = loadBrowserScripts([
  'control-dependencies',
]).PhosphorDependencies;

describe('Control prerequisites', (): void => {
  it('requires trails for feedback effects on both 2D and 3D inputs', (): void => {
    const clean = { loop: { trails: 0, in1: 'cubes' } };
    const world = { loop: { trails: 1, in1: 'cubes' } };
    const pattern = { loop: { trails: 60, in1: 'shape' } };

    for (const id of FEEDBACK) {
      const unavailable = reason(id, clean);
      const onWorld = reason(id, world);
      const onPattern = reason(id, pattern);

      assert.match(unavailable, /Requires Trails above 0/, id);
      assert.equal(onWorld, '', id);
      assert.equal(onPattern, '', id);
    }
  });

  it('does not impose feedback requirements on unrelated controls', (): void => {
    const clean = { loop: { trails: 0, in1: 'cubes' } };

    for (const id of ['trails', 'view', 'size', 'mirror', 'split', 'apEvery']) {
      const unavailable = reason(id, clean);

      assert.equal(unavailable, '', id);
    }
  });

  it('requires a second input for blend and any input for size', (): void => {
    const missingSecond = reason('blend', { loop: { in2: 'none' } });
    const withSecond = reason('blend', { loop: { in2: 'wave' } });
    const missingInput = reason('size', { loop: { in1: 'none', in2: 'none' } });
    const withInput = reason('size', { loop: { in1: 'none', in2: 'cubes' } });

    assert.match(missingSecond, /second input/);
    assert.equal(withSecond, '');
    assert.match(missingInput, /Choose an input/);
    assert.equal(withInput, '');
  });

  it('checks audio routes independently from loop feedback', (): void => {
    const withoutAudio = reason('sndAmt', { audio: false });
    const withAudio = reason('sndAmt', { audio: true });
    const withoutEffect = reason('', {
      route: { effect: 'none' },
      audio: true,
    });
    const routeWithoutAudio = reason('', {
      route: { effect: 'spin' },
      audio: false,
    });
    const readyRoute = reason('', { route: { effect: 'spin' }, audio: true });

    assert.match(withoutAudio, /Share audio/);
    assert.equal(withAudio, '');
    assert.match(withoutEffect, /Choose an effect/);
    assert.match(routeWithoutAudio, /Share audio/);
    assert.equal(readyRoute, '');
  });

  it('evaluates the actual loop and global grading prerequisites', (): void => {
    const loopA = reason('flow', { loop: { trails: 0 } });
    const loopB = reason('flow', { loop: { trails: 60 } });
    const gradientOff = reason('videoShadowHue', {
      video: { videoGradient: 0 },
    });
    const gradientOn = reason('videoHighlightHue', {
      video: { videoGradient: 40 },
      loop: { trails: 0 },
    });
    const gamma = reason('videoGamma', { loop: { trails: 0 }, audio: false });

    assert.notEqual(loopA, loopB);
    assert.match(gradientOff, /Gradient mix/);
    assert.equal(gradientOn, '');
    assert.equal(gamma, '');
  });

  it('neutralizes unavailable scene effects while retaining independent settings', (): void => {
    const clean = {
      in1: 'cubes',
      in2: 'none',
      trails: 0,
      flow: 75,
      warp: 90,
      spin: -30,
      blur: 0.2,
      blend: 60,
      size: 100,
      mirror: 4,
    };
    const feedback = {
      in1: 'wave',
      in2: 'shape',
      trails: 60,
      flow: 75,
      spin: -30,
      blend: 40,
    };

    normalizeScene(clean);
    normalizeScene(feedback);

    for (const id of ['flow', 'warp', 'spin', 'blur', 'blend'] as const)
      assert.equal(clean[id], 0, id);
    assert.equal(clean.size, 100);
    assert.equal(clean.mirror, 4);
    assert.equal(feedback.flow, 75);
    assert.equal(feedback.spin, -30);
    assert.equal(feedback.blend, 40);
  });
});
