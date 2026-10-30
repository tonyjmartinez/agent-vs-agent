import { BOT_LEVELS, type BotLevel } from '../src/ai/bots';
import type { SearchBudget } from '../src/ai/search';
import { runSim } from '../src/ai/simulate';

/** Headless self-play: `npm run sim -- --games 400 --p0 hard --p1 hard --seed 1 [--swap] [--rules '{"firstMoveNoBump":true}']`. */
function parse(argv: string[]) {
  const o = {
    games: 200,
    p0: 'hard' as BotLevel,
    p1: 'hard' as BotLevel,
    seed: 1,
    swap: false,
    rules: {},
    randomPlies: 2,
    budget: undefined as Partial<SearchBudget> | undefined,
  };
  const level = (v: string | undefined): BotLevel => {
    if (!BOT_LEVELS.includes(v as BotLevel)) {
      throw new Error(`bad level: ${v} (use ${BOT_LEVELS.join('|')})`);
    }
    return v as BotLevel;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = () => argv[++i];
    if (a === '--games') o.games = Number(next());
    else if (a === '--p0') o.p0 = level(next());
    else if (a === '--p1') o.p1 = level(next());
    else if (a === '--seed') o.seed = Number(next());
    else if (a === '--swap') o.swap = true;
    else if (a === '--rules') o.rules = JSON.parse(next() ?? '{}');
    else if (a === '--nodes')
      o.budget = { ...o.budget, maxNodes: Number(next()), timeMs: Infinity };
    else if (a === '--depth') o.budget = { ...o.budget, maxDepth: Number(next()) };
    else if (a === '--random-plies') o.randomPlies = Number(next());
    else throw new Error(`unknown flag: ${a}`);
  }
  return o;
}

const opts = parse(process.argv.slice(2));
const t0 = Date.now();
const r = runSim(opts);
const f = (x: number, d = 2) => x.toFixed(d);
const ci = (c: number[]) => `[${f(c[0]! * 100, 1)}%, ${f(c[1]! * 100, 1)}%]`;
console.log(
  `\n${opts.p0} (A) vs ${opts.p1} (B)  games=${r.games} swap=${opts.swap} seed=${opts.seed}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
);
console.table({
  'A wins / B wins / draws': `${r.aWins} / ${r.bWins} / ${r.draws}`,
  'A win rate (95% CI)': `${f(r.aWinRate * 100, 1)}% ${ci(r.aWinRateCI95)}`,
  'seat 0 win rate (95% CI)': `${f(r.seat0WinRate * 100, 1)}% ${ci(r.seat0WinRateCI95)}`,
  'draw rate': `${f(r.drawRate * 100, 1)}%`,
  'plies median / p90': `${r.medianPlies} / ${r.p90Plies}`,
  'burns / drops / extractions per game': `${f(r.avgBurnsPerGame)} / ${f(r.avgDropsPerGame)} / ${f(r.avgExtractionsPerGame)}`,
  'comeback games': `${f(r.comebackPct * 100, 1)}%`,
  'first extraction ply (median)': r.firstExtractionPlyMedian,
  'forced passes': r.forcedPasses,
  'avg branching factor': f(r.avgBranchingFactor, 1),
  'ms/move A mean / p95 / max': `${f(r.msPerMoveA.mean)} / ${f(r.msPerMoveA.p95)} / ${f(r.msPerMoveA.max)}`,
  'ms/move B mean / p95 / max': `${f(r.msPerMoveB.mean)} / ${f(r.msPerMoveB.p95)} / ${f(r.msPerMoveB.max)}`,
});
console.log(JSON.stringify(r));
