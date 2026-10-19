// Three bounded routes; pure helpers are shared with the browser regression tests.
(() => {
  const sources = {bpm: 'BPM beat', kick: 'Kick', percussion: 'Percussion', pitch: 'Dominant pitch', bass: 'Bass', highs: 'Highs', tonal: 'Tonal activity'};
  const effects = {none: 'None', forward: 'Forward pulse', shimmer: 'Light shimmer', color: 'Structure color', spin: 'Rotation accent', warp: 'Deformation', travel: 'Camera speed', surface: 'Surface ride', orbit: 'Orbit', turn45: 'Turn 45°', turn90: 'Turn 90°'};
  const defaults = () => [
    {source: 'bpm', effect: 'forward', strength: 85},
    {source: 'percussion', effect: 'shimmer', strength: 40},
    {source: 'pitch', effect: 'color', strength: 55},
  ];
  const sanitize = rows => defaults().map((fallback, i) => {
    let row = Array.isArray(rows) ? rows[i] : null;
    if (row?.source === 'pitch' && row.effect !== 'none') row = {...row, effect: 'color'};
    return row ? {source: Object.hasOwn(sources, row.source) ? row.source : fallback.source,
      effect: Object.hasOwn(effects, row.effect) ? row.effect : fallback.effect,
      strength: Number.isFinite(row.strength) ? Math.max(0, Math.min(100, row.strength)) : fallback.strength} : fallback;
  });
  const evaluate = (rows, env, music) => {
    const values = {bpm: music?.bpmBeat ?? 0, kick: env.beat, percussion: env.mid, bass: env.low, highs: env.high,
      tonal: music?.tonal ?? env.mid, pitch: music?.pitch ? music.tonal : 0};
    const result = {forward: 0, shimmer: 0, spin: 0, warp: 0, color: 0, hue: 0, travel: 0, surface: 0, orbit: 0, turn45: 0, turn90: 0, turnToken: null};
    let x = 0, y = 0;
    for (const row of rows) {
      if (row.effect === 'none') continue;
      const value = Math.max(0, Math.min(1, values[row.source] || 0));
      const weight = row.strength / 100;
      if (row.effect === 'color') {
        if (row.source === 'pitch' && !music?.pitch) continue;
        const hue = row.source === 'pitch' ? ((music.pitch.midi % 12) + 12) % 12 / 12 : value * 0.7;
        const amount = weight * (row.source === 'pitch' ? 1 : value);
        x += Math.cos(hue * 2 * Math.PI) * amount;
        y += Math.sin(hue * 2 * Math.PI) * amount;
        result.color += amount;
      } else {
        result[row.effect] += value * weight;
        if (['turn45', 'turn90'].includes(row.effect) && row.source === 'bpm' && weight > 0 && music?.gridBeat != null) result.turnToken = music.gridBeat;
      }
    }
    for (const key of ['forward', 'shimmer', 'spin', 'warp', 'color', 'travel', 'surface', 'orbit', 'turn45', 'turn90']) result[key] = Math.min(1, result[key]);
    result.hue = (Math.atan2(y, x) / (2 * Math.PI) + 1) % 1;
    return result;
  };
  window.PhosphorMappings = {sources, effects, defaults, sanitize, evaluate};
})();
