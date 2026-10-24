import type { GameEvent, GameState, PlayerId } from './types';

/** What one player did over a game (shown on the game-over card). */
export interface PlayerStats {
  /** Actions taken (moves, deploys and passes). */
  turns: number;
  /** Enemy spies this player burned off the board. */
  burns: number;
  /** This player's spies that were burned (by anyone, including their own bump). */
  burned: number;
  /** Enemy carriers this player bumped into dropping their intel. */
  steals: number;
  /** Enemy spies this player shoved aside (burning or dropping one still counts as a shove). */
  shoves: number;
  /** Intel banked. */
  extractions: number;
}

export type MatchStats = PlayerStats[];

export const emptyStats = (players: number): MatchStats =>
  Array.from({ length: players }, () => ({
    turns: 0,
    burns: 0,
    burned: 0,
    steals: 0,
    shoves: 0,
    extractions: 0,
  }));

/**
 * Fold one action into the stats. `before` is the state the action was played from (spy owners are
 * looked up there) and `events` are what it produced. Pure: returns a new array.
 */
export function addAction(stats: MatchStats, before: GameState, events: GameEvent[]): MatchStats {
  const next = stats.map((p) => ({ ...p }));
  const mover: PlayerId = before.current;
  const ownerOf = (id: string): PlayerId => before.spies.find((s) => s.id === id)!.owner;
  next[mover]!.turns++;
  for (const e of events) {
    switch (e.t) {
      case 'burned': {
        const victim = ownerOf(e.spyId);
        next[victim]!.burned++;
        if (victim !== mover) next[mover]!.burns++; // bumping your own spy off is not a burn
        break;
      }
      case 'bumped':
        if (ownerOf(e.spyId) !== mover) next[mover]!.shoves++;
        break;
      case 'dropped':
        if (ownerOf(e.spyId) !== mover) next[mover]!.steals++;
        break;
      case 'extracted':
        next[e.owner]!.extractions++;
        break;
      default:
        break;
    }
  }
  return next;
}
