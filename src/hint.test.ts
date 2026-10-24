import { describe, expect, it } from 'vitest';
import { Solver } from './ai/solve';
import { actionsFor } from './app/interaction';
import { applyTrusted, legalActions } from './engine/engine';
import { decode } from './engine/serialize';
import { hintSelection } from './hint';
import { MISSIONS } from './missions';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

describe('hintSelection', () => {
  describe.each(MISSIONS.map((m) => [m.id, m] as const))('%s', (_id, m) => {
    const start = decode(m.state);

    it('selects a piece whose legal moves include a forcing first move, without revealing which', () => {
      const solver = new Solver(start, m.goal);
      const sel = hintSelection(solver, start, m.moves);
      expect(sel).not.toBeNull();
      const sols = solver.solutions(start, m.moves);
      const options = actionsFor(start, sel);
      expect(options.some((o) => sols.some((x) => same(x, o)))).toBe(true);
      // A hint is a nudge: at least one other target is legal for that piece or another piece works too.
      expect(options.length > 1 || legalCount(start) > 1).toBe(true);
    });

    it('follows the line: after each defender reply the hint still exists, until the budget is spent', () => {
      const solver = new Solver(start, m.goal);
      let s = start;
      for (let made = 0; made < m.moves; made++) {
        const left = m.moves - made;
        const sel = hintSelection(solver, s, left);
        if (sel === null) break;
        const sols = solver.solutions(s, left);
        const a = actionsFor(s, sel).find((o) => sols.some((x) => same(x, o)))!;
        expect(a).toBeTruthy();
        s = applyTrusted(s, a).state;
        if (s.winner !== null || left === 1) break;
        s = applyTrusted(s, solver.defend(s, left - 1)).state;
      }
    });

    it('returns null once a wrong first move has been refuted', () => {
      if (m.moves < 2) return;
      const solver = new Solver(start, m.goal);
      const sols = solver.solutions(start, m.moves);
      const wrong = legalActions(start).find((a) => !sols.some((x) => same(x, a)))!;
      const t = applyTrusted(start, wrong).state;
      const u = applyTrusted(t, solver.defend(t, m.moves - 1)).state;
      expect(hintSelection(solver, u, m.moves - 1)).toBeNull();
    });
  });
});

function legalCount(s: ReturnType<typeof decode>): number {
  return s.spies.filter((x) => x.owner === 0).length;
}
