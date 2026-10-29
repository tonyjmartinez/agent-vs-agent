import { describe, expect, it } from 'vitest';
import { Solver, goalMet } from './ai/solve';
import {
  dailyMissedText,
  dailyMission,
  dailyStreakText,
  dayKey,
  dayNumber,
  isDayKey,
  prevDay,
  streak,
} from './daily';
import { DAILY_POOL } from './dailyPool';
import { applyTrusted, legalActions } from './engine/engine';
import { decode, encode } from './engine/serialize';
import { MISSIONS } from './missions';

describe('daily pool: every entry is a proven puzzle', () => {
  it('is big enough, has no duplicates, and none repeats a hand-curated mission', () => {
    expect(DAILY_POOL.length).toBeGreaterThanOrEqual(40);
    // One entry per position: the same board must never come back with a different goal.
    const states = DAILY_POOL.map((e) => e.state);
    expect(new Set(states).size).toBe(states.length);
    const curated = new Set(MISSIONS.map((m) => m.state));
    for (const e of DAILY_POOL) expect(curated.has(e.state), e.state).toBe(false);
    // A real spread of goals and budgets, not one idea.
    for (const goal of ['burn', 'extract', 'win'] as const) {
      expect(DAILY_POOL.filter((e) => e.goal === goal).length).toBeGreaterThanOrEqual(8);
    }
    expect(DAILY_POOL.some((e) => e.moves === 1)).toBe(true);
    expect(DAILY_POOL.filter((e) => e.moves === 2).length).toBeGreaterThanOrEqual(25);
  });

  describe.each(DAILY_POOL.map((e, i) => [i, e] as const))('entry %i', (_i, e) => {
    const s = decode(e.state);

    it('is a legal, round-tripping position with Red to move', () => {
      expect(encode(s)).toBe(e.state);
      expect(s.current).toBe(0);
      expect(s.winner).toBeNull();
      const cells = s.spies.flatMap((x) => (x.pos ? [`${x.pos.r},${x.pos.c}`] : []));
      expect(new Set(cells).size).toBe(cells.length);
      for (const x of s.spies) if (!x.pos) expect(x.carrying).toBe(false);
      expect(Math.max(...s.scores)).toBeLessThan(s.rules.intelToWin);
      if (e.goal === 'win') expect(s.scores[0]).toBe(s.rules.intelToWin - 1);
      expect(goalMet(s, s, e.goal, 0)).toBe(false);
    });

    it('is forced within its budget, not in fewer moves, and not trivial', () => {
      const solver = new Solver(s, e.goal);
      expect(solver.canForce(s, e.moves)).toBe(true);
      if (e.moves > 1) expect(new Solver(s, e.goal).canForce(s, e.moves - 1)).toBe(false);
      const sols = solver.solutions(s, e.moves);
      expect(sols.length).toBeGreaterThan(0);
      expect(sols.length * 3).toBeLessThanOrEqual(legalActions(s).length);
    });

    it('its solution replay reaches the goal whatever the defender does', () => {
      const solver = new Solver(s, e.goal);
      let t = s;
      let made = 0;
      for (let guard = 0; guard < 8 && !goalMet(s, t, e.goal, 0); guard++) {
        expect(t.winner).toBeNull();
        expect(made).toBeLessThan(e.moves);
        const a = solver.demoStep(t, e.moves - made);
        if (t.current === 0) made++;
        t = applyTrusted(t, a).state;
      }
      expect(goalMet(s, t, e.goal, 0)).toBe(true);
    });
  });
});

describe('date keys', () => {
  it('formats UTC dates', () => {
    expect(dayKey(new Date('2026-10-24T00:00:00Z'))).toBe('2026-10-24');
    expect(dayKey(new Date('2026-10-24T23:59:59Z'))).toBe('2026-10-24');
    expect(dayKey(new Date('2026-12-31T23:59:59.999Z'))).toBe('2026-12-31');
  });

  it('accepts only real calendar dates in YYYY-MM-DD form', () => {
    for (const ok of ['2026-10-24', '2028-02-29', '1970-01-01', '2026-12-31']) {
      expect(isDayKey(ok), ok).toBe(true);
    }
    for (const bad of [
      '2026-02-30',
      '2027-02-29',
      '2026-13-01',
      '2026-00-10',
      '2026-1-5',
      '26-10-24',
      '2026/10/24',
      'tomorrow',
      '',
      '2026-10-24T00:00',
      ' 2026-10-24',
    ]) {
      expect(isDayKey(bad), bad).toBe(false);
    }
  });

  it('counts days since the epoch and steps back across month, year and leap boundaries', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(dayNumber('1970-01-02')).toBe(1);
    expect(dayNumber('2026-10-25') - dayNumber('2026-10-24')).toBe(1);
    expect(prevDay('2026-10-24')).toBe('2026-10-23');
    expect(prevDay('2026-03-01')).toBe('2026-02-28');
    expect(prevDay('2028-03-01')).toBe('2028-02-29');
    expect(prevDay('2027-01-01')).toBe('2026-12-31');
  });
});

