import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { completedDays, completedMissions, markCompleted, markDayDone } from './missions';

/** A tiny in-memory localStorage. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

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
