// Generated from src/video-grade.ts by npm run build. Do not edit directly.
'use strict';
const PhosphorVideoGrade = (() => {
  const KEY = 'phosphor-global-video-v1';
  const controls = [
    [
      'videoGamma',
      'Gamma',
      0.25,
      3,
      0.01,
      1,
      'Tone',
      'Output gamma. Above 1 brightens midtones; below 1 darkens them. Applied after both loops are combined.',
    ],
    [
      'videoExposure',
      'Exposure',
      -3,
      3,
      0.01,
      0,
      'Tone',
      'Overall exposure in stops. Each +1 doubles output brightness before final clipping.',
    ],
    [
      'videoContrast',
      'Contrast',
      0,
      2,
      0.01,
      1,
      'Tone',
      'Contrast around middle gray. 1 leaves the output unchanged.',
    ],
    [
      'videoSaturation',
      'Saturation',
      0,
      2,
      0.01,
      1,
      'Color',
      '0 makes the output grayscale; 1 preserves the original colors.',
    ],
    [
      'videoHue',
      'Hue rotation',
      -180,
      180,
      1,
      0,
      'Color',
      'Rotates the colors of the entire output, independently of texture feedback.',
    ],
    [
      'videoRed',
      'Red gain',
      0,
      2,
      0.01,
      1,
      'Color',
      'Multiplies the red channel of the final image.',
    ],
    [
      'videoGreen',
      'Green gain',
      0,
      2,
      0.01,
      1,
      'Color',
      'Multiplies the green channel of the final image.',
    ],
    [
      'videoBlue',
      'Blue gain',
      0,
      2,
      0.01,
      1,
      'Color',
      'Multiplies the blue channel of the final image.',
    ],
    [
      'videoSepia',
      'Sepia mix',
      0,
      100,
      1,
      0,
      'Color',
      'Blends the output into a warm sepia matrix. Combine with channel gains for custom filtering.',
    ],
    [
      'videoGradient',
      'Gradient mix',
      0,
      100,
      1,
      0,
      'Gradient',
      'Recolors luminance using the shadow and highlight hues. 0 preserves the existing image.',
    ],
    [
      'videoShadowHue',
      'Shadow hue',
      0,
      360,
      1,
      220,
      'Gradient',
      'Hue at the dark end of the global color gradient. Requires Gradient mix above 0.',
    ],
    [
      'videoHighlightHue',
      'Highlight hue',
      0,
      360,
      1,
      40,
      'Gradient',
      'Hue at the light end of the global color gradient. Requires Gradient mix above 0.',
    ],
  ];
  const defaults = () =>
    Object.fromEntries(controls.map(([id, , , , , value]) => [id, value]));
  function sanitize(raw) {
    const state = defaults();
    if (!raw || typeof raw !== 'object') return state;
    const candidate = raw;
    for (const [id, , min, max] of controls)
      if (typeof candidate[id] === 'number' && Number.isFinite(candidate[id]))
        state[id] = Math.max(min, Math.min(max, candidate[id]));
    return state;
  }
  let restored;
  try {
    restored = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    // Storage is optional; retain neutral defaults or the in-memory state.
  }
  const state = sanitize(restored),
    elements = new Map();
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage is optional; retain neutral defaults or the in-memory state.
    }
  };
  const format = (id, value) =>
    /Hue$/.test(id) || id === 'videoHue'
      ? Math.round(value) + '°'
      : ['videoSepia', 'videoGradient'].includes(id)
      ? Math.round(value) + '%'
      : Number(value.toFixed(2)).toString();
  function setSlider(id, value) {
    const control = controls.find((control) => control[0] === id);
    if (!control) return false;
    if (!Number.isFinite(value)) return true;
    const key = control[0];
    state[key] = Math.max(control[2], Math.min(control[3], value));
    const entry = elements.get(id);
    if (entry) {
      entry.slider.value = String(state[key]);
      entry.output.textContent = format(key, state[key]);
      entry.fill(entry.slider);
    }
    return true;
  }
  function resetSlider(id) {
    const control = controls.find((control) => control[0] === id);
    if (!control) return false;
    setSlider(id, control[5]);
    save();
    return true;
  }
  function reset() {
    Object.assign(state, defaults());
    for (const [id, value] of Object.entries(state)) setSlider(id, value);
    save();
  }
  function createUI(section, fill) {
    const doc = section.ownerDocument;
    for (const groupName of ['Tone', 'Color', 'Gradient']) {
      const group = doc.createElement('details');
      group.className = 'video-grade-group';
      group.open = groupName === 'Tone';
      const summary = doc.createElement('summary');
      summary.textContent = groupName;
      group.appendChild(summary);
      section.appendChild(group);
      for (const [
        id,
        label,
        min,
        max,
        step,
        ,
        groupId,
        description,
      ] of controls) {
        if (groupId !== groupName) continue;
        const ctl = doc.createElement('div');
        ctl.className = 'ctl';
        const head = doc.createElement('div');
        head.className = 'ctl-head';
        const title = doc.createElement('label');
        title.htmlFor = id;
        title.textContent = label;
        const output = doc.createElement('output');
        output.setAttribute('for', id);
        head.append(title, output);
        const slider = doc.createElement('input');
        Object.assign(slider, { type: 'range', id, min, max, step });
        const hint = doc.createElement('p');
        hint.className = 'hint';
        hint.textContent = description;
        ctl.append(head, slider, hint);
        group.appendChild(ctl);
        elements.set(id, { slider, output, fill });
        setSlider(id, state[id]);
        slider.addEventListener('input', () => {
          setSlider(id, Number(slider.value));
          save();
        });
      }
    }
    window.addEventListener('pagehide', save);
  }
  return {
    state,
    controls,
    defaults,
    sanitize,
    setSlider,
    resetSlider,
    reset,
    createUI,
  };
})();
window.PhosphorVideoGrade = PhosphorVideoGrade;
