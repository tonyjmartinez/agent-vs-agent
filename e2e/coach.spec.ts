import { test, expect } from '@playwright/test';
import { shot, trackErrors } from './helpers';

// First-game coach bubble (not test mode: test mode turns the coach marks off). A new player is told the goal
// before the first move; the bubble stays one line at 320px.
test('first game: the coach bubble states the goal, on one line at 320x568', async ({
  page,
}, info) => {
  const errors = trackErrors(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/?speed=0&p0=human&p1=human');
  const coach = page.locator('#coach');
  await expect(coach).toHaveText(/^Goal: \d+ intel\. (Tap|Click) a spy\.$/);
  const box = (await coach.boundingBox())!;
  const lh = await coach.evaluate((el) => parseFloat(getComputedStyle(el).fontSize) * 1.3);
  expect(box.height).toBeLessThan(lh * 2.2); // one line of text plus padding
  await shot(page, info, 'coach-first-320');
  expect(errors).toEqual([]);
});
