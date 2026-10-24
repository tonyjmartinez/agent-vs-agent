import { expect, type Page, type TestInfo } from '@playwright/test';
import { Solver } from '../src/ai/solve';
import { decode } from '../src/engine/serialize';
import type { Action, GameState } from '../src/engine/types';
import { goalText, pillText, type Mission } from '../src/missions';
import { tapCell } from './helpers';

export const ava = (page: Page) =>
  page.evaluate(() => (window as any).__AVA__.getState() as GameState);
export const idle = (page: Page) => page.evaluate(() => (window as any).__AVA__.idle());
export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Play one Red action through real input (reserve tray + taps, second tap on touch). */
export async function play(page: Page, info: TestInfo, s: GameState, a: Action): Promise<void> {
  if (a.kind === 'pass') throw new Error('no pass in missions');
  if (a.kind === 'deploy') await page.locator('[data-testid="reserve-0"]').first().click();
  else {
    const from = s.spies.find((x) => x.id === a.spyId)!.pos!;
    await tapCell(page, info, from.r, from.c);
  }
  await tapCell(page, info, a.to.r, a.to.c);
  if (info.project.use.hasTouch) await tapCell(page, info, a.to.r, a.to.c);
  await idle(page);
}

/** Open a mission by URL (default `mission=<id>`; the daily one needs `mission=daily&day=...`) and start it. */
export async function openMission(
  page: Page,
  m: Mission,
  query = `mission=${m.id}`,
): Promise<void> {
  await page.goto(`/?test=1&speed=0&${query}`);
  await page.evaluate(() => (window as any).__AVA__.ready);
  await expect(page.locator('#briefing')).toBeVisible();
  await expect(page.locator('[data-testid="briefing-goal"]')).toHaveText(goalText(m));
  await page.click('#btn-briefing-go');
  await expect(page.locator('#briefing')).toHaveCount(0);
}

/** Solve a mission move by move against the in-browser defender. */
export async function solve(page: Page, info: TestInfo, m: Mission): Promise<void> {
  const start = decode(m.state);
  const solver = new Solver(start, m.goal);
  for (let left = m.moves; left > 0; left--) {
    const s = await ava(page);
    expect(s.current).toBe(0);
    const pill = page.locator('#mission-pill');
    await expect(pill).toHaveText(pillText(m, left));
    const [a] = solver.solutions(s, left);
    expect(a, `no forced line left in ${m.id}`).toBeTruthy();
    await play(page, info, s, a!);
    if (await page.locator('#mission-result').count()) break;
  }
  await expect(page.locator('#mission-result .stamp')).toHaveText('MISSION COMPLETE');
  await expect(page.locator('#mission-pill')).toHaveCount(0);
}
