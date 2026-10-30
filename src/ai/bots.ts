import { applyAction, hash, legalActions } from '../engine/engine';
import type { Action, GameState } from '../engine/types';
import { evaluate } from './evaluate';
import { mulberry32 } from './rng';
import { search, type SearchBudget } from './search';

export type BotLevel = 'random' | 'easy' | 'medium' | 'hard';
export const BOT_LEVELS: readonly BotLevel[] = ['random', 'easy', 'medium', 'hard'];

export interface Bot {
  level: BotLevel;
  /** Always returns a legal action for `s.current`. Deterministic for a given seed and call sequence. */
  choose(s: GameState): Action;
  /** Forget position history and restart the seeded stream (call on rematch/undo). */
  reset(): void;
}

/** Per earlier occurrence of the position a move would create, medium/hard lose this much value. */
export const REPEAT_PENALTY = 60;

export const BUDGETS: Record<'medium' | 'hard', SearchBudget> = {
  medium: { maxDepth: 2, maxNodes: Infinity, timeMs: Infinity },
  hard: { maxDepth: 6, maxNodes: 30_000, timeMs: 400 },
};

/** Easy: greedy one-ply with epsilon-random moves and softmax noise so it stays beatable. */
export const EASY = { epsilon: 0.2, temperature: 25 };

export function makeBot(level: BotLevel, seed: number, budget?: Partial<SearchBudget>): Bot {
  let rnd = mulberry32(seed);
  const seen = new Map<string, number>();
  const pick = <T>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const shuffle = <T>(xs: T[]): T[] => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  };
  const choose = (s: GameState): Action => {
    const acts = legalActions(s);
    if (acts.length === 0) throw new Error('no legal actions (game over?)');
    if (level === 'random' || acts.length === 1) return pick(acts);
    if (level === 'easy') {
      if (rnd() < EASY.epsilon) return pick(acts);
      const vals = acts.map((a) => evaluate(applyAction(s, a).state, s.current));
      const top = Math.max(...vals);
      const weights = vals.map((v) => Math.exp((v - top) / EASY.temperature));
      let r = rnd() * weights.reduce((x, y) => x + y, 0);
      for (let i = 0; i < acts.length; i++) {
        r -= weights[i]!;
        if (r <= 0) return acts[i]!;
      }
      return acts[acts.length - 1]!;
    }
    const b = { ...BUDGETS[level], ...budget };
    const bias = (after: GameState) => -REPEAT_PENALTY * (seen.get(hash(after)) ?? 0);
    const action = search(s, b, shuffle, undefined, bias).action;
    const k = hash(applyAction(s, action).state);
    seen.set(k, (seen.get(k) ?? 0) + 1);
    return action;
  };
  return {
    level,
    choose,
    reset: () => {
      seen.clear();
      rnd = mulberry32(seed);
    },
  };
}
