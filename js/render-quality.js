// Frame pacing policy shared with deterministic refresh/adaptation tests.
(() => {
  function refreshInterval(samples) {
    const valid = samples.filter(ms => Number.isFinite(ms) && ms >= 3 && ms <= 50).sort((a, b) => a - b);
    if (valid.length < 8) return 1000 / 60;
    // Ignore occasional missed refreshes; use a group of fast samples rather than one outlier.
    return Math.max(1000 / 240, Math.min(1000 / 30, valid[Math.floor(valid.length * 0.2)]));
  }
  function createController() {
    const state = {scale: 1, average: 1000 / 60, target: 1000 / 60, changedAt: 0};
    return {
      get scale() { return state.scale; },
      reset(now, target = state.target) { state.scale = 1; state.average = target; state.target = target; state.changedAt = now; },
      update(now, ms) {
        if (!Number.isFinite(ms) || ms <= 0 || ms > 100) return state.scale;
        state.average += (ms - state.average) * 0.12;
        const elapsed = now - state.changedAt;
        if (elapsed >= 400 && state.average > state.target * 1.08) {
          state.scale = Math.max(0.3, state.scale * 0.85);
          state.changedAt = now;
        } else if (elapsed >= 8000 && state.average <= state.target * 1.025) {
          state.scale = Math.min(1, state.scale * 1.05);
          state.changedAt = now;
        }
        return state.scale;
      },
    };
  }
  window.PhosphorQuality = {refreshInterval, createController};
})();