describe('dailyMission', () => {
  const days = (from: string, n: number): string[] => {
    const out = [from];
    for (let i = 1; i < n; i++) {
      out.push(dayKey(new Date(Date.parse(`${out[i - 1]}T00:00:00Z`) + 86_400_000)));
    }
    return out;
  };

  it('is deterministic and well-formed', () => {
    const a = dailyMission('2026-10-24');
    expect(dailyMission('2026-10-24')).toEqual(a);
    expect(a.id).toBe('daily-2026-10-24');
    expect(a.title).toBe('Daily 2026-10-24');
    expect(a.daily).toBe(true);
    expect(a.brief.length).toBeGreaterThan(10);
    expect(
      DAILY_POOL.some((e) => e.state === a.state && e.goal === a.goal && e.moves === a.moves),
    ).toBe(true);
  });

  it('shows every pool entry exactly once in any run of pool-size consecutive days', () => {
    const n = DAILY_POOL.length;
    for (const from of ['2026-01-01', '2026-10-24', '2027-12-20', '2028-02-10', '1999-06-15']) {
      const states = days(from, n).map((d) => dailyMission(d).state);
      expect(new Set(states).size, `window from ${from}`).toBe(n);
    }
  });

  it('never repeats on consecutive days, across month and year boundaries', () => {
    const run = days('2026-12-01', 120);
    for (let i = 1; i < run.length; i++) {
      expect(dailyMission(run[i]!).state, `${run[i - 1]} → ${run[i]}`).not.toBe(
        dailyMission(run[i - 1]!).state,
      );
    }
  });

  it('is periodic with the pool size (the same puzzle returns after one full cycle)', () => {
    const n = DAILY_POOL.length;
    const [first] = days('2026-10-24', 1);
    const later = days('2026-10-24', n + 1).at(-1)!;
    expect(dailyMission(later).state).toBe(dailyMission(first!).state);
  });

  it('handles dates before the epoch without a negative index', () => {
    const m = dailyMission('1969-12-31');
    expect(DAILY_POOL.some((e) => e.state === m.state)).toBe(true);
  });
});

describe('streak', () => {
  it('is 0 with nothing done, or when the last completion is older than yesterday', () => {
    expect(streak([], '2026-10-24')).toBe(0);
    expect(streak(['2026-10-20'], '2026-10-24')).toBe(0);
    expect(streak(['2026-10-22'], '2026-10-24')).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(streak(['2026-10-24'], '2026-10-24')).toBe(1);
    expect(streak(['2026-10-22', '2026-10-23', '2026-10-24'], '2026-10-24')).toBe(3);
  });

  it('keeps the streak alive until the end of the next day (today not done yet)', () => {
    expect(streak(['2026-10-22', '2026-10-23'], '2026-10-24')).toBe(2);
    expect(streak(['2026-10-23'], '2026-10-24')).toBe(1);
  });

  it('breaks on a gap, ignores order and duplicates, and ignores future days', () => {
    expect(streak(['2026-10-24', '2026-10-22', '2026-10-21'], '2026-10-24')).toBe(1);
    expect(streak(['2026-10-23', '2026-10-24', '2026-10-24', '2026-10-22'], '2026-10-24')).toBe(3);
    expect(streak(['2026-10-25', '2026-10-26'], '2026-10-24')).toBe(0);
  });

  it('counts across month, year and leap-day boundaries', () => {
    expect(streak(['2026-12-30', '2026-12-31', '2027-01-01'], '2027-01-01')).toBe(3);
    expect(streak(['2028-02-28', '2028-02-29', '2028-03-01'], '2028-03-01')).toBe(3);
    expect(streak(['2027-02-28', '2027-03-01'], '2027-03-01')).toBe(2);
  });
});

describe('dailyMissedText (the failed daily result card line)', () => {
  it('names the daily and says what to do next', () => {
    expect(dailyMissedText()).toMatch(/^Daily missed\./);
    expect(dailyMissedText()).toMatch(/Retry it now/);
    expect(dailyMissedText()).not.toMatch(/Teal found the answer/);
  });
});

describe('dailyStreakText (the daily result card line)', () => {
  it('says the streak in days, singular for one', () => {
    expect(dailyStreakText(1)).toBe('Daily streak: 1 day.');
    expect(dailyStreakText(2)).toBe('Daily streak: 2 days.');
    expect(dailyStreakText(12)).toBe('Daily streak: 12 days.');
  });
});
