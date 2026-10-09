import { test, expect } from '@playwright/test';
import { open, trackErrors } from './helpers';

test('keyboard: Tab selects a spy, arrows aim, Enter moves, U undoes', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'keyboard is a desktop nicety');
  const errors = trackErrors(page);
  await open(page, 'p0=human&p1=human');
  await page.locator('body').click({ position: { x: 5, y: 5 } }); // focus the page, not a button
  await page.keyboard.press('Tab');
  let sel = await page.evaluate(() => (window as any).__AVA__.controller().sel.selected);
  expect(sel).toBe('p0a');
  await page.keyboard.press('Tab');
  sel = await page.evaluate(() => (window as any).__AVA__.controller().sel.selected);
  expect(sel).toBe('p0b');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('ArrowUp'); // cursor (5,1) -> (4,1): a legal target, previewed
  const pending = await page.evaluate(() => (window as any).__AVA__.controller().sel.pending);
  expect(pending).toMatchObject({ spyId: 'p0a', to: { r: 4, c: 1 } });
  await page.keyboard.press('Enter');
  await page.evaluate(() => (window as any).__AVA__.idle());
  expect(await page.evaluate(() => (window as any).__AVA__.getState().ply)).toBe(1);
  await page.keyboard.press('u');
  expect(await page.evaluate(() => (window as any).__AVA__.getState().ply)).toBe(0);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => (window as any).__AVA__.controller().sel.selected)).toBeNull();
  expect(errors).toEqual([]);
});
