import { describe, expect, test } from 'vitest';
import { applyAction, applyTrusted, createGame, legalActions } from '../engine/engine';
import type { GameState } from '../engine/types';
import { board } from '../engine/fixtures';
import { duelRules } from '../engine/rules';
import { chooseAction, type Level } from './bots';
import { evaluate } from './evaluate';
import { mulberry32 } from './rng';

const levels: Level[] = ['random', 'easy', 'medium', 'hard'];
const fast = { nodeBudget: 4000 };

describe('bots', () => {
  test('rng is deterministic and in [0,1)', () => {
    const a = mulberry32(5);
    const b = mulberry32(5);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  test.each(levels)('%s only returns legal actions and is deterministic', (lvl) => {
    let s = createGame(duelRules());
    for (let i = 0; i < 12 && s.winner === null; i++) {
      const r1 = chooseAction(s, lvl, 99 + i, fast);
      const r2 = chooseAction(s, lvl, 99 + i, fast);
      expect(r1.action).toEqual(r2.action);
      expect(legalActions(s)).toContainEqual(r1.action);
      s = applyAction(s, r1.action).state;
    }
  });

  const winIn1 = board(
    `
    . . . . T .
    . . . . . .
    . . i . . .
    . . . i . .
    . R* . . T .
    . . . . . R`,
    { scores: [2, 0] },
  );

  test.each(['medium', 'hard'] as Level[])('%s takes an immediate win', (lvl) => {
    const { action } = chooseAction(winIn1, lvl, 1, fast);
    const r = applyAction(winIn1, action);
    expect(r.state.winner).toBe(0);
  });

  // Red at (2,0) on the left edge; teal at (3,2) can step to (2,1)/(3,1)/(1,1) and push it off.
  // Red's other spy sits safely mid-board.
  const burnThreat = board(`
    . . . . . T
    . . . . . .
    R . . . . .
    . . T . R .
    . . . . . .
    . . . . . .`);

  test.each(['medium', 'hard'] as Level[])(
    '%s avoids an immediate burn when safe moves exist',
    (lvl) => {
      // Teal at (3,2) can step to (2,1)/(3,1) and push red at (2,0) off the left edge.
      const { action } = chooseAction(burnThreat, lvl, 3, fast);
      const after = applyAction(burnThreat, action).state;
      // Whatever teal replies, red keeps both spies on the board.
      for (const reply of legalActions(after)) {
        const r = applyAction(after, reply).state;
        const burned = r.spies.filter((x) => x.owner === 0 && !x.pos).length;
        expect(burned, JSON.stringify({ action, reply })).toBe(0);
      }
    },
  );

  test('evaluation is symmetric at the start', () => {
    const s = createGame(duelRules());
    expect(evaluate(s, 0)).toBeCloseTo(-evaluate(s, 1) + 0, 5);
  });
});

describe('search correctness', () => {
  const mm = (s: GameState, d: number): number => {
    if (s.winner !== null || d === 0) return evaluate(s, s.current);
    let best = -Infinity;
    for (const a of legalActions(s)) {
      const c = applyTrusted(s, a).state;
      best = Math.max(best, (c.current === s.current ? 1 : -1) * mm(c, d - 1));
    }
    return best;
  };

  test('alpha-beta + TT matches brute-force minimax at depth 3', () => {
    const rng = mulberry32(3);
    for (let g = 0; g < 12; g++) {
      let s = createGame(duelRules());
      const n = Math.floor(rng() * 30);
      for (let i = 0; i < n && s.winner === null; i++) {
        const acts = legalActions(s);
        s = applyAction(s, acts[Math.floor(rng() * acts.length)]!).state;
      }
      if (s.winner !== null) continue;
      const r = chooseAction(s, 'hard', 1, { maxDepth: 3, nodeBudget: Infinity, contempt: 0 });
      const truth = mm(s, 3);
      const c = applyTrusted(s, r.action).state;
      expect(r.value).toBeCloseTo(truth, 6);
      expect(-mm(c, 2)).toBeCloseTo(truth, 6);
    }
  }, 60_000);
});
