/** Shared slider identities and model writes. DOM refresh stays in the app adapter. */
const LOOP_CONTROL_IDS = [
  'zoom',
  'spin',
  'trails',
  'color',
  'warp',
  'blend',
  'size',
  'flow',
  'melt',
  'push',
  'dye',
  'split',
  'grow',
  'time',
  'lookup',
  'chase',
  'breathe',
  'chroma',
  'restless',
  'julia',
  'crystal',
] as const;
const MIX_CONTROL_IDS = ['view', 'xab', 'xba'] as const;
const AUTOPILOT_CONTROL_KEYS = [
  'every',
  'fade',
  'wild',
  'mix',
  'taste',
] as const;
const SOURCE_ADJUSTMENT_KEYS = [
  'tracking',
  'bright',
  'contrast',
  'sat',
  'key',
] as const;
const ADJUSTMENT_SOURCE_IDS = [
  'picture',
  'video',
  'camera',
  'screen',
  'loop',
] as const;
type LoopControlId = (typeof LOOP_CONTROL_IDS)[number];
type MixControlId = (typeof MIX_CONTROL_IDS)[number];
type AutopilotControlKey = (typeof AUTOPILOT_CONTROL_KEYS)[number];
type SourceAdjustmentKey = (typeof SOURCE_ADJUSTMENT_KEYS)[number];
type AdjustmentSourceId = (typeof ADJUSTMENT_SOURCE_IDS)[number];
type ControlLoop = 'A' | 'B';
type ControlScope = ControlLoop | 'global';
type RoutedControl =
  | { kind: 'loop'; id: LoopControlId }
  | { kind: 'mix'; id: MixControlId }
  | { kind: 'grade'; id: keyof VideoGradeState }
  | { kind: 'audio' }
  | { kind: 'autopilot'; key: AutopilotControlKey }
  | { kind: 'adjustment'; source: AdjustmentSourceId; key: SourceAdjustmentKey }
  | { kind: 'seek' };
interface ControlModel {
  loops: Record<
    ControlLoop,
    { tgt: Record<LoopControlId, number>; cur: Record<LoopControlId, number> }
  >;
  mix: { tgt: Record<MixControlId, number>; cur: Record<MixControlId, number> };
  audio: { amount: number };
  autopilot: Record<AutopilotControlKey, number>;
  adjustments: Partial<
    Record<AdjustmentSourceId, Record<SourceAdjustmentKey, number>>
  >;
}
interface ControlWriterOptions {
  getState: () => ControlModel;
  setGrade: (id: keyof VideoGradeState, value: number) => boolean;
  seek: (value: number) => void;
  onChange: (
    control: RoutedControl,
    scope: ControlScope,
    value: number
  ) => void;
}
interface ControlWriter {
  apply(id: string, value: number, scope: ControlScope): boolean;
}
interface ControlRoutingApi {
  loopIds: readonly LoopControlId[];
  mixIds: readonly MixControlId[];
  resolve(id: string): RoutedControl | null;
  isAutopilotOwned(id: string): boolean;
  isAutopilotBinding(key: string): boolean;
  scopeFor(id: string, editedLoop: ControlLoop): ControlScope;
  createWriter(options: ControlWriterOptions): ControlWriter;
}
const PhosphorControlRouting = ((): ControlRoutingApi => {
  function includes<T extends string>(
    items: readonly T[],
    value: string
  ): value is T {
    return (items as readonly string[]).includes(value);
  }
  function resolve(id: string): RoutedControl | null {
    if (includes(LOOP_CONTROL_IDS, id)) return { kind: 'loop', id };
    if (includes(MIX_CONTROL_IDS, id)) return { kind: 'mix', id };
    if (Object.hasOwn(PhosphorVideoGrade.state, id))
      return { kind: 'grade', id: id as keyof VideoGradeState };
    if (id === 'sndAmt') return { kind: 'audio' };
    if (id === 'vidPos') return { kind: 'seek' };
    const apKey = id.startsWith('ap') ? id.slice(2).toLowerCase() : '';
    if (includes(AUTOPILOT_CONTROL_KEYS, apKey))
      return { kind: 'autopilot', key: apKey };
    const [, source, key, extra] = id.split('-');
    if (
      id.startsWith('adj-') &&
      !extra &&
      includes(ADJUSTMENT_SOURCE_IDS, source) &&
      includes(SOURCE_ADJUSTMENT_KEYS, key)
    ) {
      return { kind: 'adjustment', source, key };
    }
    return null;
  }
  function isAutopilotOwned(id: string): boolean {
    return includes(LOOP_CONTROL_IDS, id) || includes(MIX_CONTROL_IDS, id);
  }
  function isAutopilotBinding(binding: string): boolean {
    const [scope, id, extra] = binding.split(':');
    if (extra || !id) return false;
    return (
      ((scope === 'A' || scope === 'B') && includes(LOOP_CONTROL_IDS, id)) ||
      (scope === 'global' && includes(MIX_CONTROL_IDS, id))
    );
  }
  function scopeFor(id: string, editedLoop: ControlLoop): ControlScope {
    return includes(LOOP_CONTROL_IDS, id) ? editedLoop : 'global';
  }
  function createWriter(options: ControlWriterOptions): ControlWriter {
    function apply(id: string, value: number, scope: ControlScope): boolean {
      if (!Number.isFinite(value)) return false;
      const control = resolve(id);
      if (!control) return false;
      if (
        control.kind === 'loop'
          ? scope !== 'A' && scope !== 'B'
          : scope !== 'global'
      )
        return false;
      const state = options.getState();
      switch (control.kind) {
        case 'loop': {
          if (scope === 'global') return false;
          const loop = state.loops[scope];
          loop.tgt[control.id] = value;
          loop.cur[control.id] = value;
          break;
        }
        case 'mix':
          state.mix.tgt[control.id] = value;
          state.mix.cur[control.id] = value;
          break;
        case 'grade':
          if (!options.setGrade(control.id, value)) return false;
          break;
        case 'audio':
          state.audio.amount = value;
          break;
        case 'autopilot':
          state.autopilot[control.key] = value;
          break;
        case 'adjustment': {
          const source = state.adjustments[control.source];
          if (!source) return false;
          source[control.key] = value;
          break;
        }
        case 'seek':
          options.seek(value);
          break;
      }
      options.onChange(control, scope, value);
      return true;
    }
    return { apply };
  }
  return {
    loopIds: LOOP_CONTROL_IDS,
    mixIds: MIX_CONTROL_IDS,
    resolve,
    isAutopilotOwned,
    isAutopilotBinding,
    scopeFor,
    createWriter,
  };
})();
window.PhosphorControlRouting = PhosphorControlRouting;
