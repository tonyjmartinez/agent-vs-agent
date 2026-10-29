import { test, expect, type Page } from '@playwright/test';
import { Solver, goalMet } from '../src/ai/solve';
import { dailyMission, dayKey } from '../src/daily';
import { DAILY_POOL } from '../src/dailyPool';
import { legalActions } from '../src/engine/engine';
import { decode } from '../src/engine/serialize';
import { MISSIONS, goalText } from '../src/missions';
import { shot, trackErrors } from './helpers';
import { ava, openMission, play, same, solve } from './missionHelpers';

const url = (day: string) => `mission=daily&day=${day}`;
const nextDay = (d: string) => dayKey(new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000));

/** Open the missions list as if today were `day`. */
async function list(page: Page, day: string): Promise<void> {
  await page.goto(`/?test=1&speed=0&day=${day}`);
  await page.evaluate(() => (window as any).__AVA__.ready);
  await page.click('#btn-missions');
  await expect(page.locator('#missions')).toBeVisible();
}

const streakText = (page: Page) => page.locator('[data-testid="daily-streak"]');
const dailyBtn = (page: Page) => page.locator('[data-testid="daily-btn"]');

test('the daily mission opens from a link, solves through real input, and is credited as a day', async ({
  page,
}, info) => {
  const errors = trackErrors(page);
  const day = '2026-03-10';
  const m = dailyMission(day);
  await page.goto(`/?test=1&speed=0&${url(day)}`);
  await page.evaluate(() => (window as any).__AVA__.ready);
  await expect(page.locator('#briefing .menu-label')).toHaveText('Daily mission');
  await expect(page.locator('#briefing .stamp')).toHaveText(`DAILY ${day}`);
  await expect(page.locator('[data-testid="briefing-goal"]')).toHaveText(goalText(m));
  await shot(page, info, 'daily-briefing');
  await page.click('#btn-briefing-go');
  expect(await page.evaluate(() => (window as any).__AVA__.encode())).toBe(m.state);
  await solve(page, info, m);
  // A daily has no "next mission".
  await expect(page.locator('#btn-mission-next')).toHaveCount(0);
  await expect(page.locator('#btn-mission-retry')).toBeVisible();
  // The win card says the daily is done and what the streak now is.
  await expect(page.locator('#mission-result p.sub:not(.share-note)')).toContainText(
    'Daily streak: 1 day.',
  );
  await shot(page, info, 'daily-result');

  await page.click('#btn-mission-list');
  await expect(dailyBtn(page)).toHaveClass(/done/);
  await expect(dailyBtn(page)).toContainText(day);
  await expect(streakText(page)).toHaveText('Streak: 1 day');
  // Progress through the curated missions is untouched.
  await expect(page.locator('[data-testid="missions-progress"]')).toHaveText(
    `0 of ${MISSIONS.length} complete`,
  );
  await shot(page, info, 'daily-list-done');
  expect(errors).toEqual([]);
});

test('the list shows today’s daily, and tapping it starts that date’s puzzle', async ({
  page,
}, info) => {
  const day = '2026-05-02';
  await list(page, day);
  await expect(dailyBtn(page)).not.toHaveClass(/done/);
  await expect(dailyBtn(page)).toContainText(goalText(dailyMission(day)));
  await expect(streakText(page)).toHaveText('Streak: 0 days');
  await shot(page, info, 'daily-list');
  await dailyBtn(page).click();
  await expect(page.locator('#briefing .stamp')).toHaveText(`DAILY ${day}`);
  await page.click('#btn-briefing-go');
  expect(await page.evaluate(() => (window as any).__AVA__.encode())).toBe(dailyMission(day).state);
});

test('streak: counts consecutive days, survives the morning after, and resets after a gap', async ({
  page,
}, info) => {
  test.setTimeout(150_000);
  const d1 = '2026-03-10';
  const d2 = nextDay(d1);
  const d4 = nextDay(nextDay(d2)); // skips a day
  // Day 1: solve.
  await openMission(page, dailyMission(d1), url(d1));
  await solve(page, info, dailyMission(d1));
  // Day 2, before playing: yesterday counts, so the streak still reads 1.
  await list(page, d2);
  await expect(streakText(page)).toHaveText('Streak: 1 day');
  await expect(dailyBtn(page)).not.toHaveClass(/done/);
  // Day 2: solve → 2.
  await dailyBtn(page).click();
  await page.click('#btn-briefing-go');
  await solve(page, info, dailyMission(d2));
  await page.click('#btn-mission-list');
  await expect(streakText(page)).toHaveText('Streak: 2 days');
  await expect(dailyBtn(page)).toHaveClass(/done/);
  // Day 4 (day 3 missed): the streak is gone until today is solved.
  await list(page, d4);
  await expect(streakText(page)).toHaveText('Streak: 0 days');
  await expect(dailyBtn(page)).not.toHaveClass(/done/);
  await dailyBtn(page).click();
  await page.click('#btn-briefing-go');
  await solve(page, info, dailyMission(d4));
  await page.click('#btn-mission-list');
  await expect(streakText(page)).toHaveText('Streak: 1 day');
  // Going back to day 2 still shows that day as done, with its own streak of 2.
  await list(page, d2);
  await expect(streakText(page)).toHaveText('Streak: 2 days');
  await expect(dailyBtn(page)).toHaveClass(/done/);
});

