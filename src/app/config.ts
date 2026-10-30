import { BOT_LEVELS, type BotLevel } from '../ai/bots';

export type Seat = { kind: 'human' } | { kind: 'bot'; level: BotLevel };

export interface Config {
  /** Show the start menu instead of a game. */
  menu: boolean;
  /** Show first-game coach marks (off in tests unless `?coach=1`). */
  coach: boolean;
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
  // A bare URL opens the menu; anything that names a game (or `test`) goes straight to play.
  const direct = ['test', 'state', 'p0', 'p1', 'play'].some((k) => q.has(k));
  const test = dev || q.has('test');
  return {
    menu: q.get('menu') === '1' || !direct,
    coach: q.get('coach') === '1' || (!test && !q.has('state')),
    seats: [seat('p0'), seat('p1')],
    seed: num('seed', 1),
    mode: 'duel',
    speed: num('speed', 1),
    test,
    state: q.get('state'),
    confirm: confirm === null ? coarsePointer : confirm === '1',
  };
}
