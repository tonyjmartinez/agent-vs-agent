import { duelRules } from './rules';
import type { Cell, GameState, PlayerId, Rules, Spy } from './types';

/**
 * Compact ASCII board for tests. Tokens (whitespace separated, row 0 first):
 *   .  empty   i  intel   R / T  Red (P0) / Teal (P1) spy   R* / T*  carrier
 * Spy ids are assigned per owner in reading order (p0a, p0b, ...), reserve spies after.
 */
export function board(
  ascii: string,
  opts: {
    reserve?: PlayerId[];
    current?: PlayerId;
    scores?: number[];
    ply?: number;
    rules?: Partial<Rules>;
  } = {},
): GameState {
  // Fixtures test the core mechanics, so the shipped variant flags start off unless a test asks.
  const rules = duelRules({ sprint: false, fumble: false, ...opts.rules });
  const rows = ascii
    .trim()
    .split('\n')
    .map((l) => l.trim().split(/\s+/));
  if (rows.length !== rules.size) throw new Error('bad board height');
  const intel: Cell[] = [];
  const placed: { owner: PlayerId; pos: Cell | null; carrying: boolean }[] = [];
  rows.forEach((cols, r) => {
    if (cols.length !== rules.size) throw new Error(`bad row ${r}`);
    cols.forEach((tok, c) => {
      if (tok === '.') return;
      if (tok === 'i') return void intel.push({ r, c });
      const owner = 'RTPO'.indexOf(tok[0]!);
      if (owner < 0) throw new Error(`bad token ${tok}`);
      placed.push({ owner, pos: { r, c }, carrying: tok.endsWith('*') });
    });
  });
  for (const owner of opts.reserve ?? []) placed.push({ owner, pos: null, carrying: false });
  const spies: Spy[] = [];
  const counts = new Map<number, number>();
  for (const p of [...placed].sort((a, b) => a.owner - b.owner)) {
    const n = counts.get(p.owner) ?? 0;
    counts.set(p.owner, n + 1);
    spies.push({ id: `p${p.owner}${'abcdefgh'[n]}`, ...p });
  }
  return {
    rules,
    ply: opts.ply ?? 0,
    current: opts.current ?? 0,
    spies,
    intel,
    scores: opts.scores ?? rules.players.map(() => 0),
    winner: null,
  };
}

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}
