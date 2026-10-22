import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { load } from './helpers';

test('boots, draws the board and HUD, no console errors', async ({ page }, info) => {
  const errors = await load(page);
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

  await expect(page.getByTestId('score-0')).toHaveText('Score 0/3');
  await expect(page.getByTestId('score-1')).toHaveText('Score 0/3');
  await expect(page.getByTestId('turn-0')).toHaveText('Your turn');
  const undo = (await page.getByTestId('undo').boundingBox())!;
  expect(undo.width).toBeGreaterThanOrEqual(44);
  expect(undo.height).toBeGreaterThanOrEqual(44);
  if (info.project.name === 'mobile') expect(box.width).toBeGreaterThan(300);

  await page.screenshot({ path: `artifacts/screens/ava-${info.project.name}-page.png` });
  const shot = await page.screenshot({ clip: box });
  const png = PNG.sync.read(shot);
  const seen = new Set<number>();
  for (let i = 0; i < png.data.length; i += 4 * 97) {
    seen.add((png.data[i]! << 16) | (png.data[i + 1]! << 8) | png.data[i + 2]!);
  }
  expect(seen.size).toBeGreaterThan(8); // tiles + spies + intel, not a blank canvas
  expect(errors).toEqual([]);
});
