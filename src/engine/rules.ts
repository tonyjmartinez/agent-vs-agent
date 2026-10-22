import type { Cell, Rules } from './types';
import { SIZE } from './board';

const row = (r: number): Cell[] => Array.from({ length: SIZE }, (_, c) => ({ r, c }));

/** Centre four first, then the remaining cells by ring (distance from the board centre), row-major. */
function defaultSpawnOrder(): Cell[] {
  const centre: Cell[] = [
    { r: 2, c: 2 },
    { r: 3, c: 3 },
    { r: 2, c: 3 },
    { r: 3, c: 2 },
  ];
  const rest: Cell[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!centre.some((p) => p.r === r && p.c === c)) rest.push({ r, c });
    }
  }
  const ring = (p: Cell) => Math.max(Math.abs(2 * p.r - 5), Math.abs(2 * p.c - 5));
  rest.sort((a, b) => ring(a) - ring(b));
  return [...centre, ...rest];
}

export function duelRules(overrides: Partial<Rules> = {}): Rules {
  return {
    size: 6,
    players: [
      {
        extraction: row(5),
        start: [
          { r: 5, c: 1 },
          { r: 5, c: 4 },
        ],
        color: 'red',
      },
      {
        extraction: row(0),
        start: [
          { r: 0, c: 1 },
          { r: 0, c: 4 },
        ],
        color: 'teal',
      },
    ],
    spiesPerPlayer: 2,
    movement: 'king',
    bumpOwnSpies: true,
    intelOnBoard: 2,
    intelStart: [
      { r: 2, c: 2 },
      { r: 3, c: 3 },
    ],
    intelSpawnOrder: defaultSpawnOrder(),
    intelToWin: 3,
    maxPlies: 120,
    carrierCanEnterIntel: false,
    firstMoveNoBump: false,
    veterans: false,
    ...overrides,
  };
}

export const DUEL_RULES: Rules = duelRules();
