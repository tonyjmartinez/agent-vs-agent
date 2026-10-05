import { applyTrusted, hash, legalActions } from '../engine/engine';
import type { Action, GameEvent, GameState } from '../engine/types';
import { WIN, defaultWeights, evaluate, type EvalWeights } from './evaluate';
import { mulberry32, pick, type Rng } from './rng';

export type Level = 'random' | 'easy' | 'medium' | 'hard';

export interface BotOpts {
  weights?: EvalWeights;
  /** Hard: max search depth (plies). */
  maxDepth?: number;
  /** Hard: node budget for iterative deepening (deterministic stand-in for a time budget). */
  nodeBudget?: number;
  /** Optional wall clock, injected by callers (never read inside ai/). */
  now?: () => number;
  /** Optional time budget in ms, only honoured when `now` is given. */
  timeMs?: number;
  /** Hashes of positions already seen this game (for repetition avoidance). */
  history?: readonly string[];
  /** Penalty (to the searching bot) for steering into an already-seen position. */
  contempt?: number;
  /** Debug: disable the transposition table. */
  noTT?: boolean;
}

export interface BotResult {
  action: Action;
  depth: number;
  nodes: number;
  value: number;
}

export const HARD_DEFAULTS = { maxDepth: 6, nodeBudget: 40_000 };

export function chooseAction(
  s: GameState,
  level: Level,
  seed: number,
  opts: BotOpts = {},
): BotResult {
  const rng = mulberry32(seed);
  const acts = legalActions(s);
  if (acts.length === 1) return { action: acts[0]!, depth: 0, nodes: 0, value: 0 };
  switch (level) {
    case 'random':
      return { action: pick(rng, acts), depth: 0, nodes: 0, value: 0 };
    case 'easy':
      return easy(s, acts, rng, opts.weights ?? defaultWeights);
    case 'medium':
      return search(s, { ...opts, maxDepth: 2, nodeBudget: Infinity, now: undefined }, rng);
    case 'hard':
      return search(s, { ...HARD_DEFAULTS, ...opts }, rng);
  }
}

function easy(s: GameState, acts: Action[], rng: Rng, w: EvalWeights): BotResult {
  if (rng() < 0.25) return { action: pick(rng, acts), depth: 1, nodes: 0, value: 0 };
  const me = s.current;
  const vals = acts.map((a) => evaluate(applyTrusted(s, a).state, me, w));
  const T = 40;
  const max = Math.max(...vals);
  const ws = vals.map((v) => Math.exp((v - max) / T));
  let r = rng() * ws.reduce((x, y) => x + y, 0);
  for (let i = 0; i < acts.length; i++) {
    r -= ws[i]!;
    if (r <= 0) return { action: acts[i]!, depth: 1, nodes: acts.length, value: vals[i]! };
  }
  return { action: acts.at(-1)!, depth: 1, nodes: acts.length, value: vals.at(-1)! };
}

/** Tactical ordering key: extract > burn enemy > pick up > rest; own losses last. */
function orderScore(events: GameEvent[], me: number, s: GameState): number {
  let k = 0;
  for (const e of events) {
    if (e.t === 'gameOver') k += e.winner === me ? 100_000 : -100_000;
    else if (e.t === 'extracted') k += e.owner === me ? 10_000 : -10_000;
    else if (e.t === 'burned')
      k += s.spies.find((x) => x.id === e.spyId)!.owner === me ? -2_000 : 5_000;
    else if (e.t === 'dropped')
      k += s.spies.find((x) => x.id === e.spyId)!.owner === me ? -800 : 1_500;
    else if (e.t === 'pickedUp')
      k += s.spies.find((x) => x.id === e.spyId)!.owner === me ? 1_000 : -500;
  }
  return k;
}

interface TTEntry {
  depth: number;
  value: number;
  flag: 0 | 1 | 2; // exact, lower, upper
  best: number;
}

class OutOfBudget extends Error {}

