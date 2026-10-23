import { KING_DIRS, SIZE, add, inBounds, key } from '../engine/board';
import { legalActions } from '../engine/engine';
import type { Cell, GameState, PlayerId, Spy } from '../engine/types';

export const WIN = 100_000;

/** Weights from PLAN.md 4.4; tuned by the Phase 5 balance pass. */
export const W = {
  score: 1000,
  carry: 120,
  carryDist: 25,
  reserve: 90,
  edge: 40,
  mobility: 5,
  /** Per cell of distance from an empty-handed spy to the nearest intel: gives the bots a reason to go get it. */
  seek: 15,
};

const cheb = (a: Cell, b: Cell): number => Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c));

/** Can an enemy step next to this edge spy and bump it straight off the board? */
function edgeThreat(s: GameState, spy: Spy, occ: Set<number>): boolean {
  const p = spy.pos!;
  for (const d of KING_DIRS) {
    if (inBounds(add(p, d))) continue; // pushing along d would not leave the board
    const a = { r: p.r - d.r, c: p.c - d.c }; // the cell the bumper must arrive on
    if (!inBounds(a) || occ.has(key(a))) continue;
    for (const e of s.spies) {
      if (e.owner !== spy.owner && e.pos && cheb(e.pos, a) === 1) return true;
    }
  }
  return false;
}

/** Static evaluation from `me`'s point of view. Terminal positions are +-(WIN - ply). */
export function evaluate(s: GameState, me: PlayerId): number {
  if (s.winner !== null) {
    if (s.winner === 'draw') return 0;
    return s.winner === me ? WIN - s.ply : -(WIN - s.ply);
  }
  const n = s.rules.players.length;
  const occ = new Set<number>();
  for (const p of s.spies) if (p.pos) occ.add(key(p.pos));
  let total = 0;
  for (let player = 0; player < n; player++) {
    const sign = player === me ? 1 : -1 / (n - 1);
    let v = s.scores[player]! * W.score;
    const zone = s.rules.players[player]!.extraction;
    for (const spy of s.spies) {
      if (spy.owner !== player) continue;
      if (!spy.pos) {
        v -= W.reserve;
        continue;
      }
      if (!spy.carrying && s.intel.length > 0) {
        v -= W.seek * Math.min(...s.intel.map((i) => cheb(i, spy.pos!)));
      }
      if (spy.carrying) {
        const dist = Math.min(...zone.map((z) => cheb(z, spy.pos!)));
        v += W.carry - W.carryDist * dist;
      }
      const onEdge =
        spy.pos.r === 0 || spy.pos.c === 0 || spy.pos.r === SIZE - 1 || spy.pos.c === SIZE - 1;
      if (onEdge && edgeThreat(s, spy, occ)) v -= W.edge;
    }
    total += sign * v;
  }
  const moves = legalActions(s).length;
  total += (s.current === me ? 1 : -1 / (n - 1)) * W.mobility * moves;
  return total;
}
