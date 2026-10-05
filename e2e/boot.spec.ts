import { test, expect } from '@playwright/test';
import { expectCanvasNotBlank, open, shot, trackErrors } from './helpers';

test('boots with no errors, a non-blank canvas and no scroll', async ({ page }, info) => {
  const errors = trackErrors(page);
  await open(page);
  await expectCanvasNotBlank(page);
  const scroll = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: innerWidth,
    sh: document.documentElement.scrollHeight,
    ih: innerHeight,
  }));
  expect(scroll.sw).toBeLessThanOrEqual(scroll.iw);
  expect(scroll.sh).toBeLessThanOrEqual(scroll.ih);
  await shot(page, info, 'boot');
  expect(errors).toEqual([]);
});
