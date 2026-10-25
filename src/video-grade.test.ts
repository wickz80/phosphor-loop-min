import assert from 'node:assert/strict';
import { loadBrowserScripts } from '../tests/support/browser-scripts.ts';
function setup(saved: string | null): VideoGradeApi {
  return loadBrowserScripts(['video-grade'], saved).PhosphorVideoGrade;
}
const grade = setup(null);
assert.equal(grade.state.videoGamma, 1);
assert.equal(grade.state.videoExposure, 0);
for (const id of [
  'videoContrast',
  'videoSaturation',
  'videoRed',
  'videoGreen',
  'videoBlue',
] as const)
  assert.equal(grade.state[id], 1, 'neutral ' + id);
for (const id of ['videoHue', 'videoSepia', 'videoGradient'] as const)
  assert.equal(grade.state[id], 0, 'neutral ' + id);
assert.equal(
  grade.setSlider('spin', 40),
  false,
  'texture controls are not global'
);
assert.equal(grade.setSlider('videoGamma', 0), true);
assert.equal(grade.state.videoGamma, 0.25, 'gamma never reaches zero');
grade.setSlider('videoRed', 1.7);
grade.setSlider('videoGradient', 1000);
assert.equal(grade.state.videoGradient, 100);
grade.setSlider('videoExposure', NaN);
assert.equal(
  grade.state.videoExposure,
  0,
  'invalid runtime writes do not poison output'
);
assert.equal(grade.resetSlider('videoGamma'), true);
assert.equal(grade.state.videoGamma, 1);
assert.equal(
  grade.state.videoRed,
  1.7,
  'single reset leaves other global controls intact'
);
assert.equal(grade.resetSlider('spin'), false);
const restored = setup(JSON.stringify(grade.state));
assert.equal(restored.state.videoRed, 1.7);
assert.equal(restored.state.videoGradient, 100);
restored.reset();
assert.equal(
  JSON.stringify(restored.state),
  JSON.stringify(restored.defaults()),
  'reset restores identity grading'
);
assert.equal(
  setup('{broken').state.videoGamma,
  1,
  'corrupt saved configuration starts neutral'
);
assert.equal(
  setup(JSON.stringify({ videoGamma: 'bad', videoExposure: 100 })).state
    .videoExposure,
  3
);
console.log(
  'PASS: neutral output defaults, bounded gamma/channel/exposure controls, global-only routing, persistence, invalid values and reset.'
);
