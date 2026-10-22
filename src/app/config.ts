export interface Config {
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
  const confirm = q.get('confirm');
  return {
    seed: num('seed', 1),
    mode: 'duel',
    speed: num('speed', 1),
    test: dev || q.has('test'),
    state: q.get('state'),
    confirm: confirm === null ? coarsePointer : confirm === '1',
  };
}
