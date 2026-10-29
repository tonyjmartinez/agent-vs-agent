import { test, expect } from '@playwright/test';
import { Solver, goalMet } from '../src/ai/solve';
import { legalActions } from '../src/engine/engine';
import { decode } from '../src/engine/serialize';
import { MISSIONS, missionById, pillText } from '../src/missions';
import { shot, tapCell, trackErrors } from './helpers';
import { ava, openMission, play, same, solve } from './missionHelpers';

test('every mission can be completed through real input against the defender', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'full sweep on desktop; touch covered below');
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  for (const m of MISSIONS) {
    await openMission(page, m);
    await solve(page, info, m);
  }
  // Progress survives a reload.
  await page.goto('/?test=1&speed=0');
  await page.evaluate(() => (window as any).__AVA__.ready);
  await page.click('#btn-missions');
  await expect(page.locator('[data-testid="missions-progress"]')).toHaveText(
    `All ${MISSIONS.length} missions complete. Nice work.`,
  );
  await expect(page.locator('.mission-btn.done')).toHaveCount(MISSIONS.length);
  expect(errors).toEqual([]);
});

test('menu → missions → first mission by touch/click, ticked afterwards', async ({
  page,
}, info) => {
  const errors = trackErrors(page);
  await page.goto('/?test=1&speed=0');
  await page.evaluate(() => (window as any).__AVA__.ready);
  await page.click('#btn-missions');
  await expect(page.locator('#missions')).toBeVisible();
  await expect(page.locator('[data-testid="missions-progress"]')).toHaveText(
    `0 of ${MISSIONS.length} complete`,
  );
  await expect(page.locator('.mission-btn')).toHaveCount(MISSIONS.length);
  await shot(page, info, 'missions-list');
  const m = MISSIONS[0]!;
  await page.click(`[data-mission="${m.id}"]`);
  await expect(page.locator('#briefing')).toBeVisible();
  await shot(page, info, 'mission-briefing');
  await page.click('#btn-briefing-go');
  await shot(page, info, 'mission-play');
  // The goal pill must never cover the board.
  const pill = (await page.locator('#mission-pill').boundingBox())!;
  const board = (await page.locator('#board canvas').boundingBox())!;
  expect(
    pill.y + pill.height <= board.y ||
      pill.y >= board.y + board.height ||
      pill.x + pill.width <= board.x ||
      pill.x >= board.x + board.width,
  ).toBe(true);
  expect(pill.x).toBeGreaterThanOrEqual(0);
  expect(pill.x + pill.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await solve(page, info, m);
  await shot(page, info, 'mission-complete');
  await page.click('#btn-mission-list');
  await expect(page.locator(`[data-mission="${m.id}"]`)).toHaveClass(/done/);
  await expect(page.locator('[data-testid="missions-progress"]')).toHaveText(
    `1 of ${MISSIONS.length} complete`,
  );
  await page.click('#btn-missions-back');
  await expect(page.locator('#menu')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a two-move mission works by touch/click; Next opens the following mission', async ({
  page,
}, info) => {
  const m = missionById('double-tap')!;
  await openMission(page, m);
  await solve(page, info, m);
  await page.click('#btn-mission-next');
  const next = MISSIONS[MISSIONS.indexOf(m) + 1]!;
  await expect(page.locator('#briefing .stamp')).toHaveText(next.title.toUpperCase());
});

test('a wrong move is refuted: mission failed, Retry resets the position', async ({
  page,
}, info) => {
  const m = missionById('grab-and-go')!;
  await openMission(page, m);
  const start = decode(m.state);
  const solver = new Solver(start, m.goal);
  const sols = solver.solutions(start, m.moves);
  const wrong = legalActions(start).find(
    (a) => a.kind === 'move' && !sols.some((x) => same(x, a)),
  )!;
  await play(page, info, await ava(page), wrong);
  // The defender has answered; Red's last move cannot succeed any more.
  const s = await ava(page);
  expect(s.ply).toBe(start.ply + 2);
  expect(solver.canForce(s, 1)).toBe(false);
  await expect(page.locator('#mission-pill')).toHaveText(pillText(m, 1));
  const any = legalActions(s).find((a) => a.kind === 'move')!;
  await play(page, info, s, any);
  await expect(page.locator('#mission-result .stamp')).toHaveText('MISSION FAILED');
  await expect(page.locator('#btn-mission-next')).toHaveCount(0);
  // A decided mission shows no active turn behind the card.
  await expect(page.locator('.panel.active')).toHaveCount(0);
  await expect(page.locator('.panel .status')).toHaveText(['', '']);
  await shot(page, info, 'mission-failed');
  // The board is frozen behind the result card.
  expect((await ava(page)).ply).toBe(start.ply + 3);
  await page.click('#btn-mission-retry');
  await page.click('#btn-briefing-go');
  expect(await page.evaluate(() => (window as any).__AVA__.encode())).toBe(m.state);
  await expect(page.locator('#mission-pill')).toHaveText(pillText(m, 2));
});

test('pause → Restart restarts the mission; Quit leaves mission mode', async ({ page }, info) => {
  const m = missionById('side-step')!;
  await openMission(page, m);
  const start = decode(m.state);
  const [a] = new Solver(start, m.goal).solutions(start, m.moves);
  await play(page, info, start, a!);
  expect((await ava(page)).ply).toBe(start.ply + 2);
  await page.click('#btn-menu');
  await page.click('#btn-restart');
  await page.click('#btn-briefing-go');
  expect(await page.evaluate(() => (window as any).__AVA__.encode())).toBe(m.state);
  await page.click('#btn-menu');
  await page.click('#btn-quit');
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('#mission-pill')).toHaveCount(0);
});

