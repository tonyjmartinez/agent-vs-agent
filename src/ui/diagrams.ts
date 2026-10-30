import { theme } from './theme';

const S = 56; // cell size in the diagrams
const head = (w: number, h: number, label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}" class="diagram">`;
const cell = (x: number, y: number, fill: string = theme.tileA) =>
  `<rect x="${x + 2}" y="${y + 2}" width="${S - 4}" height="${S - 4}" rx="8" fill="${fill}"/>`;
const spy = (cx: number, cy: number, color: string, hat: 'round' | 'point' = 'round') =>
  `<circle cx="${cx}" cy="${cy}" r="18" fill="${color}" stroke="${theme.ink}" stroke-width="3"/>` +
  `<rect x="${cx - 10}" y="${cy - 3}" width="20" height="5" fill="${theme.ink}"/>` +
  (hat === 'round'
    ? `<ellipse cx="${cx}" cy="${cy - 16}" rx="13" ry="3.5" fill="${theme.ink}"/>`
    : `<polygon points="${cx - 8},${cy - 14} ${cx + 8},${cy - 14} ${cx},${cy - 28}" fill="${theme.ink}"/>`);
const arrow = (x1: number, y1: number, x2: number, y2: number, color: string = theme.ink) => {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (d: number) => `${x2 + Math.cos(a + d) * 9},${y2 + Math.sin(a + d) * 9}`;
  return (
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="4" stroke-linecap="round"/>` +
    `<polygon points="${x2 + Math.cos(a) * 7},${y2 + Math.sin(a) * 7} ${p(2.5)} ${p(-2.5)}" fill="${color}"/>`
  );
};
const folder = (cx: number, cy: number) =>
  `<rect x="${cx - 9}" y="${cy - 7}" width="18" height="14" rx="2" fill="${theme.mustard}" stroke="${theme.ink}" stroke-width="2"/>`;

/** Red arrives next to Teal; Teal is pushed one square straight away. */
export function bumpDiagram(): string {
  return (
    head(S * 4, S + 20, 'A spy arrives and pushes the spy next to it one square away') +
    [0, 1, 2, 3].map((i) => cell(i * S, 5)).join('') +
    spy(S * 0.5, S / 2 + 5, theme.red) +
    spy(S * 1.5, S / 2 + 5, theme.teal, 'point') +
    `<circle cx="${S * 2.5}" cy="${S / 2 + 5}" r="18" fill="none" stroke="${theme.teal}" stroke-width="3" stroke-dasharray="5 4"/>` +
    arrow(S * 1.5 - 10, S + 14, S * 2.5 + 8, S + 14) +
    '</svg>'
  );
}

/** Teal stands on the edge; the bump pushes it off the board into its reserve. */
export function burnDiagram(): string {
  return (
    head(S * 4, S + 10, 'A spy pushed off the edge of the board is burned') +
    [0, 1, 2].map((i) => cell(i * S, 5)).join('') +
    `<line x1="${S * 3}" y1="0" x2="${S * 3}" y2="${S + 10}" stroke="${theme.ink}" stroke-width="4"/>` +
    spy(S * 0.5, S / 2 + 5, theme.red) +
    spy(S * 2.5 - 4, S / 2 + 5, theme.teal, 'point') +
    arrow(S * 2.5 + 16, S / 2 + 5, S * 3.7, S / 2 + 5, theme.danger) +
    `<g stroke="${theme.danger}" stroke-width="5" stroke-linecap="round"><line x1="${S * 3.45}" y1="14" x2="${S * 3.85}" y2="${S - 4}"/><line x1="${S * 3.85}" y1="14" x2="${S * 3.45}" y2="${S - 4}"/></g>` +
    '</svg>'
  );
}

/** A carrier steps onto its own extraction row and banks the intel. */
export function extractDiagram(): string {
  return (
    head(S * 3, S * 2 + 10, 'A spy carrying intel steps onto its own row to score') +
    [0, 1, 2].map((i) => cell(i * S, 5)).join('') +
    [0, 1, 2].map((i) => cell(i * S, S + 5, 'rgba(228,87,46,0.25)')).join('') +
    spy(S * 1.5, S / 2 + 5, theme.red) +
    folder(S * 1.5 + 14, S / 2 + 20) +
    arrow(S * 1.5, S / 2 + 28, S * 1.5, S + S / 2 + 2, theme.ink) +
    `<text x="${S * 2.5}" y="${S + S / 2 + 12}" text-anchor="middle" font-size="22" font-family="Fredoka, sans-serif" fill="${theme.ink}">+1</text>` +
    '</svg>'
  );
}
