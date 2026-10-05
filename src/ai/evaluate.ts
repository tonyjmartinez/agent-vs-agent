import { KING_DIRS, add, cheb, eq, inBounds, sub } from '../engine/board';
import type { Cell, GameState, PlayerId, Spy } from '../engine/types';

export const WIN = 100_000;

export interface EvalWeights {
  score: number;
  carrying: number;
  carrierDist: number;
  reserve: number;
  burnThreat: number;
  dropThreat: number;
  intelDist: number;
  /** Fraction of threat weight applied to the side that moves next (it can still dodge). */
  moverThreatScale: number;
}

export const defaultWeights: EvalWeights = {
  score: 1000,
  carrying: 120,
  carrierDist: 25,
  reserve: 90,
  burnThreat: 40,
  dropThreat: 60,
  intelDist: 6,
  moverThreatScale: 0.3,
};

const zoneDist = (s: GameState, owner: PlayerId, p: Cell): number => {
  let best = Infinity;
  for (const z of s.rules.players[owner]!.zone) best = Math.min(best, cheb(z, p));
  return best;
};

/** Can any enemy of `owner` arrive on empty cell q next ply (move or deploy)? */
function enemyCanReach(s: GameState, owner: PlayerId, q: Cell): boolean {
  if (s.spies.some((x) => eq(x.pos, q))) return false;
  const king = s.rules.movement === 'king';
  for (const e of s.spies) {
    if (e.owner === owner) continue;
    if (e.pos) {
      const d = sub(q, e.pos);
      const adj = king ? cheb(e.pos, q) === 1 : Math.abs(d.r) + Math.abs(d.c) === 1;
      if (adj && !(e.carrying && s.intel.some((i) => eq(i, q)))) return true;
    } else if (s.rules.players[e.owner]!.zone.some((z) => eq(z, q))) return true;
  }
  return false;
}

/** What an enemy bump next ply could do to this spy. */
export function threatOn(s: GameState, spy: Spy): 'burn' | 'drop' | null {
  if (!spy.pos) return null;
  let worst: 'burn' | 'drop' | null = null;
  for (const d of KING_DIRS) {
    const q = sub(spy.pos, d);
    if (!inBounds(q, s.rules.size)) continue;
    const t = add(spy.pos, d);
    const off = !inBounds(t, s.rules.size);
    if (!off && s.spies.some((x) => eq(x.pos, t))) continue; // braced
    if (!off && !spy.carrying) continue; // harmless shove
    if (!enemyCanReach(s, spy.owner, q)) continue;
    if (off) return 'burn';
    worst = 'drop';
  }
  return worst;
}

/** Heuristic value of `s` from player `me`'s perspective (PLAN 4.4). */
export function evaluate(s: GameState, me: PlayerId, w: EvalWeights = defaultWeights): number {
  if (s.winner !== null) {
    if (s.winner === 'draw') return 0;
    return s.winner === me ? WIN - s.ply : -(WIN - s.ply);
  }
  let v = 0;
  for (let p = 0; p < s.scores.length; p++) {
    const sign = p === me ? 1 : -1 / (s.scores.length - 1);
    v += sign * w.score * s.scores[p]!;
  }
  for (const sp of s.spies) {
    const sign = sp.owner === me ? 1 : -1;
    if (!sp.pos) {
      v -= sign * w.reserve;
      continue;
    }
    if (sp.carrying) v += sign * (w.carrying - w.carrierDist * zoneDist(s, sp.owner, sp.pos));
    else if (s.intel.length) {
      let best = Infinity;
      for (const i of s.intel) best = Math.min(best, cheb(i, sp.pos));
      v -= sign * w.intelDist * best;
    }
    const threat = threatOn(s, sp);
    if (threat) {
      const scale = sp.owner === s.current ? w.moverThreatScale : 1;
      v -=
        sign *
        scale *
        (threat === 'burn' ? w.burnThreat + (sp.carrying ? w.dropThreat : 0) : w.dropThreat);
    }
  }
  return v;
}