test('failing the daily, then watching the solution, credits nothing; a real solve afterwards does', async ({
  page,
}, info) => {
  const day = '2026-07-04';
  const m = dailyMission(day);
  await openMission(page, m, url(day));
  const start = decode(m.state);
  const solver = new Solver(start, m.goal);
  const sols = solver.solutions(start, m.moves);
  const wrong = legalActions(start).find(
    (a) => a.kind === 'move' && !sols.some((x) => same(x, a)),
  )!;
  await play(page, info, await ava(page), wrong);
  // A wrong first move: burn the rest of the budget on any legal move.
  while (!(await page.locator('#mission-result').count())) {
    const s = await ava(page);
    await play(
      page,
      info,
      s,
      legalActions(s).find((a) => a.kind === 'move')!,
    );
  }
  await expect(page.locator('#mission-result .stamp')).toHaveText('MISSION FAILED');
  await page.click('#btn-mission-solution');
  await expect(page.locator('#mission-result .stamp')).toHaveText('SOLUTION');
  expect(goalMet(start, await ava(page), m.goal, 0)).toBe(true);
  await page.click('#btn-mission-list');
  await expect(dailyBtn(page)).not.toHaveClass(/done/);
  await expect(streakText(page)).toHaveText('Streak: 0 days');

  await openMission(page, m, url(day));
  await solve(page, info, m);
  await page.click('#btn-mission-list');
  await expect(dailyBtn(page)).toHaveClass(/done/);
  await expect(streakText(page)).toHaveText('Streak: 1 day');
});

test('a missed daily names the daily and says what to do next, at 360px', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const day = '2026-07-05';
  const m = dailyMission(day);
  await openMission(page, m, url(day));
  const start = decode(m.state);
  const solver = new Solver(start, m.goal);
  const sols = solver.solutions(start, m.moves);
  const wrong = legalActions(start).find(
    (a) => a.kind === 'move' && !sols.some((x) => same(x, a)),
  )!;
  await play(page, info, await ava(page), wrong);
  while (!(await page.locator('#mission-result').count())) {
    const s = await ava(page);
    await play(
      page,
      info,
      s,
      legalActions(s).find((a) => a.kind === 'move')!,
    );
  }
  await expect(page.locator('#mission-result .stamp')).toHaveText('MISSION FAILED');
  const sub = page.locator('#mission-result p.sub:not(.share-note)');
  await expect(sub).toContainText(
    'Daily missed. Retry it now, or come back tomorrow for a new puzzle.',
  );
  await expect(sub).not.toContainText('Teal found the answer');
  const box = (await page.locator('#mission-result .card').boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  await shot(page, info, 'daily-missed');
});

test('different dates give different puzzles; the same date gives the same one every time', async ({
  page,
}) => {
  const encodes: string[] = [];
  for (const day of ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-01']) {
    await openMission(page, dailyMission(day), url(day));
    encodes.push(await page.evaluate(() => (window as any).__AVA__.encode()));
    expect(encodes.at(-1)).toBe(dailyMission(day).state);
  }
  expect(new Set(encodes.slice(0, 3)).size).toBe(3);
  expect(encodes[3]).toBe(encodes[0]);
});

test('an invalid ?day= is ignored and falls back to the real date', async ({ page }) => {
  await page.goto('/?test=1&speed=0&mission=daily&day=2026-02-30');
  await page.evaluate(() => (window as any).__AVA__.ready);
  await expect(page.locator('#briefing .menu-label')).toHaveText('Daily mission');
  const title = await page.locator('#briefing .stamp').innerText();
  expect(title).toMatch(/^DAILY \d{4}-\d{2}-\d{2}$/);
  expect(title).not.toContain('2026-02-30');
  expect(title).toBe(`DAILY ${dayKey(new Date())}`);
});

test('every pool puzzle plays out in the browser: 52 consecutive days of ?solution=1 reach their goal', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'full sweep runs once');
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  let day = '2026-01-01';
  const seen = new Set<string>();
  for (let i = 0; i < DAILY_POOL.length; i++) {
    const m = dailyMission(day);
    await page.goto(`/?test=1&speed=0&${url(day)}&solution=1`);
    await page.evaluate(() => (window as any).__AVA__.ready);
    await expect(page.locator('#mission-result .stamp')).toHaveText('SOLUTION');
    const start = decode(m.state);
    expect(goalMet(start, await ava(page), m.goal, 0), `${day} did not reach its goal`).toBe(true);
    seen.add(m.state);
    day = nextDay(day);
  }
  expect(seen.size).toBe(DAILY_POOL.length);
  expect(errors).toEqual([]);
});

test('the daily card and list fit small phones and landscape', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'viewport sweep runs once');
  for (const [w, h] of [
    [320, 568],
    [360, 640],
    [667, 375],
    [1024, 768],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await list(page, '2026-05-02');
    const b = (await dailyBtn(page).boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(w);
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await dailyBtn(page).click();
    await expect(page.locator('#briefing .stamp')).toHaveText('DAILY 2026-05-02');
    // The date never wraps at its hyphens (a wrapped inline element has more than one client rect).
    expect(
      await page.locator('#briefing .stamp .nowrap').evaluate((el) => el.getClientRects().length),
      `date wraps at ${w}x${h}`,
    ).toBe(1);
    const stamp = (await page.locator('#briefing .stamp').boundingBox())!;
    expect(stamp.x).toBeGreaterThanOrEqual(0);
    expect(stamp.x + stamp.width).toBeLessThanOrEqual(w);
    await page.screenshot({ path: `artifacts/screens/daily-briefing-${w}x${h}.png` });
  }
});
