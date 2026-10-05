import type { Cell } from './types';

export const KING_DIRS: readonly Cell[] = [
  { r: -1, c: -1 },
  { r: -1, c: 0 },
  { r: -1, c: 1 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
  { r: 1, c: -1 },
  { r: 1, c: 0 },
  { r: 1, c: 1 },
];
export const ORTHO_DIRS: readonly Cell[] = KING_DIRS.filter((d) => d.r === 0 || d.c === 0);

export const cell = (r: number, c: number): Cell => ({ r, c });
export const add = (a: Cell, b: Cell): Cell => ({ r: a.r + b.r, c: a.c + b.c });
export const sub = (a: Cell, b: Cell): Cell => ({ r: a.r - b.r, c: a.c - b.c });
export const eq = (a: Cell | null, b: Cell | null): boolean =>
  !!a && !!b && a.r === b.r && a.c === b.c;
export const inBounds = (p: Cell, size: number): boolean =>
  p.r >= 0 && p.c >= 0 && p.r < size && p.c < size;
export const key = (p: Cell): string => `${p.r},${p.c}`;
export const cheb = (a: Cell, b: Cell): number =>
  Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c));
export const cmpCell = (a: Cell, b: Cell): number => a.r - b.r || a.c - b.c;
