import type { Cell, Rules } from './types';

const row = (r: number, size: number): Cell[] => Array.from({ length: size }, (_, c) => ({ r, c }));

/**
 * Centre-out spawn order: the 4 centre cells, then ring 2, then ring 3, each ring walked
 * clockwise from the top and interleaved with its 180° rotation so neither side is favoured.
 * Cells in any extraction zone are excluded (see DESIGN_NOTES: "spawn never on a zone").
 */
export function centreOutSpawnOrder(size: number, exclude: Cell[]): Cell[] {
  const mid = (size - 1) / 2;
  const isExcluded = (p: Cell) => exclude.some((e) => e.r === p.r && e.c === p.c);
  const ring = (p: Cell) => Math.max(Math.abs(p.r - mid), Math.abs(p.c - mid));
  const angle = (p: Cell) => {
    const a = Math.atan2(p.c - mid, -(p.r - mid)); // 0 at top, clockwise
    return a < 0 ? a + 2 * Math.PI : a;
  };
  const out: Cell[] = [
    { r: Math.floor(mid), c: Math.floor(mid) },
    { r: Math.ceil(mid), c: Math.ceil(mid) },
    { r: Math.floor(mid), c: Math.ceil(mid) },
    { r: Math.ceil(mid), c: Math.floor(mid) },
  ];
  const all: Cell[] = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) all.push({ r, c });
  const rings = [...new Set(all.map(ring))].sort((a, b) => a - b).slice(1);
  for (const k of rings) {
    const cells = all.filter((p) => ring(p) === k).sort((a, b) => angle(a) - angle(b));
    const half = cells.slice(0, cells.length / 2);
    for (const p of half) {
      for (const q of [p, { r: size - 1 - p.r, c: size - 1 - p.c }]) {
        if (!isExcluded(q)) out.push(q);
      }
    }
  }
  return out;
}

export function duelRules(overrides: Partial<Rules> = {}): Rules {
  const size = 6;
  const zones = [row(5, size), row(0, size)];
  const base: Rules = {
    size,
    players: [
      {
        zone: zones[0]!,
        start: [
          { r: 5, c: 1 },
          { r: 5, c: 4 },
        ],
        color: 'red',
      },
      {
        zone: zones[1]!,
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
    intelSpawnOrder: centreOutSpawnOrder(size, zones.flat()),
    intelToWin: 3,
    maxPlies: 120,
    carrierCanEnterIntel: false,
    firstMoveNoBump: false,
    veterans: false,
  };
  return { ...base, ...overrides };
}

/** FFA preset (Phase 8 stretch): 4 players × 1 spy, zones = non-corner edge cells. */
export function ffaRules(overrides: Partial<Rules> = {}): Rules {
  const size = 6;
  const inner = [1, 2, 3, 4];
  const zones: Cell[][] = [
    inner.map((c) => ({ r: 5, c })),
    inner.map((c) => ({ r: 0, c })),
    inner.map((r) => ({ r, c: 0 })),
    inner.map((r) => ({ r, c: 5 })),
  ];
  const colors = ['red', 'teal', 'plum', 'olive'];
  const starts: Cell[] = [
    { r: 5, c: 2 },
    { r: 0, c: 3 },
    { r: 2, c: 0 },
    { r: 3, c: 5 },
  ];
  return duelRules({
    players: zones.map((zone, i) => ({ zone, start: [starts[i]!], color: colors[i]! })),
    spiesPerPlayer: 1,
    intelSpawnOrder: centreOutSpawnOrder(size, zones.flat()),
    ...overrides,
  });
}
