import { test, expect } from '@playwright/test';
import { open, shot, tapCell, trackErrors } from './helpers';

const isTouch = (info: { project: { use: { hasTouch?: boolean } } }) => !!info.project.use.hasTouch;

/** Select + (preview on touch) + commit through real pointer input. */
async function humanMove(page: any, info: any, from: [number, number], to: [number, number]) {
  await tapCell(page, info, from[0], from[1]);
  await tapCell(page, info, to[0], to[1]);
  if (isTouch(info)) await tapCell(page, info, to[0], to[1]);
  await page.evaluate(() => (window as any).__AVA__.idle());
}

test('hotseat: a scripted game to a win via real taps/clicks, with undo', async ({
  page,
}, info) => {
  const errors = trackErrors(page);
  // Red carrier one step from home with 2 points; teal far away.
  await open(page, 'p0=human&p1=human&state=v1.0.0.2-0.41*,54,01,04.2233');
  await shot(page, info, 'hotseat-start');
  await humanMove(page, info, [4, 1], [3, 1]);
  expect(await page.evaluate(() => (window as any).__AVA__.getState().ply)).toBe(1);
  await page.click('#btn-undo');
  expect(await page.evaluate(() => (window as any).__AVA__.getState().ply)).toBe(0);
  await humanMove(page, info, [4, 1], [5, 1]);
  await expect(page.locator('[data-testid="score-0"]')).toHaveAttribute('data-score', '3');
  await expect(page.locator('#game-over')).toBeVisible();
  await expect(page.locator('#game-over .stamp')).toHaveText('AGENT RED WINS');
  await shot(page, info, 'game-over');
  await page.click('#btn-rematch');
  await expect(page.locator('#game-over')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__AVA__.encode())).toBe(
    'v1.0.0.0-0.51,54,01,04.2233',
  );
  expect(errors).toEqual([]);
});

test('preview of a pending burn', async ({ page }, info) => {
  // Red at (2,1); teal at (0,2) and (1,... ) -> Red to (1,2)? Use: teal on top edge at (0,2), red moves to (1,2).
  await open(page, 'p0=human&p1=human&state=v1.0.0.0-0.21,54,02,04.2233');
  await tapCell(page, info, 2, 1);
  if (isTouch(info)) await tapCell(page, info, 1, 2);
  else {
    const { x, y } = await page.evaluate(() => (window as any).__AVA__.cellClient(1, 2));
    await page.mouse.move(x, y);
  }
  const pending = await page.evaluate(() => (window as any).__AVA__.controller().sel.pending);
  expect(pending).toMatchObject({ kind: 'move', to: { r: 1, c: 2 } });
  await shot(page, info, 'preview-burn');
  await tapCell(page, info, 1, 2);
  await page.evaluate(() => (window as any).__AVA__.idle());
  const st = await page.evaluate(() => (window as any).__AVA__.getState());
  expect(st.spies.find((s: any) => s.id === 'p1a').pos).toBeNull();
  await shot(page, info, 'after-burn');
});

test('deploy from the reserve tray', async ({ page }, info) => {
  await open(page, 'p0=human&p1=human&state=v1.0.2.0-0.x,54,01,04.2233');
  await page.locator('[data-testid="reserve-0"]').first().click();
  await tapCell(page, info, 5, 0);
  if (isTouch(info)) await tapCell(page, info, 5, 0);
  await page.evaluate(() => (window as any).__AVA__.idle());
  const st = await page.evaluate(() => (window as any).__AVA__.getState());
  expect(st.spies[0].pos).toEqual({ r: 5, c: 0 });
});
