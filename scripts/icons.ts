/**
 * Renders the app icons (Add to Home Screen) from the spy SVG art into public/.
 *   npx tsx scripts/icons.ts
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { headSvg, svgUri } from '../src/ui/art';
import { theme } from '../src/ui/theme';

const sizes: [string, number][] = [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
];

// Icon: cream tile, Red spy head centred inside the maskable safe zone (inner 80%).
const page = (
  n: number,
) => `<html><body style="margin:0;width:${n}px;height:${n}px;background:${theme.paper};display:grid;place-items:center">
<img src="${svgUri(headSvg(0))}" style="width:${Math.round(n * 0.7)}px"></body></html>`;

const browser = await chromium.launch();
const p = await browser.newPage();
fs.mkdirSync('public', { recursive: true });
for (const [name, n] of sizes) {
  await p.setViewportSize({ width: n, height: n });
  await p.setContent(page(n));
  await p.waitForFunction(() => document.images[0]?.complete);
  await p.screenshot({ path: `public/${name}` });
  console.log('public/' + name);
}
await browser.close();
fs.writeFileSync(
  'public/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="24" fill="${theme.paper}"/><image href="${svgUri(headSvg(0))}" x="12" y="20" width="96" height="80"/></svg>`,
);
