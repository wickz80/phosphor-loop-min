// Continuous audio-time oscillator. Tempo updates steer it without resetting a beat.
interface BeatClockSnapshot {
  bpm: number;
  phase: number;
  gridBeat: number;
  pulse: number;
}
class PhosphorBeatClock {
  time: number | null = null;
  position = 0;
  bpm = 0;
  targetBpm = 0;
  anchor = 0;
  lastOnset = -Infinity;
  seenOnset = -Infinity;
  onsetCandidate: { time: number; count: number } | null = null;
  constructor() {
    this.time = null;
    this.position = 0;
    this.bpm = 0;
    this.lastOnset = -Infinity;
    this.seenOnset = -Infinity;
    this.onsetCandidate = null;
  }
  setTempo(bpm: number, beatTime: number, now: number): void {
    if (!Number.isFinite(bpm) || bpm <= 0 || !Number.isFinite(beatTime)) return;
    this.advance(now);
    if (!this.bpm) {
      this.bpm = bpm;
      this.position = ((now - beatTime) * bpm) / 60;
    }
    this.targetBpm = bpm;
    // Fresh onset timing wins over the older batch window's phase estimate.
    if (now - this.lastOnset > 4) this.anchor = beatTime;
    this.time = now;
  }
  observeOnset(onsetTime: number, now: number): boolean {
    if (
      !this.bpm ||
      !Number.isFinite(onsetTime) ||
      !Number.isFinite(now) ||
      onsetTime <= this.seenOnset ||
      onsetTime > now ||
      now - onsetTime > 0.25
    )
      return false;
    this.seenOnset = onsetTime;
    this.advance(now);
    const period = 60 / this.bpm;
    const positionAtOnset = this.position - (now - onsetTime) / period;
    const error = (((-positionAtOnset % 1) + 1.5) % 1) - 0.5;
    const locked = now - this.lastOnset <= 4;
    if (locked) {
      // Extra/syncopated hits must not drag a settled clock off its beat grid.
      if (Math.abs(error) > 0.18 || onsetTime - this.lastOnset < period * 0.75)
        return false;
    } else {
      // Reacquire any initial phase only after three tempo-consistent onsets.
      const candidate = this.onsetCandidate;
      if (!candidate || onsetTime - candidate.time > period * 4.1) {
        this.onsetCandidate = { time: onsetTime, count: 1 };
        return false;
      }
      const beats = (onsetTime - candidate.time) / period;
      if (beats < 0.75 || Math.abs(beats - Math.round(beats)) > 0.1)
        return false;
      candidate.time = onsetTime;
      candidate.count++;
      if (candidate.count < 3) return false;
    }
    this.lastOnset = onsetTime;
    this.anchor = onsetTime;
    this.onsetCandidate = null;
    return true;
  }
  advance(now: number): void {
    if (this.time === null) {
      this.time = now;
      return;
    }
    const dt = Math.max(0, now - this.time);
    if (this.bpm && dt > 0) {
      const previousBpm = this.bpm;
      this.bpm += (this.targetBpm - this.bpm) * (1 - Math.exp(-dt / 4));
      this.position += ((previousBpm + this.bpm) / 2 / 60) * dt;
      const expected = ((now - this.anchor) * this.targetBpm) / 60;
      const error = ((((expected - this.position) % 1) + 1.5) % 1) - 0.5;
      // Onsets correct phase promptly but continuously; never reset the beat counter.
      const onsetLocked = now - this.lastOnset <= 4;
      const maxSlew = onsetLocked ? 0.35 : 0.015;
      const settle = onsetLocked ? 0.2 : 4;
      this.position +=
        Math.max(-maxSlew, Math.min(maxSlew, error / settle)) * dt;
    }
    this.time = now;
  }
  read(now: number): BeatClockSnapshot {
    this.advance(now);
    const phase = ((this.position % 1) + 1) % 1;
    return {
      bpm: this.bpm,
      phase,
      gridBeat: Math.floor(this.position),
      pulse: this.bpm ? Math.exp((-phase * 60) / this.bpm / 0.11) : 0,
    };
  }
}

window.PhosphorBeatClock = PhosphorBeatClock;
