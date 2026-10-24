import type { Solver } from './ai/solve';
import type { GameState } from './engine/types';

/**
 * Which piece to select to point at a forcing line: a spy id, or `'reserve'` when the line deploys.
 * It names the piece, never the destination, and `null` when no forced line is left (already refuted).
 * `left` is the Red move budget still to spend (`Solver.solutions` takes it directly).
 */
export function hintSelection(
  solver: Solver,
  s: GameState,
  left: number,
): string | 'reserve' | null {
  const a = solver.solutions(s, left)[0];
  if (!a || a.kind === 'pass') return null;
  return a.kind === 'deploy' ? 'reserve' : a.spyId;
}
