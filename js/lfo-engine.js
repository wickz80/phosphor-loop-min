// Generated from src/lfo-engine.ts by npm run build. Do not edit directly.
'use strict';
const PhosphorLFOEngine = (() => {
  const BEATS = [1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8, 16, 32, 64];
  const CURVES = {
    sine: 'Sine',
    linear: 'Linear',
    log: 'Log',
    exp: 'Exp',
  };
  function sanitize(raw, limits) {
    const config = raw && typeof raw === 'object' ? raw : {};
    const clamp = (value) => Math.min(limits.max, Math.max(limits.min, value));
    const number = (value, fallback) =>
      Number.isFinite(Number(value)) ? Number(value) : fallback;
    return {
      enabled: config?.enabled === true,
      x: clamp(number(config?.x, limits.min)),
      y: clamp(number(config?.y, limits.max)),
      beats: BEATS.includes(Number(config?.beats)) ? Number(config.beats) : 4,
      curve: Object.hasOwn(CURVES, String(config?.curve))
        ? config.curve
        : 'sine',
    };
  }
  // N beats is a complete X → Y → X sine cycle, including reversed ranges.
  function valueAt(config, beat) {
    const phase = (((beat / config.beats) % 1) + 1) % 1;
    const triangle = phase <= 0.5 ? phase * 2 : (1 - phase) * 2;
    const amount =
      config.curve === 'linear'
        ? triangle
        : config.curve === 'log'
        ? Math.log1p(9 * triangle) / Math.log(10)
        : config.curve === 'exp'
        ? Math.expm1(Math.log(10) * triangle) / 9
        : 0.5 - 0.5 * Math.cos(phase * 2 * Math.PI);
    return config.x + (config.y - config.x) * amount;
  }
  function createEngine({ bindings = {}, resolve, apply }) {
    return {
      bindings,
      set(key, config) {
        const target = resolve(key);
        if (!target) return;
        return (bindings[key] = sanitize(config, target.limits));
      },
      tick(beat, frozen = false) {
        if (frozen || typeof beat !== 'number' || !Number.isFinite(beat))
          return;
        for (const [key, raw] of Object.entries(bindings)) {
          if (!raw?.enabled) continue;
          const target = resolve(key);
          if (!target) continue;
          const config = sanitize(raw, target.limits);
          const step = target.limits.step || 1;
          const value = valueAt(config, beat);
          const snapped =
            target.limits.min +
            Math.round((value - target.limits.min) / step) * step;
          apply(
            target,
            Math.min(
              Math.max(snapped, Math.min(config.x, config.y)),
              Math.max(config.x, config.y)
            )
          );
        }
      },
    };
  }
  return { BEATS, CURVES, sanitize, valueAt, createEngine };
})();
window.PhosphorLFOEngine = PhosphorLFOEngine;
