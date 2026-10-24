/**
 * Mine mission (puzzle) candidates from seeded self-play:
 *   npx tsx scripts/missions.ts [--games 300] [--seed 1]
 * A candidate is a Red-to-move position (no fumble locks, so it round-trips through the
 * compact state string) where a goal is forced within N moves, not within N-1, and at most
 * a third of Red's first moves work. Prints JSON lines; curate them into src/missions.ts.
 */
import { chooseAction } from '../src/ai/bots';
import { mulberry32, pick } from '../src/ai/rng';
import { Solver, type Goal } from '../src/ai/solve';
import { applyTrusted, createGame, legalActions } from '../src/engine/engine';
import { duelRules } from '../src/engine/rules';
import { decode, encode } from '../src/engine/serialize';
import type { GameState } from '../src/engine/types';

const args = process.argv.slice(2);
const opt = (k: string, d: number) => (args.includes(k) ? Number(args[args.indexOf(k) + 1]) : d);
const games = opt('--games', 300);
const seed0 = opt('--seed', 1);

const seen = new Set<string>();
const goals: Goal[] = ['win', 'extract', 'burn'];

function consider(s: GameState): void {
  if (s.current !== 0 || s.winner !== null || s.ply > 100 || (s.locks && s.locks.length)) return;
  const code = encode(s);
  if (seen.has(code)) return;
  seen.add(code);
  const fresh = decode(code); // must round-trip exactly
  if (encode(fresh) !== code) return;
  for (const goal of goals) {
    for (const moves of [1, 2]) {
      const solver = new Solver(fresh, goal);
      if (!solver.canForce(fresh, moves)) continue;
      if (moves > 1 && new Solver(fresh, goal).canForce(fresh, moves - 1)) continue;
      const total = legalActions(fresh).length;
      const sols = solver.solutions(fresh, moves);
      if (sols.length * 3 > total) continue;
      console.log(JSON.stringify({ goal, moves, state: code, sols: sols.length, total }));
    }
  }
}

for (let g = 0; g < games; g++) {
  const rng = mulberry32(seed0 * 7919 + g);
  let s = createGame(duelRules());
  while (s.winner === null) {
    consider(s);
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