test('an unknown ?mission id falls back to a normal game', async ({ page }) => {
  await page.goto('/?test=1&speed=0&mission=nope');
  await page.evaluate(() => (window as any).__AVA__.ready);
  await expect(page.locator('#briefing')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__AVA__.encode())).toBe(
    'v1.0.0.0-0.51,54,01,04.2233',
  );
});

test('the goal pill stays clear of the board at phone, landscape and tablet sizes', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'viewport sweep runs once');
  const m = missionById('double-tap')!;
  for (const [w, h] of [
    [320, 568],
    [360, 640],
    [390, 844],
    [667, 375],
    [844, 390],
    [1024, 768],
    [1440, 900],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await openMission(page, m);
    await page.evaluate(() => (window as any).__AVA__.controller().refresh());
    // Web fonts change how the pill wraps; measure the settled layout, not the fallback-font one.
    await page.evaluate(() => document.fonts.ready);
    const pill = (await page.locator('#mission-pill').boundingBox())!;
    const board = (await page.locator('#board canvas').boundingBox())!;
    const clear =
      pill.y + pill.height <= board.y + 1 ||
      pill.y >= board.y + board.height - 1 ||
      pill.x + pill.width <= board.x + 1 ||
      pill.x >= board.x + board.width - 1;
    expect(clear, `pill overlaps board at ${w}x${h}`).toBe(true);
    // ...and it never covers a player panel or a control button either.
    for (const other of await page.locator('.panel, .controls .btn').all()) {
      const o = (await other.boundingBox())!;
      const apart =
        pill.y + pill.height <= o.y + 1 ||
        pill.y >= o.y + o.height - 1 ||
        pill.x + pill.width <= o.x + 1 ||
        pill.x >= o.x + o.width - 1;
      expect(apart, `pill overlaps ${await other.evaluate((e) => e.className)} at ${w}x${h}`).toBe(
        true,
      );
    }
    expect(pill.x).toBeGreaterThanOrEqual(0);
    expect(pill.x + pill.width).toBeLessThanOrEqual(w);
    await page.screenshot({ path: `artifacts/screens/mission-pill-${w}x${h}.png` });
  }
});

