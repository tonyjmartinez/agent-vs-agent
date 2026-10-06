export type BotLevel = 'random' | 'easy' | 'medium' | 'hard';
export type Seat = { kind: 'human' } | { kind: 'bot'; level: BotLevel };

/** Rule flags that can be switched on from the URL: `?rules=escort,fumble`. */
export const RULE_FLAGS = ['escort', 'fumble', 'firstMoveNoBump'] as const;
export type RuleFlag = (typeof RULE_FLAGS)[number];

export interface AppConfig {
  /** Rule overrides from `?rules=` (flag list) and `?win=N`. */
  rules: Partial<Record<RuleFlag, boolean>> & { intelToWin?: number };
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
  const rules: AppConfig['rules'] = {};
  for (const f of (q.get('rules') ?? '').split(',')) {
    if ((RULE_FLAGS as readonly string[]).includes(f)) rules[f as RuleFlag] = true;
  }
  const win = num('win', 0);
  if (win >= 1 && win <= 9) rules.intelToWin = Math.floor(win);
  return {
    rules,
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
