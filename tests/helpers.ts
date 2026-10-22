import type { Page } from '@playwright/test';
import type { Action, GameState } from '../src/engine/types';

export type Cell = [number, number];

export async function load(page: Page, query = ''): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`/?test=1&speed=0${query}`);
  await page.evaluate(() => window.__AVA__!.ready);
  return errors;
}

export const state = (page: Page): Promise<GameState> =>
  page.evaluate(() => window.__AVA__!.getState());

export const legal = (page: Page): Promise<Action[]> =>
  page.evaluate(() => window.__AVA__!.legal());

export async function tapCell(page: Page, touch: boolean, [r, c]: Cell): Promise<void> {
  const { x, y } = await page.evaluate(([rr, cc]) => window.__AVA__!.cellClient(rr!, cc!), [r, c]);
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

export async function waitPly(page: Page, ply: number): Promise<void> {
  await page.waitForFunction((p) => window.__AVA__!.getState().ply === p, ply);
}

/** Select a spy and commit a move/deploy target the way a human would on this device. */
export async function commit(
  page: Page,
  touch: boolean,
  from: Cell | 'reserve',
  to: Cell,
): Promise<void> {
  const before = (await state(page)).ply;
  if (from === 'reserve') await page.locator('[data-testid^="reserve-"]:enabled').first().click();
  else await tapCell(page, touch, from);
  await tapCell(page, touch, to);
  if (await page.evaluate(() => window.__AVA__!.confirm)) await tapCell(page, touch, to);
  await waitPly(page, before + 1);
}
