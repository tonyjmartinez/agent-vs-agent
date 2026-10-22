import { cmpCell, inBounds, key } from './board';
import { cloneState } from './engine';
import { duelRules } from './rules';
import type { Cell, GameState, Rules, Spy, Winner } from './types';

export const toJSON = (s: GameState): string => JSON.stringify(s);

/** Parse and validate a state produced by `toJSON`. Throws on anything inconsistent. */
export function fromJSON(text: string): GameState {
  const s = JSON.parse(text) as GameState;
  validate(s);
  return cloneState(s);
}

function validate(s: GameState): void {
  const bad = (m: string): never => {
    throw new Error(`invalid state: ${m}`);
  };
  if (!s || typeof s !== 'object' || !s.rules) bad('shape');
  const n = s.rules.players.length;
  if (!Number.isInteger(s.ply) || s.ply < 0) bad('ply');
  if (!Number.isInteger(s.current) || s.current < 0 || s.current >= n) bad('current');
  if (s.scores.length !== n || s.scores.some((v) => !Number.isInteger(v) || v < 0)) bad('scores');
  const seen = new Set<number>();
  for (const p of s.spies) {
    if (p.owner < 0 || p.owner >= n) bad(`owner of ${p.id}`);
    if (p.pos) {
      if (!inBounds(p.pos)) bad(`position of ${p.id}`);
      if (seen.has(key(p.pos))) bad('overlapping spies');
      seen.add(key(p.pos));
    } else if (p.carrying) bad('carrier in reserve');
  }
  const intel = new Set<number>();
  for (const c of s.intel) {
    if (!inBounds(c)) bad('intel off board');
    if (intel.has(key(c))) bad('two intel on one cell');
    intel.add(key(c));
  }
}

const cellStr = (c: Cell): string => `${c.r}${c.c}`;
const parseCell = (t: string): Cell => {
  const r = Number(t[0]);
  const c = Number(t[1]);
  if (t.length !== 2 || !Number.isInteger(r) || !Number.isInteger(c)) {
    throw new Error(`invalid cell: ${t}`);
  }
  return { r, c };
};

/**
 * URL-friendly form, e.g. `1;0;0,0;-;p0a@51,p0b@54*,p1a@x,p1b@04;22,33`
 * = version;ply;current;scores;winner('-' none, 'd' draw, or player);spies;intel.
 * Rules are not encoded; pass them to `fromCompact` (default: Duel).
 */
export function toCompact(s: GameState): string {
  const winner = s.winner === null ? '-' : s.winner === 'draw' ? 'd' : String(s.winner);
  const spies = s.spies
    .map((p) => `${p.id}@${p.pos ? cellStr(p.pos) : 'x'}${p.carrying ? '*' : ''}`)
    .join(',');
  const intel = [...s.intel].sort(cmpCell).map(cellStr).join(',');
  return `1;${s.ply};${s.current};${s.scores.join(',')};${winner};${spies};${intel}`;
}

export function fromCompact(text: string, rules: Rules = duelRules()): GameState {
  const parts = text.split(';');
  if (parts.length !== 7 || parts[0] !== '1') throw new Error('invalid compact state');
  const [, ply, current, scores, winner, spyText, intelText] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const w: Winner = winner === '-' ? null : winner === 'd' ? 'draw' : Number(winner);
  const spies: Spy[] = spyText.split(',').map((tok) => {
    const m = /^p(\d+)([a-z])@(x|\d\d)(\*?)$/.exec(tok);
    if (!m) throw new Error(`invalid spy: ${tok}`);
    return {
      id: `p${m[1]}${m[2]}`,
      owner: Number(m[1]),
      pos: m[3] === 'x' ? null : parseCell(m[3]!),
      carrying: m[4] === '*',
    };
  });
  const s: GameState = {
    rules,
    ply: Number(ply),
    current: Number(current),
    spies,
    intel: intelText === '' ? [] : intelText.split(',').map(parseCell).sort(cmpCell),
    scores: scores.split(',').map(Number),
    winner: w,
  };
  validate(s);
  return s;
}
