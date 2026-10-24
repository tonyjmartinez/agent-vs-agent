/**
 * Shared puzzle miner: seeded self-play, yielding Red-to-move positions where a goal is forced within
 * N moves, not within N-1, and at most a third of Red's first moves work. Positions with fumble locks
 * are skipped, because the compact state string doesn't carry locks (they must round-trip exactly).
 */
import { chooseAction } from '../src/ai/bots';
import { mulberry32, pick } from '../src/ai/rng';
import { Solver, type Goal } from '../src/ai/solve';
import { applyTrusted, createGame, legalActions } from '../src/engine/engine';
import { duelRules } from '../src/engine/rules';
import { decode, encode } from '../src/engine/serialize';
import type { Action, GameState } from '../src/engine/types';

export interface Candidate {
  goal: Goal;
  moves: number;
  state: string;
  /** How many of Red's first moves force the goal. */
  sols: number;
  /** Red's legal first moves. */
  total: number;
  /** Ply of the position (game phase). */
  ply: number;
  /** The first forcing move (kind + destination), for diversity. */
  first: Action;
}

const GOALS: Goal[] = ['win', 'extract', 'burn'];

export function* mine(games: number, seed0: number): Generator<Candidate> {
  const seen = new Set<string>();
  for (let g = 0; g < games; g++) {
    const rng = mulberry32(seed0 * 7919 + g);
    let s: GameState = createGame(duelRules());
    while (s.winner === null) {
      yield* consider(s, seen);
      // Red alternates easy/medium per game so both early skirmishes and late-game spots appear.
      const red = g % 2 ? 'medium' : 'easy';
      const level = s.ply < 4 ? 'random' : s.current === 0 ? red : 'medium';
      const a =
        level === 'random'
          ? pick(rng, legalActions(s))
          : chooseAction(s, level, seed0 * 100_003 + g * 131 + s.ply).action;
      s = applyTrusted(s, a).state;
    }
  }
}

function* consider(s: GameState, seen: Set<string>): Generator<Candidate> {
  if (s.current !== 0 || s.winner !== null || s.ply > 100 || (s.locks && s.locks.length)) return;
  const code = encode(s);
  if (seen.has(code)) return;
  seen.add(code);
  const fresh = decode(code);
  if (encode(fresh) !== code) return;
  for (const goal of GOALS) {
    for (const moves of [1, 2]) {
      const solver = new Solver(fresh, goal);
      if (!solver.canForce(fresh, moves)) continue;
      if (moves > 1 && new Solver(fresh, goal).canForce(fresh, moves - 1)) continue;
      const total = legalActions(fresh).length;
      const sols = solver.solutions(fresh, moves);
      if (sols.length * 3 > total) continue;
      yield { goal, moves, state: code, sols: sols.length, total, ply: fresh.ply, first: sols[0]! };
    }
  }
}
