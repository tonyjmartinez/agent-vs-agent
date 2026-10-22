import type { Cell } from './types';

export const SIZE = 6;

/** The 8 directions, clockwise from north. Order is part of the deterministic action order. */
export const KING_DIRS: readonly Cell[] = [
  { r: -1, c: 0 },
  { r: -1, c: 1 },
  { r: 0, c: 1 },
  { r: 1, c: 1 },
  { r: 1, c: 0 },
  { r: 1, c: -1 },
  { r: 0, c: -1 },
  { r: -1, c: -1 },
];
export const ORTHO_DIRS: readonly Cell[] = [
  KING_DIRS[0]!,
  KING_DIRS[2]!,
  KING_DIRS[4]!,
  KING_DIRS[6]!,
];

export const inBounds = (c: Cell): boolean => c.r >= 0 && c.r < SIZE && c.c >= 0 && c.c < SIZE;
export const key = (c: Cell): number => c.r * SIZE + c.c;
export const add = (a: Cell, b: Cell): Cell => ({ r: a.r + b.r, c: a.c + b.c });
export const sameCell = (a: Cell, b: Cell): boolean => a.r === b.r && a.c === b.c;
export const cmpCell = (a: Cell, b: Cell): number => key(a) - key(b);
