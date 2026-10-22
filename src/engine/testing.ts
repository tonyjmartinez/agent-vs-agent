import { SIZE } from './board';
import { duelRules } from './rules';
import type { GameState, PlayerId, Rules, Spy, Cell } from './types';

export interface BoardOptions {
  rules?: Partial<Rules>;
  current?: PlayerId;
  scores?: number[];
  ply?: number;
}

/**
 * Build a state from an ASCII board. Tokens (whitespace separated, 6 per row, 6 rows):
 * `.` empty, `R`/`T` a spy of player 0/1, `*` after it marks a carrier, `i` intel,
 * and `Ri` / `R*i` a spy standing on an intel cell. Spies are numbered p0a, p0b... in scan order;
 * spies not on the board are in reserve (so a player with one `R` has one spy in reserve).
 * `intelOnBoard` is set to the intel cells plus carriers so the intel invariant holds.
 */
export function board(text: string, opts: BoardOptions = {}): GameState {
  const rows = text
    .trim()
    .split('\n')
    .map((l) => l.trim().split(/\s+/));
  if (rows.length !== SIZE || rows.some((r) => r.length !== SIZE))
    throw new Error('board must be 6x6');
  const spies: Spy[] = [];
  const intel: Cell[] = [];
  const count = [0, 0];
  rows.forEach((row, r) =>
    row.forEach((tok, c) => {
      const m = /^([RT]?)(\*?)(i?)$/.exec(tok);
      if (tok === '.') return;
      if (!m || (tok !== 'i' && !m[1])) throw new Error(`bad token ${tok} at ${r},${c}`);
      if (m[1]) {
        const owner = m[1] === 'R' ? 0 : 1;
        spies.push({
          id: `p${owner}${'abcdefgh'[count[owner]!]}`,
          owner,
          pos: { r, c },
          carrying: m[2] === '*',
        });
        count[owner]!++;
      }
      if (m[3]) intel.push({ r, c });
    }),
  );
  const carriers = spies.filter((p) => p.carrying).length;
  const rules = duelRules({ intelOnBoard: intel.length + carriers, ...opts.rules });
  for (let owner = 0; owner < rules.players.length; owner++) {
    for (let i = count[owner] ?? 0; i < rules.spiesPerPlayer; i++) {
      spies.push({ id: `p${owner}${'abcdefgh'[i]}`, owner, pos: null, carrying: false });
    }
  }
  spies.sort((a, b) => (a.id < b.id ? -1 : 1));
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

/** Inverse of `board` (reserve spies are implied). Handy for readable assertions. */
export function render(s: GameState): string {
  const at = (r: number, c: number) => {
    const spy = s.spies.find((p) => p.pos && p.pos.r === r && p.pos.c === c);
    const i = s.intel.some((x) => x.r === r && x.c === c);
    if (!spy) return i ? 'i' : '.';
    return `${spy.owner === 0 ? 'R' : 'T'}${spy.carrying ? '*' : ''}${i ? 'i' : ''}`;
  };
  return Array.from({ length: SIZE }, (_, r) =>
    Array.from({ length: SIZE }, (_, c) => at(r, c)).join(' '),
  ).join('\n');
}