function search(root: GameState, o: BotOpts, rng: Rng): BotResult {
  const w = o.weights ?? defaultWeights;
  const maxDepth = o.maxDepth ?? 2;
  const budget = o.nodeBudget ?? Infinity;
  const deadline = o.now && o.timeMs ? o.now() + o.timeMs : Infinity;
  const tt = new Map<string, TTEntry>();
  const seen = new Set(o.history ?? []);
  const contempt = o.contempt ?? 60;
  const me = root.current;
  let nodes = 0;

  type Child = { a: Action; s: GameState; k: number };
  const childCache = new Map<string, Child[]>();
  const children = (s: GameState, h: string): Child[] => {
    let cs = childCache.get(h);
    if (!cs) {
      cs = legalActions(s).map((a) => {
        const r = applyTrusted(s, a);
        return { a, s: r.state, k: orderScore(r.events, s.current, s) };
      });
      cs.sort((x, y) => y.k - x.k);
      if (childCache.size < 200_000) childCache.set(h, cs);
    }
    return cs;
  };

  const negamax = (s: GameState, depth: number, alpha: number, beta: number): number => {
    nodes++;
    if (nodes > budget || (deadline !== Infinity && (nodes & 1023) === 0 && o.now!() > deadline))
      throw new OutOfBudget();
    // Terminal values already prefer faster wins via WIN - ply (absolute game ply), so they are
    // path-independent and safe to store in the transposition table.
    if (s.winner !== null || depth === 0) return evaluate(s, s.current, w);
    const h = hash(s);
    // Repetition: a position from the game so far counts as slightly bad for the searching bot,
    // so loops (e.g. steal / re-steal) get broken by whoever has a reasonable alternative.
    if (seen.has(h)) return s.current === me ? -contempt : contempt;
    const e = tt.get(h);
    const a0 = alpha;
    if (e && e.depth >= depth) {
      if (e.flag === 0) return e.value;
      if (e.flag === 1) alpha = Math.max(alpha, e.value);
      else beta = Math.min(beta, e.value);
      if (alpha >= beta) return e.value;
    }
    const cs = children(s, h);
    const order = cs.map((_, i) => i);
    if (e) order.sort((x, y) => (x === e.best ? -1 : y === e.best ? 1 : 0));
    let best = -Infinity;
    let bestI = order[0]!;
    for (const i of order) {
      const c = cs[i]!;
      // Two-player negamax; in FFA (n>2) this is a crude paranoid approximation.
      const sign = c.s.current === s.current ? 1 : -1;
      const v =
        sign * negamax(c.s, depth - 1, sign === 1 ? alpha : -beta, sign === 1 ? beta : -alpha);
      if (v > best) {
        best = v;
        bestI = i;
      }
      alpha = Math.max(alpha, v);
      if (alpha >= beta) break;
    }
    if (!o.noTT)
      tt.set(h, { depth, value: best, flag: best <= a0 ? 2 : best >= beta ? 1 : 0, best: bestI });
    return best;
  };

  // Root: iterative deepening, keep the last fully searched depth's choice.
  const rootH = hash(root);
  const rootKids = children(root, rootH);
  let bestAction = rootKids[0]!.a;
  let bestValue = -Infinity;
  let reached = 0;
  let rootBest: number | undefined;
  for (let d = 1; d <= maxDepth; d++) {
    try {
      let alpha = -Infinity;
      const scored: { i: number; v: number }[] = [];
      const prev = rootBest;
      const order = rootKids.map((_, i) => i);
      if (prev !== undefined) order.sort((x, y) => (x === prev ? -1 : y === prev ? 1 : 0));
      for (const i of order) {
        const c = rootKids[i]!;
        const sign = c.s.current === root.current ? 1 : -1;
        // Window opens just below alpha so moves that tie the best get exact values (for tie-breaks);
        // moves that fail low return <= lo < best and can never be mistaken for ties.
        const lo = alpha - 0.5;
        const v =
          sign * negamax(c.s, d - 1, sign === 1 ? lo : -Infinity, sign === 1 ? Infinity : -lo);
        scored.push({ i, v });
        alpha = Math.max(alpha, v);
      }
      const top = Math.max(...scored.map((x) => x.v));
      // Seeded tie-break among equally good moves keeps self-play varied but reproducible.
      const ties = scored.filter((x) => x.v >= top - 1e-9);
      const chosen = pick(rng, ties);
      bestAction = rootKids[chosen.i]!.a;
      bestValue = top;
      reached = d;
      rootBest = chosen.i;
      if (Math.abs(top) > WIN / 2) break; // forced result found
    } catch (err) {
      if (err instanceof OutOfBudget) break;
      throw err;
    }
  }
  return { action: bestAction, depth: reached, nodes, value: bestValue };
}
