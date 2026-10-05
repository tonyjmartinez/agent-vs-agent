import { expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

export async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`/?test=1&speed=0${query ? '&' + query : ''}`);
  await page.waitForFunction(() => !!(window as any).__AVA__);
  await page.evaluate(() => (window as any).__AVA__.ready);
}

export async function shot(page: Page, info: TestInfo, name: string): Promise<string> {
  const dir = path.join('artifacts', 'screens');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${info.project.name}-${name}.png`);
  await page.screenshot({ path: file });
  return file;
}

export async function tapCell(page: Page, info: TestInfo, r: number, c: number): Promise<void> {
  const { x, y } = await page.evaluate(
    ([r, c]) => (window as any).__AVA__.cellClient(r, c),
    [r, c],
  );
  if (info.project.use.hasTouch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** Canvas must not be a single flat colour (WebGL blank-screenshot guard). */
export async function expectCanvasNotBlank(page: Page): Promise<void> {
  const box = await page.locator('#board canvas').boundingBox();
  expect(box).not.toBeNull();
  const buf = await page.screenshot({ clip: box! });
  const colours = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const seen = new Set<number>();
    for (let i = 0; i < d.length; i += 4 * 97)
      seen.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
    return seen.size;
  }, buf.toString('base64'));
  expect(colours).toBeGreaterThan(3);
}
