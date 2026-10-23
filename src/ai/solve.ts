import { applyTrusted, hash, legalActions } from '../engine/engine';
import type { Action, GameState, PlayerId } from '../engine/types';

/**
 * Mission goals, judged right after one of the solver's (the player's) own moves:
 * - win: the game is won.
 * - extract: the player's score went up since the mission started.
 * - burn: more enemy spies sit in reserve than when the mission started.
 */
export type Goal = 'win' | 'extract' | 'burn';

const enemyReserve = (s: GameState, me: PlayerId): number =>
  s.spies.filter((x) => x.owner !== me && !x.pos).length;

export function goalMet(start: GameState, s: GameState, goal: Goal, me: PlayerId): boolean {
  switch (goal) {
    case 'win':
      return s.winner === me;
    case 'extract':
      return s.scores[me]! > start.scores[me]!;
    case 'burn':
      return enemyReserve(s, me) > enemyReserve(start, me);
  }
}

/**
 * AND-OR search: can `me` (to move in `s`) force `goal` within `moves` of its own moves,
 * whatever the opponent replies? A reply that wins the game for the opponent refutes.
 */
export class Solver {
  private memo = new Map<string, boolean>();
  constructor(
    private start: GameState,
    private goal: Goal,
    private me: PlayerId = start.current,
  ) {}

  /** `s` has `me` to move. */
  canForce(s: GameState, moves: number): boolean {
    if (moves <= 0 || s.winner !== null || s.current !== this.me) return false;
    const k = `${hash(s)}|${s.ply}|${moves}`;
    const hit = this.memo.get(k);
    if (hit !== undefined) return hit;
    let ok = false;
    for (const a of legalActions(s)) {
      if (this.forcesAfter(applyTrusted(s, a).state, moves - 1)) {
        ok = true;
        break;
      }
    }
    this.memo.set(k, ok);
    return ok;
  }

  /** `t` is the position right after one of my moves, with `left` moves still to spend. */
  private forcesAfter(t: GameState, left: number): boolean {
    if (goalMet(this.start, t, this.goal, this.me)) return true;
    if (left <= 0 || t.winner !== null) return false;
    return this.replies(t).every((u) => this.canForce(u, left));
  }

  private replies(t: GameState): GameState[] {
    return legalActions(t).map((r) => applyTrusted(t, r).state);
  }

  /** All first moves (for `me`, to move in `s`) that force the goal within `moves`. */
  solutions(s: GameState, moves: number): Action[] {
    return legalActions(s).filter((a) => this.forcesAfter(applyTrusted(s, a).state, moves - 1));
  }

  /**
   * The defender's reply in `t` (opponent to move) with `left` of my moves remaining:
   * a reply that leaves no forced win if one exists, otherwise the first legal reply.
   */
  defend(t: GameState, left: number): Action {
    const acts = legalActions(t);
    for (const r of acts) {
      const u = applyTrusted(t, r).state;
      if (u.winner !== null && u.winner !== this.me) return r; // opponent wins outright
    }
    for (const r of acts) {
      if (!this.canForce(applyTrusted(t, r).state, left)) return r;
    }
    return acts[0]!;
  }
}
