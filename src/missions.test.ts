import { describe, expect, it } from 'vitest';
import { Solver, goalMet } from './ai/solve';
import { applyTrusted, legalActions } from './engine/engine';
import { decode, encode } from './engine/serialize';
import { MISSIONS, goalText, missionById, pillText } from './missions';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

describe('missions', () => {
  it('have unique kebab-case ids and are ordered easy → hard (move budget never drops)', () => {
    const ids = MISSIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
    for (let i = 1; i < MISSIONS.length; i++) {
      expect(MISSIONS[i]!.moves).toBeGreaterThanOrEqual(MISSIONS[i - 1]!.moves);
    }
    expect(MISSIONS.length).toBeGreaterThanOrEqual(10);
    expect(MISSIONS.filter((m) => m.moves === 3).length).toBeGreaterThanOrEqual(3);
    expect(goalText({ goal: 'extract', moves: 3 })).toBe('Bank an intel in 3 moves');
    expect(pillText({ goal: 'extract' }, 3)).toBe('Bank an intel · 3 moves left');
    expect(missionById('double-tap')?.title).toBe('Double Tap');
    expect(missionById('nope')).toBeUndefined();
    expect(goalText({ goal: 'burn', moves: 1 })).toBe('Burn a Teal agent in 1 move');
    expect(goalText({ goal: 'win', moves: 2 })).toBe('Win the game in 2 moves');
    expect(pillText({ goal: 'extract' }, 1)).toBe('Bank an intel · 1 move left');
    expect(pillText({ goal: 'burn' }, 2)).toBe('Burn a Teal agent · 2 moves left');
  });

  describe.each(MISSIONS.map((m) => [m.id, m] as const))('%s', (_id, m) => {
    const s = decode(m.state);

    it('is a legal, round-tripping position with Red to move', () => {
      expect(encode(s)).toBe(m.state);
      expect(s.current).toBe(0);
      expect(s.winner).toBeNull();
      const cells = s.spies.flatMap((x) => (x.pos ? [`${x.pos.r},${x.pos.c}`] : []));
      expect(new Set(cells).size).toBe(cells.length);
      const intel = s.intel.map((p) => `${p.r},${p.c}`);
      expect(new Set(intel).size).toBe(intel.length);
      for (const x of s.spies) if (!x.pos) expect(x.carrying).toBe(false);
      const carriers = s.spies.filter((x) => x.carrying).length;
      expect(s.intel.length + carriers).toBe(s.rules.intelOnBoard);
      expect(Math.max(...s.scores)).toBeLessThan(s.rules.intelToWin);
      if (m.goal === 'win') expect(s.scores[0]).toBe(s.rules.intelToWin - 1);
      expect(goalMet(s, s, m.goal, 0)).toBe(false);
    });

    it('is forced within its move budget and not in fewer moves', () => {
      expect(new Solver(s, m.goal).canForce(s, m.moves)).toBe(true);
      if (m.moves > 1) expect(new Solver(s, m.goal).canForce(s, m.moves - 1)).toBe(false);
    });

    it('is a real puzzle: at most a third of first moves work', () => {
      const sols = new Solver(s, m.goal).solutions(s, m.moves);
      expect(sols.length).toBeGreaterThan(0);
      expect(sols.length * 3).toBeLessThanOrEqual(legalActions(s).length);
    });

    it('the defender refutes every wrong first move and never refutes a right one', () => {
      const solver = new Solver(s, m.goal);
      const sols = solver.solutions(s, m.moves);
      for (const a of legalActions(s)) {
        const t = applyTrusted(s, a).state;
        const right = sols.some((x) => same(x, a));
        if (goalMet(s, t, m.goal, 0)) {
          expect(right).toBe(true);
          continue;
        }
        if (m.moves === 1) {
          expect(right).toBe(false);
          continue;
        }
        const u = applyTrusted(t, solver.defend(t, m.moves - 1)).state;
        expect(solver.canForce(u, m.moves - 1)).toBe(right);
      }
    });
  });
});

describe('solution replay', () => {
  it.each(MISSIONS.map((m) => [m.id, m] as const))(
    '%s: the replay reaches the goal within budget, whatever the defender does',
    (_id, m) => {
      const start = decode(m.state);
      const solver = new Solver(start, m.goal);
      expect(solver.player).toBe(0);
      let s = start;
      let redMoves = 0;
      for (let guard = 0; guard < 8 && !goalMet(start, s, m.goal, 0); guard++) {
        expect(s.winner).toBeNull();
        expect(redMoves).toBeLessThan(m.moves);
        // `left` is the budget minus Red moves already made, for both sides.
        const a = solver.demoStep(s, m.moves - redMoves);
        if (s.current === 0) redMoves++;
        s = applyTrusted(s, a).state;
      }
      expect(goalMet(start, s, m.goal, 0)).toBe(true);
      expect(redMoves).toBeLessThanOrEqual(m.moves);
    },
  );
});

describe('solver', () => {
  const s = decode('v1.0.4.0-0.52,34,02,15.2233');

  it('rejects positions where it is not to move, or with no moves left', () => {
    const solver = new Solver(s, 'burn');
    expect(solver.canForce(s, 0)).toBe(false);
    expect(solver.canForce({ ...s, current: 1 }, 1)).toBe(false);
    expect(solver.canForce({ ...s, winner: 1 }, 1)).toBe(false);
  });

  it('defender takes an outright win when it has one', () => {
    // Teal carrier one step from its row with 2 points; Red's burn goal is irrelevant then.
    const t = decode('v1.1.9.0-2.51,54,11*,04.22');
    const r = new Solver(t, 'burn', 0).defend(t, 1);
    expect(applyTrusted(t, r).state.winner).toBe(1);
  });

  it('defender falls back to the first legal reply when every reply loses', () => {
    const m = missionById('grab-and-go')!;
    const st = decode(m.state);
    const solver = new Solver(st, m.goal);
    const [right] = solver.solutions(st, m.moves);
    const t = applyTrusted(st, right!).state;
    expect(same(solver.defend(t, 1), legalActions(t)[0])).toBe(true);
  });

  it('goalMet covers every goal', () => {
    const after = { ...s, scores: [1, 0], winner: 0 as const };
    expect(goalMet(s, after, 'win', 0)).toBe(true);
    expect(goalMet(s, after, 'extract', 0)).toBe(true);
    expect(goalMet(s, s, 'burn', 0)).toBe(false);
    const burned = { ...s, spies: s.spies.map((x) => (x.id === 'p1a' ? { ...x, pos: null } : x)) };
    expect(goalMet(s, burned, 'burn', 0)).toBe(true);
  });
});
