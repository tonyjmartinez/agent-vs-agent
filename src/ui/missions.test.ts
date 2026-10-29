import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MISSIONS } from '../missions';
import {
  bestMoves,
  completedDays,
  completedMissions,
  markCompleted,
  markDayDone,
  nextUp,
  recordBest,
  resetProgress,
} from './missions';

/** A tiny in-memory localStorage. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('best moves per mission', () => {
  beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the fewest Red moves, never a worse win', () => {
    expect(bestMoves()).toEqual({});
    recordBest('side-step', 3);
    recordBest('side-step', 2);
    recordBest('side-step', 3);
    expect(bestMoves()).toEqual({ 'side-step': 2 });
  });

  it('drops junk in storage', () => {
    localStorage.setItem(
      'ava.missionBest.v1',
      JSON.stringify({ a: 1, b: 0, c: 2.5, d: 'x', e: 4 }),
    );
    expect(bestMoves()).toEqual({ a: 1, e: 4 });
    localStorage.setItem('ava.missionBest.v1', JSON.stringify([1, 2]));
    expect(bestMoves()).toEqual({});
  });
});

describe('mission progress storage', () => {
  let store: ReturnType<typeof fakeStorage>;
  beforeEach(() => {
    store = fakeStorage();
    vi.stubGlobal('localStorage', store);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('completed missions: starts empty, dedupes, and survives junk', () => {
    expect([...completedMissions()]).toEqual([]);
    markCompleted('double-tap');
    markCompleted('double-tap');
    markCompleted('side-step');
    expect([...completedMissions()].sort()).toEqual(['double-tap', 'side-step']);
    store.data.set('ava.missions.v1', JSON.stringify({ not: 'an array' }));
    expect([...completedMissions()]).toEqual([]);
    store.data.set('ava.missions.v1', JSON.stringify(['ok', 3, null, 'also-ok']));
    expect([...completedMissions()]).toEqual(['ok', 'also-ok']);
  });

  it('daily days: sorted, deduped, and independent of mission progress', () => {
    expect(completedDays()).toEqual([]);
    markDayDone('2026-03-11');
    markDayDone('2026-03-10');
    markDayDone('2026-03-11');
    expect(completedDays()).toEqual(['2026-03-10', '2026-03-11']);
    expect([...completedMissions()]).toEqual([]); // daily progress never counts toward "N of 13"
    markCompleted('first-contact');
    expect(completedDays()).toEqual(['2026-03-10', '2026-03-11']);
  });

  it('ignores invalid dates and filters junk already in storage', () => {
    markDayDone('2026-02-30');
    markDayDone('tomorrow');
    markDayDone('');
    expect(completedDays()).toEqual([]);
    store.data.set(
      'ava.daily.v1',
      JSON.stringify(['2026-03-10', 'nope', 7, '2026-13-01', '2026-03-12']),
    );
    expect(completedDays()).toEqual(['2026-03-10', '2026-03-12']);
    store.data.set('ava.daily.v1', '{"broken"');
    expect(completedDays()).toEqual([]); // corrupt JSON falls back to empty
  });

  it('keeps only the most recent 120 days', () => {
    const day = (i: number) =>
      new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
    for (let i = 0; i < 150; i++) markDayDone(day(i));
    const days = completedDays();
    expect(days).toHaveLength(120);
    expect(days[0]).toBe(day(30));
    expect(days.at(-1)).toBe(day(149));
  });

  it('never throws when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    });
    expect(completedDays()).toEqual([]);
    expect(() => markDayDone('2026-03-10')).not.toThrow();
    expect([...completedMissions()]).toEqual([]);
    expect(() => markCompleted('x')).not.toThrow();
  });
});

describe('nextUp', () => {
  it('is the first incomplete mission in list order, wherever the gaps are', () => {
    expect(nextUp(new Set())?.id).toBe(MISSIONS[0]!.id);
    expect(nextUp(new Set([MISSIONS[0]!.id, MISSIONS[1]!.id]))?.id).toBe(MISSIONS[2]!.id);
    // Skipping ahead leaves the earlier gap as the next one.
    expect(nextUp(new Set([MISSIONS[0]!.id, MISSIONS[2]!.id]))?.id).toBe(MISSIONS[1]!.id);
    // Unknown ids (e.g. from an older version) are ignored.
    expect(nextUp(new Set(['retired-mission']))?.id).toBe(MISSIONS[0]!.id);
  });
  it('is undefined once everything is complete', () => {
    expect(nextUp(new Set(MISSIONS.map((m) => m.id)))).toBeUndefined();
  });
});

describe('resetProgress', () => {
  it('clears missions and dailies together, and leaves the bot record alone', () => {
    const store = fakeStorage({ 'ava.record.v1': JSON.stringify({ hard: { w: 2, l: 1, d: 0 } }) });
    vi.stubGlobal('localStorage', store);
    markCompleted('double-tap');
    markDayDone('2026-03-10');
    markDayDone('2026-03-11');
    resetProgress();
    expect([...completedMissions()]).toEqual([]);
    expect(completedDays()).toEqual([]);
    expect(store.data.get('ava.record.v1')).toBe(JSON.stringify({ hard: { w: 2, l: 1, d: 0 } }));
    // Progress can start again afterwards.
    markCompleted('side-step');
    expect([...completedMissions()]).toEqual(['side-step']);
    vi.unstubAllGlobals();
  });
});
