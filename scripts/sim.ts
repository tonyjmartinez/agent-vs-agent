/**
 * Headless self-play simulator (PLAN §5).
 *   npm run sim -- --games 400 --p0 hard --p1 hard --seed 1 [--swap] [--rules '{"intelToWin":2}'] [--json]
 * With --swap, bot A (--p0) and bot B (--p1) alternate seats every game; "A wins" is reported.
 */
import { performance } from 'node:perf_hooks';
import { chooseAction, type BotOpts, type Level } from '../src/ai/bots';
import { applyAction, createGame, hash, legalActions } from '../src/engine/engine';
import { duelRules } from '../src/engine/rules';
import type { Rules } from '../src/engine/types';

function arg(name: string, d: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith('--')
    ? process.argv[i + 1]!
    : d;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const games = Number(arg('games', '100'));
const A = arg('p0', 'hard') as Level;
const B = arg('p1', 'hard') as Level;
const seed = Number(arg('seed', '1'));
const swap = flag('swap');
const rulesPatch = JSON.parse(arg('rules', '{}')) as Partial<Rules>;
const botOpts = JSON.parse(arg('bot', '{}')) as BotOpts;
const rules = duelRules(rulesPatch);

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)]! : NaN;
};
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))]! : NaN;
};
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

let p0Wins = 0,
  p1Wins = 0,
  draws = 0,
  aWins = 0,
  bWins = 0;
const plies: number[] = [];
const burns: number[] = [];
const drops: number[] = [];
const extractions: number[] = [];
const firstExtract: number[] = [];
const branching: number[] = [];
const msPerMove: number[] = [];
const depths: number[] = [];
let comebacks = 0;
let passes = 0;

const t0 = performance.now();
for (let g = 0; g < games; g++) {
  const aSeat = swap && g % 2 === 1 ? 1 : 0;
  const levels: Level[] = aSeat === 0 ? [A, B] : [B, A];
  let s = createGame(rules);
  let nb = 0,
    nd = 0,
    ne = 0,
    fe = -1;
  const wasBehind = [false, false];
  const history: string[] = [];
  while (s.winner === null) {
    branching.push(legalActions(s).length);
    const t = performance.now();
    history.push(hash(s));
    const r = chooseAction(s, levels[s.current]!, seed * 1_000_003 + g * 1009 + s.ply, {
      ...botOpts,
      history,
    });
    msPerMove.push(performance.now() - t);
    if (levels[s.current] === 'hard') depths.push(r.depth);
    const res = applyAction(s, r.action);
    for (const e of res.events) {
      if (e.t === 'burned') nb++;
      else if (e.t === 'dropped') nd++;
      else if (e.t === 'extracted') {
        ne++;
        if (fe < 0) fe = res.state.ply;
      } else if (e.t === 'passed') passes++;
    }
    s = res.state;
    for (let p = 0; p < 2; p++) if (s.scores[p]! < s.scores[1 - p]!) wasBehind[p] = true;
  }
  plies.push(s.ply);
  burns.push(nb);
  drops.push(nd);
  extractions.push(ne);
  if (fe >= 0) firstExtract.push(fe);
  if (s.winner === 'draw') draws++;
  else {
    if (s.winner === 0) p0Wins++;
    else p1Wins++;
    if (s.winner === aSeat) aWins++;
    else bWins++;
    if (wasBehind[s.winner]) comebacks++;
  }
}
const elapsed = (performance.now() - t0) / 1000;

const decisive = games;
const p = p0Wins / decisive;
const ci = 1.96 * Math.sqrt((p * (1 - p)) / decisive);
const aRate = aWins / games;
const aCi = 1.96 * Math.sqrt((aRate * (1 - aRate)) / games);
const result = {
  matchup: `${A} vs ${B}${swap ? ' (swap)' : ''}`,
  rules: rulesPatch,
  games,
  p0Wins,
  p1Wins,
  draws,
  p0WinRate: `${(p * 100).toFixed(1)}% ±${(ci * 100).toFixed(1)}`,
  aWinRate: `${(aRate * 100).toFixed(1)}% ±${(aCi * 100).toFixed(1)}`,
  aWins,
  bWins,
  medianPlies: median(plies),
  p90Plies: pct(plies, 0.9),
  avgBurnsPerGame: +avg(burns).toFixed(2),
  avgDropsPerGame: +avg(drops).toFixed(2),
  avgExtractionsPerGame: +avg(extractions).toFixed(2),
  comebackPct: `${((comebacks / Math.max(1, games - draws)) * 100).toFixed(1)}%`,
  firstExtractionPlyMedian: median(firstExtract),
  avgBranchingFactor: +avg(branching).toFixed(1),
  msPerMoveP50: +median(msPerMove).toFixed(2),
  msPerMoveP95: +pct(msPerMove, 0.95).toFixed(2),
  hardDepthMedian: depths.length ? median(depths) : null,
  forcedPasses: passes,
  seconds: +elapsed.toFixed(1),
};

if (flag('json')) console.log(JSON.stringify(result));
else {
  const w = Math.max(...Object.keys(result).map((k) => k.length));
  console.log('| metric | value |\n|---|---|');
  for (const [k, v] of Object.entries(result))
    console.log(`| ${k.padEnd(w)} | ${typeof v === 'object' ? JSON.stringify(v) : v} |`);
}
