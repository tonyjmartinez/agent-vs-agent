import { applyAction, hash, legalActions } from '../engine/engine';
import type { Action, GameEvent, GameState } from '../engine/types';
import { evaluate } from './evaluate';

export interface SearchBudget {
  maxDepth: number;
  /** Deterministic cap on visited nodes (the iteration in progress is discarded when hit). */
  maxNodes: number;
  /** Wall-clock cap in ms (a UI safety net; use Infinity for reproducible runs). */
  timeMs: number;
}

export interface SearchResult {
  action: Action;
  value: number;
  /** Deepest fully searched iteration. */
  depth: number;
  nodes: number;
}

interface Kid {
  action: Action;
  state: GameState;
  order: number;
}

const ABORT = Symbol('abort');

/** Move ordering from PLAN.md 4.4: extract, then burn an enemy, then pick up, then the rest. */
function orderKey(events: GameEvent[], mover: number, s: GameState): number {
  let k = 0;
  for (const e of events) {
    if (e.t === 'extracted' && e.owner === mover) k += 1000;
    else if (e.t === 'burned')
      k += s.spies.find((p) => p.id === e.spyId)!.owner !== mover ? 500 : -500;
    else if (e.t === 'pickedUp') k += 200;
    else if (e.t === 'dropped')
      k += s.spies.find((p) => p.id === e.spyId)!.owner !== mover ? 100 : -100;
  }
  return k;
}

function expand(s: GameState, actions: Action[]): Kid[] {
  const kids = actions.map((action) => {
    const { state, events } = applyAction(s, action);
    return { action, state, order: orderKey(events, s.current, s) };
  });
  kids.sort((a, b) => b.order - a.order); // stable: ties keep the incoming order
  return kids;
}

type Flag = 'exact' | 'lower' | 'upper';
interface Entry {
  depth: number;
  value: number;
  flag: Flag;
}

/**
 * Iterative-deepening alpha-beta from the current mover's point of view. Other players minimise
 * (paranoid for >2 players). `shuffle` randomises equal-looking root moves so seeded bots vary.
 */
export function search(
  root: GameState,
  budget: SearchBudget,
  shuffle: <T>(xs: T[]) => T[],
  now: () => number = () => performance.now(),
  /** Added to the value of each root move's resulting position (<= 0; used to discourage repetition). */
  rootBias: (after: GameState) => number = () => 0,
): SearchResult {
  const me = root.current;
  const deadline = now() + budget.timeMs;
  const tt = new Map<string, Entry>();
  let nodes = 0;
  let abortable = false;
  const lateGame = root.rules.maxPlies - 8;

  const ab = (s: GameState, depth: number, alpha: number, beta: number): number => {
    nodes++;
    if (abortable && (nodes > budget.maxNodes || ((nodes & 255) === 0 && now() > deadline)))
      throw ABORT;
    if (s.winner !== null || depth === 0) return evaluate(s, me);
    const k = hash(s) + (s.ply >= lateGame ? `|${s.ply}` : '');
    const hit = tt.get(k);
    if (hit && hit.depth >= depth) {
      if (hit.flag === 'exact') return hit.value;
      if (hit.flag === 'lower' && hit.value >= beta) return hit.value;
      if (hit.flag === 'upper' && hit.value <= alpha) return hit.value;
    }
    const maximizing = s.current === me;
    const a0 = alpha;
    const b0 = beta;
    let best = maximizing ? -Infinity : Infinity;
    for (const kid of expand(s, legalActions(s))) {
      const v = ab(kid.state, depth - 1, alpha, beta);
      if (maximizing) {
        if (v > best) best = v;
        if (best > alpha) alpha = best;
      } else {
        if (v < best) best = v;
        if (best < beta) beta = best;
      }
      if (alpha >= beta) break;
    }
    tt.set(k, { depth, value: best, flag: best <= a0 ? 'upper' : best >= b0 ? 'lower' : 'exact' });
    return best;
  };

  let rootKids = expand(root, shuffle(legalActions(root)));
  let result: SearchResult = { action: rootKids[0]!.action, value: -Infinity, depth: 0, nodes: 0 };
  for (let depth = 1; depth <= budget.maxDepth; depth++) {
    abortable = depth > 1; // depth 1 always completes so there is always an answer
    let alpha = -Infinity;
    let bestKid = rootKids[0]!;
    let bestValue = -Infinity;
    const scored: { kid: Kid; v: number }[] = [];
    try {
      for (const kid of rootKids) {
        const bias = rootBias(kid.state);
        const v = ab(kid.state, depth - 1, alpha - bias, Infinity) + bias;
        scored.push({ kid, v });
        if (v > bestValue) {
          bestValue = v;
          bestKid = kid;
          alpha = v;
        }
      }
    } catch (e) {
      if (e !== ABORT) throw e;
      break;
    }
    result = { action: bestKid.action, value: bestValue, depth, nodes };
    // Search the best move first next iteration (also helps pruning).
    rootKids = [bestKid, ...rootKids.filter((k) => k !== bestKid)];
    if (Math.abs(bestValue) > 50_000) break; // forced win/loss found
  }
  result.nodes = nodes;
  return result;
}
