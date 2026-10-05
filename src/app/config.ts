export type BotLevel = 'random' | 'easy' | 'medium' | 'hard';
export type Seat = { kind: 'human' } | { kind: 'bot'; level: BotLevel };

export interface AppConfig {
  seed: number;
  seats: [Seat, Seat];
  mode: 'duel';
  speed: number;
  test: boolean;
  state: string | null;
  /** true → skip the start menu and go straight into a game (any game param given). */
  direct: boolean;
  confirmTouch: boolean | null;
}

export function parseSeat(v: string | null, fallback: Seat): Seat {
  if (!v) return fallback;
  if (v === 'human') return { kind: 'human' };
  const m = /^bot:(random|easy|medium|hard)$/.exec(v);
  return m ? { kind: 'bot', level: m[1] as BotLevel } : fallback;
}

export function parseConfig(search: string): AppConfig {
  const q = new URLSearchParams(search);
  const num = (k: string, d: number) => {
    const v = Number(q.get(k));
    return q.has(k) && Number.isFinite(v) ? v : d;
  };
  const seats: [Seat, Seat] = [
    parseSeat(q.get('p0'), { kind: 'human' }),
    parseSeat(q.get('p1'), { kind: 'human' }),
  ];
  const confirm = q.get('confirm');
  return {
    seed: num('seed', 0) || 0,
    seats,
    mode: 'duel',
    speed: num('speed', 1),
    test: q.get('test') === '1',
    state: q.get('state'),
    direct: q.has('p0') || q.has('p1') || q.has('state'),
    confirmTouch: confirm === null ? null : confirm === '1',
  };
}
