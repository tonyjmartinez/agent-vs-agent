import { applyAction, createGame, legalActions } from '../engine/engine';
import { duelRules } from '../engine/rules';
import type { GameState, Rules } from '../engine/types';
import { makeBot, type Bot, type BotLevel } from './bots';
import { mulberry32 } from './rng';
import type { SearchBudget } from './search';

export interface GameStats {
  /** Seat index that won, or 'draw'. */
  winner: number | 'draw';
  plies: number;
  burns: number;
  drops: number;
  extractions: number;
  firstExtractionPly: number | null;
  /** The winner trailed on score at some point. */
  comeback: boolean;
  passes: number;
  branchingSum: number;
  moveMs: [number[], number[]];
}

/** Play one game between two bots; the first `randomPlies` plies are uniform random for variety. */
export function playGame(
  bots: [Bot, Bot],
  rules: Rules,
  rnd: () => number,
  randomPlies: number,
  now: () => number,
): GameStats {
  let s: GameState = createGame(rules);
  const st: GameStats = {
    winner: 'draw',
    plies: 0,
    burns: 0,
    drops: 0,
    extractions: 0,
    firstExtractionPly: null,
    comeback: false,
    passes: 0,
    branchingSum: 0,
    moveMs: [[], []],
  };
  const trailed = new Set<number>();
  while (s.winner === null) {
    const acts = legalActions(s);
    st.branchingSum += acts.length;
    if (acts.length === 1 && acts[0]!.kind === 'pass') st.passes++;
    let action = acts[Math.floor(rnd() * acts.length)]!;
    if (s.ply >= randomPlies) {
      const t0 = now();
      action = bots[s.current]!.choose(s);
      st.moveMs[s.current]!.push(now() - t0);
    }
    const { state, events } = applyAction(s, action);
    for (const e of events) {
      if (e.t === 'burned') st.burns++;
      else if (e.t === 'dropped') st.drops++;
      else if (e.t === 'extracted') {
        st.extractions++;
        st.firstExtractionPly ??= s.ply;
      }
    }
    state.scores.forEach((v, p) => {
      if (state.scores.some((o, q) => q !== p && o > v)) trailed.add(p);
    });
    s = state;
  }
  st.plies = s.ply;
  st.winner = s.winner as number | 'draw';
  st.comeback = st.winner !== 'draw' && trailed.has(st.winner);
  return st;
}

export interface SimOptions {
  games: number;
  p0: BotLevel;
  p1: BotLevel;
  seed: number;
  swap: boolean;
  rules: Partial<Rules>;
  randomPlies: number;
  /** Override the search budget of medium/hard bots (e.g. fewer nodes for quick tuning runs). */
  budget?: Partial<SearchBudget>;
}

const pct = (xs: number[], q: number): number => {
  if (xs.length === 0) return 0;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(q * a.length))]!;
};

/** Wilson 95% interval for a proportion. */
export function wilson(wins: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.96;
  const p = wins / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - m) / d, (c + m) / d];
}

export function runSim(o: SimOptions, now: () => number = () => performance.now()) {
  const rules = duelRules(o.rules);
  const all: GameStats[] = [];
  let aWins = 0;
  let bWins = 0;
  let seat0Wins = 0;
  let seat1Wins = 0;
  let draws = 0;
  const msA: number[] = [];
  const msB: number[] = [];
  for (let g = 0; g < o.games; g++) {
    const flipped = o.swap && g % 2 === 1;
    const seatLevels: [BotLevel, BotLevel] = flipped ? [o.p1, o.p0] : [o.p0, o.p1];
    const bots: [Bot, Bot] = [
      makeBot(seatLevels[0], o.seed * 100_003 + g * 2, o.budget),
      makeBot(seatLevels[1], o.seed * 100_003 + g * 2 + 1, o.budget),
    ];
    const st = playGame(bots, rules, mulberry32(o.seed * 7919 + g), o.randomPlies, now);
    all.push(st);
    const aSeat = flipped ? 1 : 0;
    if (st.winner === 'draw') draws++;
    else {
      if (st.winner === 0) seat0Wins++;
      else seat1Wins++;
      if (st.winner === aSeat) aWins++;
      else bWins++;
    }
    msA.push(...st.moveMs[aSeat]!);
    msB.push(...st.moveMs[1 - aSeat]!);
  }
  const n = all.length;
  const avg = (f: (g: GameStats) => number) => all.reduce((x, g) => x + f(g), 0) / n;
  const plies = all.map((g) => g.plies);
  const firsts = all.flatMap((g) => (g.firstExtractionPly === null ? [] : [g.firstExtractionPly]));
  const decided = all.filter((g) => g.winner !== 'draw');
  return {
    games: n,
    p0: o.p0,
    p1: o.p1,
    swap: o.swap,
    aWins,
    bWins,
    draws,
    aWinRate: aWins / n,
    aWinRateCI95: wilson(aWins, n),
    seat0Wins,
    seat1Wins,
    seat0WinRate: seat0Wins / n,
    seat0WinRateCI95: wilson(seat0Wins, n),
    drawRate: draws / n,
    medianPlies: pct(plies, 0.5),
    p90Plies: pct(plies, 0.9),
    avgBurnsPerGame: avg((g) => g.burns),
    avgDropsPerGame: avg((g) => g.drops),
    avgExtractionsPerGame: avg((g) => g.extractions),
    comebackPct: decided.length ? decided.filter((g) => g.comeback).length / decided.length : 0,
    firstExtractionPlyMedian: pct(firsts, 0.5),
    forcedPasses: all.reduce((x, g) => x + g.passes, 0),
    avgBranchingFactor:
      all.reduce((x, g) => x + g.branchingSum, 0) /
      Math.max(
        1,
        plies.reduce((x, y) => x + y, 0),
      ),
    msPerMoveA: {
      mean: msA.reduce((x, y) => x + y, 0) / Math.max(1, msA.length),
      p95: pct(msA, 0.95),
      max: Math.max(0, ...msA),
    },
    msPerMoveB: {
      mean: msB.reduce((x, y) => x + y, 0) / Math.max(1, msB.length),
      p95: pct(msB, 0.95),
      max: Math.max(0, ...msB),
    },
  };
}
