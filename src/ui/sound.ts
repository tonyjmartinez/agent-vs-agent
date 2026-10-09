import type { GameEvent } from '../engine/types';
import { load, save } from './storage';

/** Tiny synthesized blips (PLAN 3.5). No asset files; audio starts only after a user gesture. */
export class Sound {
  private ctx: AudioContext | null = null;
  muted = load('ava.muted', false);

  /** Call from a user gesture (iOS requires it before any audio plays). */
  unlock(): void {
    if (this.ctx || this.muted) return;
    try {
      this.ctx = new AudioContext();
    } catch {
      this.ctx = null;
    }
  }

  toggle(): boolean {
    this.muted = !this.muted;
    save('ava.muted', this.muted);
    if (!this.muted) this.unlock();
    return this.muted;
  }

  private tone(
    f0: number,
    f1: number,
    ms: number,
    type: OscillatorType = 'sine',
    gain = 0.12,
    at = 0,
  ): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + ms / 1000);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + ms / 1000 + 0.02);
  }

  play(events: GameEvent[]): void {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    const has = (t: GameEvent['t']) => events.some((e) => e.t === t);
    if (has('moved') || has('deployed')) this.tone(440, 660, 80);
    if (has('bumped')) this.tone(300, 220, 90, 'triangle', 0.1, 0.12);
    if (has('dropped')) this.tone(520, 260, 140, 'square', 0.05, 0.15);
    if (has('burned')) this.tone(600, 90, 380, 'sawtooth', 0.06, 0.15);
    if (has('extracted')) {
      this.tone(660, 660, 140, 'sine', 0.14, 0.1);
      this.tone(990, 990, 260, 'sine', 0.14, 0.24);
    }
  }
}
