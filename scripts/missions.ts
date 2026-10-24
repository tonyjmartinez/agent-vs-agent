/**
 * Mine mission (puzzle) candidates from seeded self-play:
 *   npx tsx scripts/missions.ts [--games 300] [--seed 1] [--moves 1,2]
 * Prints JSON lines; curate them into src/missions.ts (and see scripts/dailyPool.ts for the daily pool).
 */
import { mine } from './mine';

const args = process.argv.slice(2);
const opt = (k: string, d: number) => (args.includes(k) ? Number(args[args.indexOf(k) + 1]) : d);

const budgets = (args.includes('--moves') ? args[args.indexOf('--moves') + 1]! : '1,2')
  .split(',')
  .map(Number);

for (const c of mine(opt('--games', 300), opt('--seed', 1), budgets)) {
  console.log(
    JSON.stringify({ goal: c.goal, moves: c.moves, state: c.state, sols: c.sols, total: c.total }),
  );
}
