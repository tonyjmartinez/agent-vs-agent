import { theme } from './theme';

/**
 * All piece art as SVG strings (PLAN 3.1 / 3.3): authored in code, rasterised at boot for Phaser
 * and used as data URIs in the DOM. No text inside SVGs: an SVG drawn through <img> can't see
 * the page's web fonts, so stamps are glyphs.
 */

const INK = theme.ink;
const CREAM = theme.paper;

/** Team look: colour plus a shape cue that survives greyscale / colour-blindness. */
export const teamLook = [
  { body: theme.red, shade: '#B8411F', hat: 'round' as const },
  { body: theme.teal, shade: '#0E7C7A', hat: 'pointed' as const },
  { body: theme.plum, shade: '#4E3768', hat: 'round' as const },
  { body: theme.olive, shade: '#59672A', hat: 'pointed' as const },
];

/** Spy: viewBox 120×140. Body centre ≈ (60, 88). */
export function spySvg(owner: number): string {
  const t = teamLook[owner % teamLook.length]!;
  const hat =
    t.hat === 'round'
      ? // Round-brim fedora: wide elliptical brim, domed crown, team band.
        `<ellipse cx="60" cy="40" rx="50" ry="11" fill="${INK}"/>
         <path d="M30 40 C30 14 90 14 90 40 Z" fill="${INK}"/>
         <path d="M31 33 L89 33 L90 40 L30 40 Z" fill="${t.body}"/>
         <ellipse cx="60" cy="40" rx="50" ry="11" fill="none" stroke="${INK}" stroke-width="3"/>`
      : // Pointed trilby: narrow snap brim, pinched peak, team band.
        `<path d="M14 44 Q60 30 106 44 Q60 50 14 44 Z" fill="${INK}"/>
         <path d="M32 42 L44 18 Q60 6 76 18 L88 42 Z" fill="${INK}"/>
         <path d="M34 36 L86 36 L88 42 L32 42 Z" fill="${t.body}"/>`;
  const scarf =
    t.hat === 'pointed'
      ? `<path d="M22 104 Q60 118 98 104 L98 116 Q60 130 22 116 Z" fill="${theme.mustard}" stroke="${INK}" stroke-width="4"/>
         <path d="M40 112 L40 124 M52 115 L52 127 M68 115 L68 127 M80 112 L80 124" stroke="${INK}" stroke-width="3" opacity=".5"/>`
      : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 140" width="120" height="140">
  <rect x="14" y="38" width="92" height="96" rx="46" fill="${t.body}" stroke="${INK}" stroke-width="5"/>
  <path d="M24 104 Q60 124 96 104 L96 112 Q60 134 24 112 Z" fill="${t.shade}" opacity=".35"/>
  <rect x="24" y="56" width="72" height="32" rx="16" fill="${CREAM}" stroke="${INK}" stroke-width="4"/>
  <rect x="29" y="63" width="27" height="15" rx="6" fill="${INK}"/>
  <rect x="64" y="63" width="27" height="15" rx="6" fill="${INK}"/>
  <path d="M55 68 L65 68" stroke="${INK}" stroke-width="4"/>
  <path d="M34 66 L42 66" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>
  <path d="M69 66 L77 66" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>
  <path d="M52 96 Q60 101 68 96" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  ${scarf}
  ${hat}
</svg>`;
}

/** Intel folder: viewBox 80×64, with a red seal glyph instead of text. */
export function folderSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 64" width="80" height="64">
  <path d="M6 14 Q6 8 12 8 L30 8 L36 14 L68 14 Q74 14 74 20 L74 54 Q74 60 68 60 L12 60 Q6 60 6 54 Z" fill="${theme.mustard}" stroke="${INK}" stroke-width="4"/>
  <path d="M6 22 L74 22" stroke="${INK}" stroke-width="3" opacity=".35"/>
  <g transform="rotate(-12 40 41)">
    <rect x="18" y="32" width="44" height="18" rx="4" fill="none" stroke="${theme.danger}" stroke-width="4"/>
    <path d="M24 38 L56 38 M24 44 L48 44" stroke="${theme.danger}" stroke-width="3.5" stroke-linecap="round"/>
  </g>
</svg>`;
}

/** Spy head only (favicon, HUD chips): viewBox 120×100 crop of the spy. */
export function headSvg(owner: number): string {
  return spySvg(owner).replace(
    'viewBox="0 0 120 140" width="120" height="140"',
    'viewBox="0 6 120 100" width="120" height="100"',
  );
}

export const svgUri = (svg: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Rasterise an SVG string to a canvas at `scale`× its intrinsic size (browser only). */
export async function rasterise(
  svg: string,
  w: number,
  h: number,
  scale = 2,
): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = svgUri(svg);
  await img.decode();
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c;
}
