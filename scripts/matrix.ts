import { writeFileSync } from 'node:fs';
import { BOT_LEVELS, type BotLevel } from '../src/ai/bots';
import { runSim } from '../src/ai/simulate';
import type { Cell, Rules } from '../src/engine/types';

/**
 * Knob matrix (PLAN.md phase 5): `npm run matrix -- --level medium --games 400 [--nodes N] [--out file.md]`.
 * Prints and writes a markdown table: one row per rules variant, seat-swapped self-play.
 */
const args = process.argv.slice(2);
const opt = (k: string, d: string) => (args.includes(k) ? args[args.indexOf(k) + 1]! : d);
const level = opt('--level', 'medium') as BotLevel;
if (!BOT_LEVELS.includes(level)) throw new Error(`bad level ${level}`);
const games = Number(opt('--games', '400'));
const nodes = args.includes('--nodes') ? Number(opt('--nodes', '3000')) : undefined;
const out = opt('--out', 'artifacts/matrix.md');

/**
 * Starting intel must be symmetric under the 180-degree board rotation, or one seat starts closer to it
 * (1 or 3 intel cannot be symmetric on a 6x6 board), so only 2 and 4 are meaningful for balance.
 */
const STARTS: Record<number, Cell[]> = {
  2: [
    { r: 2, c: 2 },
    { r: 3, c: 3 },
  ],
  4: [
    { r: 2, c: 2 },
    { r: 3, c: 3 },
    { r: 2, c: 3 },
    { r: 3, c: 2 },
  ],
};

const rows: string[] = [
  `| intelToWin | intelOnBoard | movement | bumpOwn | seat0 win% | draw% | median plies | p90 | burns | drops | comeback% | first extract ply |`,
  `|---|---|---|---|---|---|---|---|---|---|---|---|`,
];
for (const movement of ['king', 'orthogonal'] as const) {
  for (const bumpOwnSpies of [true, false]) {
    for (const intelOnBoard of [2, 4]) {
      for (const intelToWin of [2, 3, 4]) {
        const rules: Partial<Rules> = {
          movement,
          bumpOwnSpies,
          intelOnBoard,
          intelToWin,
          intelStart: STARTS[intelOnBoard]!,
        };
        const r = runSim({
          games,
          p0: level,
          p1: level,
          seed: 1,
          swap: true,
          rules,
          randomPlies: 2,
          budget: nodes ? { maxNodes: nodes, timeMs: Infinity } : undefined,
        });
        const decided = r.games - r.draws;
        const seat0 = decided ? (r.seat0Wins / decided) * 100 : 0;
        const line = `| ${intelToWin} | ${intelOnBoard} | ${movement} | ${bumpOwnSpies} | ${seat0.toFixed(1)} | ${(r.drawRate * 100).toFixed(1)} | ${r.medianPlies} | ${r.p90Plies} | ${r.avgBurnsPerGame.toFixed(2)} | ${r.avgDropsPerGame.toFixed(1)} | ${(r.comebackPct * 100).toFixed(1)} | ${r.firstExtractionPlyMedian} |`;
        rows.push(line);
        console.log(line);
      }
    }
  }
}
writeFileSync(
  out,
  `Level: ${level}, games per row: ${games}, seat-swapped, 2 random opening plies.\n\n${rows.join('\n')}\n`,
);
