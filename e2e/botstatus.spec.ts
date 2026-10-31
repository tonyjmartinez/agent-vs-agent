import { test, expect } from '@playwright/test';
import { open, shot, trackErrors } from './helpers';

// Bot game: the human's turn line restates the goal, so a player who skipped the coach still knows the target.
// It must stay on one line at 320px (the status sits in the player row).
test('bot game: "Your move" line states the goal, on one line at 320x568', async ({ page }, info) => {
  const errors = trackErrors(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page, 'p0=human&p1=bot:easy');
  const status = page.locator('.panel.active .status');
  await expect(status).toHaveText(/^Your move · first to 3 intel$/);
  const box = (await status.boundingBox())!;
  const lh = await status.evaluate((el) => parseFloat(getComputedStyle(el).fontSize) * 1.3);
  expect(box.height).toBeLessThan(lh * 1.6); // one line
  await shot(page, info, 'botstatus-320');
  expect(errors).toEqual([]);
});
