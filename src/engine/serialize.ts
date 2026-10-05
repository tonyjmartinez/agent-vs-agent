import { cmpCell } from './board';
import { duelRules } from './rules';
import type { Cell, GameState, Rules } from './types';

export const toJSON = (s: GameState): string => JSON.stringify(s);
export const fromJSON = (j: string): GameState => JSON.parse(j) as GameState;

const enc = (p: Cell | null) => (p ? `${p.r}${p.c}` : 'x');
const dec = (t: string): Cell => ({ r: Number(t[0]), c: Number(t[1]) });

/**
 * Compact URL-safe position string (rules are not included):
 *   v1.<current>.<ply>.<score0>-<score1>.<spy,spy,...>.<intel cells>
 * where each spy is "rc", "rc*" (carrying) or "x" (reserve), in spy-id order.
 * Example start: v1.0.0.0-0.51,54,01,04.2233
 */
export function encode(s: GameState): string {
  return [
    'v1',
    s.current,
    s.ply,
    s.scores.join('-'),
    s.spies.map((x) => enc(x.pos) + (x.carrying ? '*' : '')).join(','),
    s.intel.map(enc).join(''),
  ].join('.');
}

export function decode(str: string, rules: Rules = duelRules()): GameState {
  const [v, cur, ply, sc, sp, it = ''] = str.split('.');
  if (v !== 'v1' || cur === undefined || ply === undefined || !sc || !sp)
    throw new Error('bad state string');
  const scores = sc.split('-').map(Number);
  const tokens = sp.split(',');
  if (tokens.length !== rules.players.length * rules.spiesPerPlayer)
    throw new Error('bad spy count');
  const spies = tokens.map((t, i) => {
    const owner = Math.floor(i / rules.spiesPerPlayer);
    const letter = 'abcdefgh'[i % rules.spiesPerPlayer];
    return {
      id: `p${owner}${letter}`,
      owner,
      pos: t.startsWith('x') ? null : dec(t),
      carrying: t.endsWith('*'),
    };
  });
  const intel: Cell[] = [];
  for (let i = 0; i + 1 < it.length; i += 2) intel.push(dec(it.slice(i, i + 2)));
  return {
    rules,
    ply: Number(ply),
    current: Number(cur),
    spies,
    intel: intel.sort(cmpCell),
    scores,
    winner: null,
  };
}
