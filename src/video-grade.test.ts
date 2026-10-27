import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadBrowserScripts } from '../tests/support/browser-scripts.ts';

function createGrade(saved: string | null = null): VideoGradeApi {
  return loadBrowserScripts(['video-grade'], saved).PhosphorVideoGrade;
}

describe('Video grading state', (): void => {
  it('starts with neutral output settings', (): void => {
    const grade = createGrade();

    const actual = grade.state;

    assert.equal(actual.videoGamma, 1);
    assert.equal(actual.videoExposure, 0);
    for (const id of [
      'videoContrast',
      'videoSaturation',
      'videoRed',
      'videoGreen',
      'videoBlue',
    ] as const)
      assert.equal(actual[id], 1, id);
    for (const id of ['videoHue', 'videoSepia', 'videoGradient'] as const)
      assert.equal(actual[id], 0, id);
  });

  it('clamps supported writes and rejects unrelated or non-finite values', (): void => {
    const grade = createGrade();

    const unrelated = grade.setSlider('spin', 40);
    grade.setSlider('videoGamma', 0);
    grade.setSlider('videoGradient', 1000);
    grade.setSlider('videoExposure', NaN);

    assert.equal(unrelated, false);
    assert.equal(grade.state.videoGamma, 0.25);
    assert.equal(grade.state.videoGradient, 100);
    assert.equal(grade.state.videoExposure, 0);
  });

  it('resets one control without changing its neighbors', (): void => {
    const grade = createGrade();
    grade.setSlider('videoGamma', 2);
    grade.setSlider('videoRed', 1.7);

    const reset = grade.resetSlider('videoGamma');
    const unsupported = grade.resetSlider('spin');

    assert.equal(reset, true);
    assert.equal(unsupported, false);
    assert.equal(grade.state.videoGamma, 1);
    assert.equal(grade.state.videoRed, 1.7);
  });

  it('restores saved settings and can reset the whole grade', (): void => {
    const original = createGrade();
    original.setSlider('videoRed', 1.7);
    original.setSlider('videoGradient', 100);

    const restored = createGrade(JSON.stringify(original.state));

    assert.equal(restored.state.videoRed, 1.7);
    assert.equal(restored.state.videoGradient, 100);

    restored.reset();

    assert.equal(
      JSON.stringify(restored.state),
      JSON.stringify(restored.defaults())
    );
  });

  it('falls back safely for corrupt or invalid saved values', (): void => {
    const corrupt = '{broken';
    const invalid = JSON.stringify({ videoGamma: 'bad', videoExposure: 100 });

    const fromCorrupt = createGrade(corrupt);
    const fromInvalid = createGrade(invalid);

    assert.equal(fromCorrupt.state.videoGamma, 1);
    assert.equal(fromInvalid.state.videoGamma, 1);
    assert.equal(fromInvalid.state.videoExposure, 3);
  });
});
