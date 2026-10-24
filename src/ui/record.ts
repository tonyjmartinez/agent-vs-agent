import type { BotLevel, Seat } from '../app/config';
import type { GameState } from '../engine/types';
import { levelName } from './hud';
import { load, save } from './storage';

const KEY = 'ava.record.v1';

export type Outcome = 'win' | 'loss' | 'draw';
export interface Tally {
  w: number;
  l: number;
  d: number;
}
export type Records = Partial<Record<BotLevel, Tally>>;

const LEVELS: readonly BotLevel[] = ['random', 'easy', 'medium', 'hard'];
const count = (n: unknown): number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : 0;

/** Wins, losses and draws against each bot level (localStorage; junk is ignored, never throws). */
export function loadRecords(): Records {
  const v = load<unknown>(KEY, {});
  const out: Records = {};
  if (typeof v !== 'object' || v === null) return out;
  for (const level of LEVELS) {
    const t = (v as Record<string, unknown>)[level] as Partial<Tally> | undefined;
    if (t && typeof t === 'object') out[level] = { w: count(t.w), l: count(t.l), d: count(t.d) };
  }
  return out;
}

export function recordResult(level: BotLevel, outcome: Outcome): Tally {
  const all = loadRecords();
  const t = all[level] ?? { w: 0, l: 0, d: 0 };
  if (outcome === 'win') t.w++;
  else if (outcome === 'loss') t.l++;
  else t.d++;
  all[level] = t;
  save(KEY, all);
  return t;
}

/**
 * The result of a finished one-human-versus-one-bot game from the human's side; `null` for hot-seat,
 * bot-versus-bot, or a game that has not ended.
 */
export function humanResult(
  s: GameState,
  seats: readonly Seat[],
): { level: BotLevel; outcome: Outcome } | null {
  const humans = seats.flatMap((x, i) => (x.kind === 'human' ? [i] : []));
  const bots = seats.flatMap((x) => (x.kind === 'bot' ? [x] : []));
  if (humans.length !== 1 || bots.length !== 1 || bots[0]!.kind !== 'bot') return null;
  const level = bots[0]!.level;
  if (s.winner === null) return null;
  if (s.winner === 'draw') return { level, outcome: 'draw' };
  return { level, outcome: s.winner === humans[0] ? 'win' : 'loss' };
}

export function recordLine(level: BotLevel, t: Tally): string {
  const draws = t.d ? ` · ${t.d} ${t.d === 1 ? 'draw' : 'draws'}` : '';
  return `Record vs ${levelName[level] ?? level}: ${t.w} ${t.w === 1 ? 'win' : 'wins'} · ${t.l} ${t.l === 1 ? 'loss' : 'losses'}${draws}`;
}
