import type { BotLevel } from '../ai/bots';

/** URL params that survive menu/game navigation (test and tuning knobs). */
const KEEP = ['test', 'speed', 'seed', 'confirm', 'coach'];

export type Mode = 'hotseat' | { bot: BotLevel };

export const modeToString = (m: Mode): string => (m === 'hotseat' ? 'hotseat' : `bot:${m.bot}`);

export function modeFromString(s: string | null): Mode | null {
  if (s === 'hotseat') return 'hotseat';
  const m = /^bot:(easy|medium|hard)$/.exec(s ?? '');
  return m ? { bot: m[1] as BotLevel } : null;
}

function carried(search: string): URLSearchParams {
  const from = new URLSearchParams(search);
  const to = new URLSearchParams();
  for (const k of KEEP) if (from.has(k)) to.set(k, from.get(k)!);
  return to;
}

/** `?` URL that starts a game in the given mode (human is always Red / seat 0). */
export function gameSearch(current: string, mode: Mode): string {
  const q = carried(current);
  if (mode !== 'hotseat') q.set('p1', `bot:${mode.bot}`);
  q.set('play', '1'); // explicit game: skip the menu
  return `?${q.toString()}`;
}

export function menuSearch(current: string): string {
  const q = carried(current);
  q.set('menu', '1');
  return `?${q.toString()}`;
}
