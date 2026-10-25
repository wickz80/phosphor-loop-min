interface LfoBindingActions {
  commit(key: string, config: unknown): boolean;
  release(key: string): void;
  reset(key: string, resetValue: () => void): void;
}
interface LfoStateApi {
  restore(
    raw: unknown,
    limitsFor: (id: string) => LfoLimits | null
  ): Record<string, LfoConfig>;
  formatReadout(value: number): string;
  createActions(
    engine: LfoEngine,
    onEnable: (key: string) => void,
    onChange: () => void
  ): LfoBindingActions;
}
const PhosphorLFOState = ((): LfoStateApi => {
  function restore(
    raw: unknown,
    limitsFor: (id: string) => LfoLimits | null
  ): Record<string, LfoConfig> {
    const bindings: Record<string, LfoConfig> = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return bindings;
    for (const [key, config] of Object.entries(raw)) {
      const [scope, id, extra] = key.split(':');
      const control = PhosphorControlRouting.resolve(id ?? '');
      if (
        !control ||
        extra ||
        (control.kind === 'loop'
          ? scope !== 'A' && scope !== 'B'
          : scope !== 'global')
      )
        continue;
      const limits = limitsFor(id);
      if (
        !limits ||
        !config ||
        typeof config !== 'object' ||
        Array.isArray(config)
      )
        continue;
      bindings[key] = PhosphorLFOEngine.sanitize(config, limits);
    }
    return bindings;
  }
  function formatReadout(value: number): string {
    if (!Number.isFinite(value)) return '—';
    let text = String(value);
    if (text.length > 3 && Math.abs(value) < 1)
      text = value.toFixed(1).replace(/^0\./, '.').replace(/^-0\./, '-.');
    if (text.length > 3 && Math.abs(value) < 100)
      text = String(Math.round(value));
    if (text.length > 3 && Math.abs(value) >= 1000)
      text = String(Math.round(value / 1000)) + 'k';
    return text.length > 3 ? text.slice(0, 2) + '…' : text;
  }
  function createActions(
    engine: LfoEngine,
    onEnable: (key: string) => void,
    onChange: () => void
  ): LfoBindingActions {
    function commit(key: string, config: unknown): boolean {
      const wasEnabled = engine.bindings[key]?.enabled === true;
      const next = engine.set(key, config);
      if (!next) return false;
      if (next.enabled && !wasEnabled) onEnable(key);
      onChange();
      return true;
    }
    function release(key: string): void {
      const current = engine.bindings[key];
      if (current?.enabled) commit(key, { ...current, enabled: false });
    }
    function reset(key: string, resetValue: () => void): void {
      release(key);
      resetValue();
    }
    return { commit, release, reset };
  }
  return { restore, formatReadout, createActions };
})();
window.PhosphorLFOState = PhosphorLFOState;
