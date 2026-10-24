import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { missionById } from '../src/missions';
import { open, shot, tapCell, trackErrors } from './helpers';
import { openMission, solve } from './missionHelpers';

const idle = (page: Page) => page.evaluate(() => (window as any).__AVA__.idle());
const KEY = 'ava.record.v1';

async function move(page: Page, info: TestInfo, from: [number, number], to: [number, number]) {
  await tapCell(page, info, from[0], from[1]);
  await tapCell(page, info, to[0], to[1]);
  if (info.project.use.hasTouch) await tapCell(page, info, to[0], to[1]);
  await idle(page);
}

// Red carrier one step from home on 2 points: banking wins the game.
const WIN_NOW = (p1: string) => `p0=human&p1=${p1}&state=v1.0.0.2-0.41*,21,02,04.33`;

async function winAGame(page: Page, info: TestInfo, p1: string): Promise<void> {
  await open(page, WIN_NOW(p1));
  await move(page, info, [4, 1], [5, 1]);
  await expect(page.locator('#game-over')).toBeVisible();
}

test('a win against a bot is counted, shown on the card, and stacks across games', async ({
  page,
}, info) => {
  const errors = trackErrors(page);
  await winAGame(page, info, 'bot:hard');
  await expect(page.locator('#game-over .stamp')).toHaveText('MISSION COMPLETE');
  await expect(page.locator('[data-testid="record"]')).toHaveText(
    'Record vs Hard: 1 win · 0 losses',
  );
  await shot(page, info, 'game-over-record');
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe(
    JSON.stringify({ hard: { w: 1, l: 0, d: 0 } }),
  );
  // The next win stacks on the stored tally, and other levels keep their own.
  await winAGame(page, info, 'bot:hard');
  await expect(page.locator('[data-testid="record"]')).toHaveText(
    'Record vs Hard: 2 wins · 0 losses',
  );
  await winAGame(page, info, 'bot:easy');
  await expect(page.locator('[data-testid="record"]')).toHaveText(
    'Record vs Easy: 1 win · 0 losses',
  );
  expect(errors).toEqual([]);
});

test('a loss counts against the human, whichever seat they play', async ({ page }, info) => {
  await page.addInitScript((k) => {
    try {
      localStorage.setItem(k, JSON.stringify({ hard: { w: 4, l: 2, d: 0 } }));
    } catch {
      /* ignore */
    }
  }, KEY);
  // Bot Red (p0) to move with a winning bank; the human watches as Teal and loses.
  await open(page, 'p0=bot:hard&p1=human&state=v1.0.0.2-0.41*,21,02,04.33&seed=3');
  await expect(page.locator('#game-over')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#game-over .stamp')).toHaveText('MISSION FAILED');
  await expect(page.locator('[data-testid="record"]')).toHaveText(
    'Record vs Hard: 4 wins · 3 losses',
  );
  void info;
});

test('hot-seat, bot-vs-bot and missions leave the record untouched', async ({ page }, info) => {
  // Hot-seat game won in one move.
  await open(page, 'p0=human&p1=human&state=v1.0.0.2-0.41*,21,02,04.33');
  await move(page, info, [4, 1], [5, 1]);
  await expect(page.locator('#game-over')).toBeVisible();
  await expect(page.locator('[data-testid="record"]')).toHaveCount(0);
  // A whole bot-vs-bot game.
  await open(page, 'p0=bot:medium&p1=bot:easy&seed=5');
  await page.waitForFunction(() => (window as any).__AVA__.getState().winner !== null, undefined, {
    timeout: 90_000,
  });
  await expect(page.locator('#game-over')).toBeVisible();
  await expect(page.locator('[data-testid="record"]')).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull();
});

test('winning the game inside a mission is not a record win', async ({ page }, info) => {
  const m = missionById('match-point')!; // "Win the game in 1 move"
  await openMission(page, m);
  await solve(page, info, m);
  await expect(page.locator('#game-over')).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull();
});

test('a broken stored record is ignored and replaced', async ({ page }, info) => {
  await page.addInitScript((k) => {
    try {
      localStorage.setItem(k, '{{{not json');
    } catch {
      /* ignore */
    }
  }, KEY);
  await winAGame(page, info, 'bot:medium');
  await expect(page.locator('[data-testid="record"]')).toHaveText(
    'Record vs Medium: 1 win · 0 losses',
  );
});

test('the game-over card with a record line still fits phones and landscape', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'viewport sweep runs once');
  for (const [w, h] of [
    [320, 568],
    [360, 640],
    [667, 375],
    [844, 390],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await winAGame(page, info, 'bot:hard');
    const card = page.locator('#game-over .card');
    const cb = (await card.boundingBox())!;
    expect(cb.y, `card top cut off at ${w}x${h}`).toBeGreaterThanOrEqual(0);
    expect(cb.y + cb.height, `card bottom cut off at ${w}x${h}`).toBeLessThanOrEqual(h);
    expect(cb.x).toBeGreaterThanOrEqual(0);
    expect(cb.x + cb.width).toBeLessThanOrEqual(w);
    await page.screenshot({ path: `artifacts/screens/game-over-record-${w}x${h}.png` });
  }
});
