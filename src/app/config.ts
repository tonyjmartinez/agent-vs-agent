import { BOT_LEVELS, type BotLevel } from '../ai/bots';

export type Seat = { kind: 'human' } | { kind: 'bot'; level: BotLevel };

export interface Config {
  /** Who controls each seat (`?p0=human&p1=bot:hard`). */
  seats: Seat[];
  seed: number;
  mode: 'duel';
  /** Animation speed multiplier; 0 disables animation (tests). */
  speed: number;
  test: boolean;
  /** Compact serialized start position (`?state=`), if any. */
  state: string | null;
  /** Tap-twice-to-commit (default on for coarse pointers). */
  confirm: boolean;
}

export function parseConfig(search: string, coarsePointer: boolean, dev = false): Config {
  const q = new URLSearchParams(search);
  const num = (k: string, d: number) => {
    const v = q.get(k);
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) && n >= 0 ? n : d;
  };
  const seat = (k: string): Seat => {
    const m = /^bot:(\w+)$/.exec(q.get(k) ?? '');
    return m && BOT_LEVELS.includes(m[1] as BotLevel)
      ? { kind: 'bot', level: m[1] as BotLevel }
      : { kind: 'human' };
  };
  const confirm = q.get('confirm');
  return {
    seats: [seat('p0'), seat('p1')],
    seed: num('seed', 1),
    mode: 'duel',
    speed: num('speed', 1),
    test: dev || q.has('test'),
    state: q.get('state'),
    confirm: confirm === null ? coarsePointer : confirm === '1',
  };
}
