import { test, expect, type Page, type TestInfo } from '@playwright/test';
import type { MatchStats } from '../src/engine/stats';
import { open, shot, tapCell, trackErrors } from './helpers';

const touch = (info: TestInfo) => !!info.project.use.hasTouch;
const idle = (page: Page) => page.evaluate(() => (window as any).__AVA__.idle());
const stats = (page: Page) =>
  page.evaluate(() => (window as any).__AVA__.controller().stats as MatchStats);

/** Select + (preview on touch) + commit through real pointer input. */
async function move(page: Page, info: TestInfo, from: [number, number], to: [number, number]) {
  await tapCell(page, info, from[0], from[1]);
  await tapCell(page, info, to[0], to[1]);
  if (touch(info)) await tapCell(page, info, to[0], to[1]);
  await idle(page);
}

/**
 * The real Undo button's handler (it also dismisses the game-over card). A programmatic click, because while
 * the card is up it visually covers the button; calling controller.undo() directly would skip that handler.
 */
const pressUndo = (page: Page) =>
  page.evaluate(() => (document.getElementById('btn-undo') as HTMLButtonElement).click());

const cell = (page: Page, key: string, p: number) =>
  page.locator(`[data-testid="stat-${key}-${p}"]`);

// Red carrier one step from home on 2 points; Red's other spy can burn Teal's edge spy at (0,2).
const BURN_THEN_BANK = 'p0=human&p1=human&state=v1.0.0.2-0.41*,21,02,04.33';

test('the game-over card shows exact match stats from a burn then a winning bank', async ({
  page,
}, info) => {
  const errors = trackErrors(page);
  await open(page, BURN_THEN_BANK);
  await move(page, info, [2, 1], [1, 2]); // Red burns Teal's (0,2) spy
  expect((await stats(page))[0]).toMatchObject({ turns: 1, burns: 1 });
  await move(page, info, [0, 4], [1, 4]); // Teal does something else
  await move(page, info, [4, 1], [5, 1]); // Red banks the winning point
  await expect(page.locator('#game-over')).toBeVisible();
  await expect(page.locator('#game-over .stamp')).toHaveText('AGENT RED WINS');

  // Red: 2 turns, 1 burn, 0 lost, 0 steals, 1 banked. Teal: 1 turn, 0 burns, 1 lost, 0 steals, 0 banked.
  const want = {
    turns: [2, 1],
    burns: [1, 0],
    steals: [0, 0],
    extractions: [1, 0],
  } as const;
  for (const [key, vals] of Object.entries(want)) {
    for (const p of [0, 1]) await expect(cell(page, key, p)).toHaveText(String(vals[p]));
  }
  // The leader of each row with a strict leader is highlighted; tied rows are not.
  await expect(cell(page, 'turns', 0)).toHaveClass(/lead/);
  await expect(cell(page, 'turns', 1)).not.toHaveClass(/lead/);
  await expect(cell(page, 'burns', 0)).toHaveClass(/lead/);
  await expect(cell(page, 'steals', 0)).not.toHaveClass(/lead/); // 0 vs 0: nobody leads
  await expect(page.locator('[data-testid="stats"] caption')).toHaveText('Match stats');
  await shot(page, info, 'game-over-stats');
  expect(await stats(page)).toEqual([
    { turns: 2, burns: 1, burned: 0, steals: 0, extractions: 1 },
    { turns: 1, burns: 0, burned: 1, steals: 0, extractions: 0 },
  ]);
  expect(errors).toEqual([]);
});

