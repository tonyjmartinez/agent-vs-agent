import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers';

test('the menu explains the picked level, on screen at 360px', async ({ page }) => {
  const errors = trackErrors(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/?test=1&speed=0');
  await page.evaluate(() => (window as any).__AVA__.ready);
  await expect(page.locator('#menu')).toBeVisible();
  await page.click('[data-level="hard"]');
  await expect(page.locator('[data-testid="level-hint"]')).toContainText('Hard:');
  await page.click('[data-level="easy"]');
  await expect(page.locator('[data-testid="level-hint"]')).toContainText('Easy:');
  // Visible without scrolling, so a first-time player sees it before tapping Play.
  const b = (await page.locator('[data-testid="level-hint"]').boundingBox())!;
  const vp = page.viewportSize()!;
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
  expect(errors).toEqual([]);
});
