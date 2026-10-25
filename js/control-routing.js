// Generated from src/control-routing.ts by npm run build. Do not edit directly.
'use strict';
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
];
const MIX_CONTROL_IDS = ['view', 'xab', 'xba'];
const AUTOPILOT_CONTROL_KEYS = ['every', 'fade', 'wild', 'mix', 'taste'];
const SOURCE_ADJUSTMENT_KEYS = ['tracking', 'bright', 'contrast', 'sat', 'key'];
const ADJUSTMENT_SOURCE_IDS = ['picture', 'video', 'camera', 'screen', 'loop'];
const PhosphorControlRouting = (() => {
  function includes(items, value) {
    return items.includes(value);
  }
  function resolve(id) {
    if (includes(LOOP_CONTROL_IDS, id)) return { kind: 'loop', id };
    if (includes(MIX_CONTROL_IDS, id)) return { kind: 'mix', id };
    if (Object.hasOwn(PhosphorVideoGrade.state, id))
      return { kind: 'grade', id: id };
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
  function isAutopilotOwned(id) {
    return includes(LOOP_CONTROL_IDS, id) || includes(MIX_CONTROL_IDS, id);
  }
  function isAutopilotBinding(binding) {
    const [scope, id, extra] = binding.split(':');
    if (extra || !id) return false;
    return (
      ((scope === 'A' || scope === 'B') && includes(LOOP_CONTROL_IDS, id)) ||
      (scope === 'global' && includes(MIX_CONTROL_IDS, id))
    );
  }
  function scopeFor(id, editedLoop) {
    return includes(LOOP_CONTROL_IDS, id) ? editedLoop : 'global';
  }
  function createWriter(options) {
    function apply(id, value, scope) {
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
