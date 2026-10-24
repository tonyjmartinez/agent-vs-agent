import { DAILY_POOL } from './dailyPool';
import type { Mission } from './missions';

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` in UTC, so everyone gets the same puzzle on the same date. */
export const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

/** A real calendar date in `YYYY-MM-DD` form (rejects 2026-02-30, 2026-13-01, "tomorrow"...). */
export function isDayKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && dayKey(d) === s;
}

/** Whole days since 1970-01-01 (UTC). */
export const dayNumber = (key: string): number =>
  Math.round(Date.parse(`${key}T00:00:00Z`) / DAY_MS);

export const prevDay = (key: string): string =>
  dayKey(new Date(Date.parse(`${key}T00:00:00Z`) - DAY_MS));

/** Smallest step ≥ 7 coprime with n: day → index is then a bijection over any n consecutive days. */
function stepFor(n: number): number {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  let k = 7;
  while (gcd(k, n) !== 1) k++;
  return k;
}

const BRIEF = {
  win: "Today's puzzle: take the game in the moves you have.",
  extract: "Today's puzzle: get a folder home before Teal can stop you.",
  burn: "Today's puzzle: put a Teal agent off the board.",
} as const;

/**
 * The mission for a date. Over any `DAILY_POOL.length` consecutive days every pool entry appears exactly once,
 * and consecutive days never repeat. Same date → same puzzle for everyone.
 */
export function dailyMission(key: string): Mission {
  const n = DAILY_POOL.length;
  const entry = DAILY_POOL[(((dayNumber(key) * stepFor(n)) % n) + n) % n]!;
  return {
    id: `daily-${key}`,
    title: `Daily ${key}`,
    brief: BRIEF[entry.goal],
    goal: entry.goal,
    moves: entry.moves,
    state: entry.state,
    daily: true,
  };
}

/**
 * Consecutive days completed, counted back from `today` (or from yesterday if today isn't done yet, so a streak
 * doesn't read 0 the morning after). Duplicates and order in `done` don't matter.
 */
export function streak(done: readonly string[], today: string): number {
  const set = new Set(done);
  let day = set.has(today) ? today : prevDay(today);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = prevDay(day);
  }
  return n;
}