test('undo rewinds the stats with the game, and a rematch starts from zero', async ({
  page,
}, info) => {
  await open(page, BURN_THEN_BANK);
  const zero = await stats(page);
  await move(page, info, [2, 1], [1, 2]);
  const afterBurn = await stats(page);
  expect(afterBurn[0]!.burns).toBe(1);
  await move(page, info, [0, 4], [1, 4]);
  await move(page, info, [4, 1], [5, 1]);
  await expect(page.locator('#game-over')).toBeVisible();
  expect((await stats(page))[0]!.extractions).toBe(1);

  // Undo rewinds to Red's previous turn (before the winning move): stats go with it.
  await pressUndo(page);
  expect(await page.evaluate(() => (window as any).__AVA__.getState().winner)).toBeNull();
  expect((await stats(page))[0]!.extractions).toBe(0);
  expect(await stats(page)).toEqual(
    await page.evaluate(() => (window as any).__AVA__.controller().statsLog.at(-1)),
  );
  // Hotseat undo rewinds one ply at a time: back before Teal's move, the stats are exactly "after Red's burn"...
  await pressUndo(page);
  expect(await stats(page)).toEqual(afterBurn);
  // ...and one more undo is back at the very start.
  await pressUndo(page);
  expect(await stats(page)).toEqual(zero);
  // The log and history always stay index-aligned.
  expect(
    await page.evaluate(() => {
      const c = (window as any).__AVA__.controller();
      return c.statsLog.length === c.history.length;
    }),
  ).toBe(true);

  // Replay to the end, then rematch: fresh zeroes.
  await move(page, info, [2, 1], [1, 2]);
  await move(page, info, [0, 4], [1, 4]);
  await move(page, info, [4, 1], [5, 1]);
  await expect(page.locator('#game-over')).toBeVisible();
  await page.click('#btn-rematch');
  expect(await stats(page)).toEqual(zero.map(() => ({ ...zero[0]! })));
});

test('vs the agent: stats stay consistent with the final score over a whole bot game', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await open(page, 'p0=bot:medium&p1=bot:easy&seed=5');
  await page.waitForFunction(() => (window as any).__AVA__.getState().winner !== null, undefined, {
    timeout: 90_000,
  });
  await expect(page.locator('#game-over')).toBeVisible();
  const s = await page.evaluate(() => (window as any).__AVA__.getState());
  const st = await stats(page);
  expect(st.reduce((n, p) => n + p.turns, 0)).toBe(s.ply);
  st.forEach((p, i) => expect(p.extractions).toBe(s.scores[i]));
  for (const [key, p] of [
    ['turns', 0],
    ['turns', 1],
    ['burns', 0],
    ['burns', 1],
    ['steals', 0],
    ['steals', 1],
    ['extractions', 0],
    ['extractions', 1],
  ] as const) {
    await expect(cell(page, key, p)).toHaveText(String(st[p]![key]));
  }
});

test('the stats card fits the viewport at phone, landscape and tablet sizes', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'viewport sweep runs once');
  for (const [w, h] of [
    [320, 568],
    [360, 640],
    [390, 844],
    [667, 375],
    [844, 390],
    [1024, 768],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await open(page, BURN_THEN_BANK);
    await move(page, info, [2, 1], [1, 2]);
    await move(page, info, [0, 4], [1, 4]);
    await move(page, info, [4, 1], [5, 1]);
    const card = page.locator('#game-over .card');
    await expect(card).toBeVisible();
    // Buttons must stay reachable: either the whole card fits, or it scrolls and the buttons are on screen.
    await page.locator('#btn-rematch').scrollIntoViewIfNeeded();
    const b = (await page.locator('#btn-rematch').boundingBox())!;
    expect(b.y + b.height, `rematch below the fold at ${w}x${h}`).toBeLessThanOrEqual(h);
    expect(b.height).toBeGreaterThanOrEqual(44);
    const t = (await page.locator('[data-testid="stats"]').boundingBox())!;
    expect(t.x).toBeGreaterThanOrEqual(0);
    expect(t.x + t.width).toBeLessThanOrEqual(w);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `horizontal scroll at ${w}x${h}`,
    ).toBe(true);
    await page.screenshot({ path: `artifacts/screens/game-over-stats-${w}x${h}.png` });
  }
});
