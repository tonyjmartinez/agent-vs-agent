/** Board geometry in Phaser logical pixels (PLAN 4.6). */
export const WORLD = 1080;
export const MARGIN = 36;
export const CELL = 168;
export const SIZE = 6;

export const cellCenter = (r: number, c: number): { x: number; y: number } => ({
  x: MARGIN + CELL * c + CELL / 2,
  y: MARGIN + CELL * r + CELL / 2,
});

export const pointToCell = (x: number, y: number): { r: number; c: number } | null => {
  const c = Math.floor((x - MARGIN) / CELL);
  const r = Math.floor((y - MARGIN) / CELL);
  if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return null;
  return { r, c };
};
