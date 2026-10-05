import { test, expect } from '@playwright/test';
import { open } from './helpers';
import fs from 'node:fs';

const sizes = [
  { name: 'iphone-se1-320x568', width: 320, height: 568 },
  { name: 'android-360x640', width: 360, height: 640 },
  { name: 'iphone-se-375x667', width: 375, height: 667 },
  { name: 'android-360x780', width: 360, height: 780 },
  { name: 'iphone-14-390x844', width: 390, height: 844 },
  { name: 'pixel-7-412x915', width: 412, height: 915 },
  { name: 'iphone-pro-max-430x932', width: 430, height: 932 },
  { name: 'landscape-se-667x375', width: 667, height: 375 },
  { name: 'landscape-844x390', width: 844, height: 390 },
  { name: 'landscape-932x430', width: 932, height: 430 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'tablet-landscape-1024x768', width: 1024, height: 768 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
];

for (const vp of sizes) {
  test(`layout fits at ${vp.name}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'viewport sweep runs once');
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page, 'p0=human&p1=bot:easy');
    await page.evaluate(() => (window as any).__AVA__.controller().view?.relayout?.());
    const board = (await page.locator('#board canvas').boundingBox())!;
    expect(board.x).toBeGreaterThanOrEqual(0);
    expect(board.y).toBeGreaterThanOrEqual(0);
    expect(board.x + board.width).toBeLessThanOrEqual(vp.width + 0.5);
    expect(board.y + board.height).toBeLessThanOrEqual(vp.height + 0.5);
    // The board should use most of the short side.
    expect(board.width).toBeGreaterThan(Math.min(vp.width, vp.height) * 0.55);
    for (const sel of ['.panel', '.panel *', '.btn']) {
      for (const box of await page.locator(sel).all()) {
        const b = await box.boundingBox();
        if (!b) continue;
        const overlaps =
          b.x < board.x + board.width - 1 &&
          b.x + b.width > board.x + 1 &&
          b.y < board.y + board.height - 1 &&
          b.y + b.height > board.y + 1;
        expect(overlaps, `${sel} overlaps board`).toBe(false);
        expect(b.y + b.height).toBeLessThanOrEqual(vp.height + 0.5);
        if (sel === '.btn') {
          expect(b.height).toBeGreaterThanOrEqual(44);
          expect(b.width).toBeGreaterThanOrEqual(44);
        }
      }
    }
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(sw).toBeLessThanOrEqual(vp.width);
    fs.mkdirSync('artifacts/screens', { recursive: true });
    await page.screenshot({ path: `artifacts/screens/layout-${vp.name}.png` });
  });
}