test('?solution=1 replays every forced line to its goal, never crediting the mission', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'full sweep runs once');
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  for (const m of MISSIONS) {
    await page.goto(`/?test=1&speed=0&mission=${m.id}&solution=1`);
    await page.evaluate(() => (window as any).__AVA__.ready);
    await expect(page.locator('#briefing')).toHaveCount(0);
    await expect(page.locator('#mission-result .stamp')).toHaveText('SOLUTION');
    await expect(page.locator('#mission-pill')).toHaveCount(0);
    await expect(page.locator('#btn-mission-solution')).toHaveCount(0);
    await expect(page.locator('#btn-mission-next')).toHaveCount(0);
    const start = decode(m.state);
    const end = await ava(page);
    expect(goalMet(start, end, m.goal, 0), `${m.id} did not reach its goal`).toBe(true);
    // The replayed defender may not put up its best fight, so the goal can land before the budget runs out.
    const plies = end.ply - start.ply;
    expect(plies % 2, `${m.id} ends right after a Red move`).toBe(1);
    expect(plies, `${m.id} ply count`).toBeLessThanOrEqual(2 * m.moves - 1);
    if (m.moves === 1) expect(plies).toBe(1);
  }
  // None of that counted as progress.
  await page.goto('/?test=1&speed=0');
  await page.evaluate(() => (window as any).__AVA__.ready);
  await page.click('#btn-missions');
  await expect(page.locator('[data-testid="missions-progress"]')).toHaveText(
    `0 of ${MISSIONS.length} complete`,
  );
  expect(errors).toEqual([]);
});

test('failed → Show solution → Retry → solve it yourself: only the real solve is credited', async ({
  page,
}, info) => {
  const m = missionById('grab-and-go')!;
  await openMission(page, m);
  const start = decode(m.state);
  const solver = new Solver(start, m.goal);
  const sols = solver.solutions(start, m.moves);
  const wrong = legalActions(start).find(
    (a) => a.kind === 'move' && !sols.some((x) => same(x, a)),
  )!;
  await play(page, info, await ava(page), wrong);
  await play(
    page,
    info,
    await ava(page),
    legalActions(await ava(page)).find((a) => a.kind === 'move')!,
  );
  await expect(page.locator('#mission-result .stamp')).toHaveText('MISSION FAILED');
  await expect(page.locator('#btn-mission-solution')).toBeVisible();
  await shot(page, info, 'mission-failed-solution-btn');

  await page.click('#btn-mission-solution');
  await expect(page.locator('#mission-result .stamp')).toHaveText('SOLUTION');
  await expect(page.locator('.panel.active')).toHaveCount(0);
  await shot(page, info, 'mission-solution');
  expect(goalMet(start, await ava(page), m.goal, 0)).toBe(true);
  await expect(page.locator('#btn-mission-next')).toHaveCount(0);
  await expect(page.locator('#btn-mission-solution')).toHaveCount(0);

  // The replay is not credited.
  await page.click('#btn-mission-list');
  await expect(page.locator('[data-testid="missions-progress"]')).toHaveText(
    `0 of ${MISSIONS.length} complete`,
  );
  await page.click(`[data-mission="${m.id}"]`);
  await page.click('#btn-briefing-go');
  expect(await page.evaluate(() => (window as any).__AVA__.encode())).toBe(m.state);
  await solve(page, info, m);
  await page.click('#btn-mission-list');
  await expect(page.locator('[data-testid="missions-progress"]')).toHaveText(
    `1 of ${MISSIONS.length} complete`,
  );
});

test('while a solution plays the board is locked, with a watching pill', async ({ page }, info) => {
  const m = missionById('double-tap')!;
  await page.goto(`/?test=1&speed=1&mission=${m.id}&solution=1`);
  await page.evaluate(() => (window as any).__AVA__.ready);
  await expect(page.locator('#mission-pill')).toHaveText('Solution · watch the line');
  const start = decode(m.state);
  // Poke the board mid-replay: nothing may be selected, and the replay still ends on the goal.
  const from = start.spies.find((x) => x.owner === 0 && x.pos)!.pos!;
  await tapCell(page, info, from.r, from.c);
  const sel = await page.evaluate(() => (window as any).__AVA__.controller().sel);
  expect(sel.selected).toBeNull();
  await expect(page.locator('#mission-result .stamp')).toHaveText('SOLUTION', { timeout: 15_000 });
  expect(goalMet(start, await ava(page), m.goal, 0)).toBe(true);
});

test('?solution=1 without a mission is ignored', async ({ page }) => {
  await page.goto('/?test=1&speed=0&solution=1');
  await page.evaluate(() => (window as any).__AVA__.ready);
  await expect(page.locator('#mission-result')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__AVA__.encode())).toBe(
    'v1.0.0.0-0.51,54,01,04.2233',
  );
});
