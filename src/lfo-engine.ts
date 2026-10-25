interface LfoLimits {
  min: number;
  max: number;
  step?: number;
}
type LfoCurve = 'sine' | 'linear' | 'log' | 'exp';
interface LfoConfig {
  enabled: boolean;
  x: number;
  y: number;
  beats: number;
  curve: LfoCurve;
}
interface LfoTarget {
  limits: LfoLimits;
}
interface LfoEngineOptions<Target extends LfoTarget> {
  bindings?: Record<string, LfoConfig>;
  resolve: (key: string) => Target | null | undefined;
  apply: (target: Target, value: number) => void;
}

interface LfoEngine {
  bindings: Record<string, LfoConfig>;
  set(key: string, config: unknown): LfoConfig | undefined;
  tick(beat: number | null, frozen?: boolean): void;
}
interface LfoEngineApi {
  BEATS: number[];
  CURVES: Readonly<Record<LfoCurve, string>>;
  sanitize(raw: unknown, limits: LfoLimits): LfoConfig;
  valueAt(
    config: Pick<LfoConfig, 'x' | 'y' | 'beats'> & { curve?: LfoCurve },
    beat: number
  ): number;
  createEngine<Target extends LfoTarget>(
    options: LfoEngineOptions<Target>
  ): LfoEngine;
}

const PhosphorLFOEngine = ((): LfoEngineApi => {
  const BEATS = [1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8, 16, 32, 64];
  const CURVES = {
    sine: 'Sine',
    linear: 'Linear',
    log: 'Log',
    exp: 'Exp',
  } as const;
  function sanitize(raw: unknown, limits: LfoLimits): LfoConfig {
    const config =
      raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const clamp = (value: number): number =>
      Math.min(limits.max, Math.max(limits.min, value));
    const number = (value: unknown, fallback: number): number =>
      Number.isFinite(Number(value)) ? Number(value) : fallback;
    return {
      enabled: config?.enabled === true,
      x: clamp(number(config?.x, limits.min)),
      y: clamp(number(config?.y, limits.max)),
      beats: BEATS.includes(Number(config?.beats)) ? Number(config.beats) : 4,
      curve: Object.hasOwn(CURVES, String(config?.curve))
        ? (config.curve as LfoCurve)
        : 'sine',
    };
  }
  // N beats is a complete X → Y → X sine cycle, including reversed ranges.
  function valueAt(
    config: Pick<LfoConfig, 'x' | 'y' | 'beats'> & { curve?: LfoCurve },
    beat: number
  ): number {
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
  function createEngine<Target extends LfoTarget>({
    bindings = {},
    resolve,
    apply,
  }: LfoEngineOptions<Target>): LfoEngine {
    return {
      bindings,
      set(key: string, config: unknown): LfoConfig | undefined {
        const target = resolve(key);
        if (!target) return;
        return (bindings[key] = sanitize(config, target.limits));
      },
      tick(beat: number | null, frozen = false): void {
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
