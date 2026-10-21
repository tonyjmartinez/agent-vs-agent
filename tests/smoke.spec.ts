import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

test('boots, draws the board, no console errors', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?test=1');
  await page.evaluate(() => window.__AVA__!.ready);
  await page.waitForTimeout(300);

  const canvas = page.locator('#board canvas');
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  const noScroll = await page.evaluate(
    () =>
      document.documentElement.scrollWidth <= innerWidth &&
      document.documentElement.scrollHeight <= innerHeight,
  );
  expect(noScroll).toBe(true);

  await page.screenshot({ path: `artifacts/screens/ava-${info.project.name}-page.png` });
  const shot = await page.screenshot({
    path: `artifacts/screens/ava-${info.project.name}-boot.png`,
    clip: box,
  });
  const png = PNG.sync.read(shot);
  const seen = new Set<number>();
  for (let i = 0; i < png.data.length; i += 4 * 97) {
    seen.add((png.data[i]! << 16) | (png.data[i + 1]! << 8) | png.data[i + 2]!);
  }
  expect(seen.size).toBeGreaterThan(3);

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  expect(await page.evaluate(() => window.__AVA__!.clicks.length)).toBe(1);
  expect(errors).toEqual([]);
});
