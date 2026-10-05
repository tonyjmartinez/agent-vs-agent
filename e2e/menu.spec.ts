import { test, expect } from '@playwright/test';
import { shot, tapCell, trackErrors } from './helpers';

test('menu → play vs Easy for 3 human moves; rules card; pause menu', async ({ page }, info) => {
  const errors = trackErrors(page);
  await page.goto('/?test=1&speed=0');
  await page.evaluate(() => (window as any).__AVA__.ready);
  await expect(page.locator('#menu')).toBeVisible();
  await shot(page, info, 'menu');
  await page.click('#btn-howto');
  await expect(page.locator('#rules')).toBeVisible();
  await shot(page, info, 'rules');
  await page.click('#btn-rules-close');
  await page.click('[data-level="easy"]');
  await page.click('#btn-play-bot');
  await expect(page.locator('#menu')).toHaveCount(0);
  const touch = !!info.project.use.hasTouch;
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => (window as any).__AVA__.idle());
    const st = await page.evaluate(() => (window as any).__AVA__.getState());
    expect(st.current).toBe(0);
    // pick the first legal move of the human and play it through real input
    const a = await page.evaluate(() =>
      (window as any).__AVA__.legal().find((x: any) => x.kind === 'move'),
    );
    const from = st.spies.find((s: any) => s.id === a.spyId).pos;
    await tapCell(page, info, from.r, from.c);
    await tapCell(page, info, a.to.r, a.to.c);
    if (touch) await tapCell(page, info, a.to.r, a.to.c);
    const t0 = Date.now();
    await page.waitForFunction(
      (ply) =>
        (window as any).__AVA__.getState().ply >= ply + 2 ||
        (window as any).__AVA__.getState().winner !== null,
      st.ply,
    );
    expect(Date.now() - t0).toBeLessThan(2000);
  }
  await shot(page, info, 'vs-easy');
  await page.click('#btn-menu');
  await expect(page.locator('#pause')).toBeVisible();
  await page.click('#btn-quit');
  await expect(page.locator('#menu')).toBeVisible();
  expect(errors).toEqual([]);
});
