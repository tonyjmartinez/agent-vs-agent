import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { Solver } from '../src/ai/solve';
import { legalActions } from '../src/engine/engine';
import { decode } from '../src/engine/serialize';
import type { GameState } from '../src/engine/types';
import { hintSelection } from '../src/hint';
import { MISSIONS, missionById, pillText } from '../src/missions';
import { shot, tapCell, trackErrors } from './helpers';
import { ava, idle, openMission, play, same } from './missionHelpers';

const sel = (page: Page) =>
  page.evaluate(() => (window as any).__AVA__.controller().sel.selected as string | null);
const pill = (page: Page) => page.locator('#mission-pill');

/** After the hint has selected a piece, tap only the destination (a second tap confirms on touch). */
async function tapTo(page: Page, info: TestInfo, r: number, c: number): Promise<void> {
  await tapCell(page, info, r, c);
  if (info.project.use.hasTouch) await tapCell(page, info, r, c);
  await idle(page);
}

test('every mission can be solved by following the hint alone', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'full sweep on desktop; touch covered below');
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  for (const m of MISSIONS) {
    await openMission(page, m);
    const start = decode(m.state);
    const solver = new Solver(start, m.goal);
    expect(await sel(page), 'nothing selected before asking').toBeNull();
    for (let made = 0; made < m.moves; made++) {
      if (await page.locator('#mission-result').count()) break;
      const s = await ava(page);
      const left = m.moves - made;
      await pill(page).click();
      const want = hintSelection(solver, s, left);
      expect(await sel(page), `${m.id} hint #${made + 1}`).toBe(want);
      // The hint names a piece, it does not commit anything.
      expect((await ava(page)).ply).toBe(s.ply);
      const a = solver
        .solutions(s, left)
        .find((x) =>
          want === 'reserve' ? x.kind === 'deploy' : x.kind === 'move' && x.spyId === want,
        )!;
      await tapTo(
        page,
        info,
        (a as { to: { r: number; c: number } }).to.r,
        (a as { to: { r: number; c: number } }).to.c,
      );
    }
    await expect(page.locator('#mission-result .stamp'), `${m.id} solved by hints`).toHaveText(
      'MISSION COMPLETE',
    );
  }
  expect(errors).toEqual([]);
});

test('the pill is a real button that selects the right piece; asking twice is harmless', async ({
  page,
}, info) => {
  const m = missionById('double-tap')!;
  await openMission(page, m);
  const start = decode(m.state);
  await expect(pill(page)).toHaveText(pillText(m, 2));
  expect(await pill(page).evaluate((e) => e.tagName)).toBe('BUTTON');
  await expect(pill(page)).toBeEnabled();
  const h = (await pill(page).boundingBox())!;
  expect(h.height).toBeGreaterThanOrEqual(44);
  await pill(page).click();
  const first = await sel(page);
  expect(first).toBe(hintSelection(new Solver(start, m.goal), start, 2));
  await shot(page, info, 'mission-hint');
  await pill(page).click();
  expect(await sel(page)).toBe(first);
  expect((await ava(page)).ply).toBe(start.ply);
  // The text never changes, so the goal is still readable.
  await expect(pill(page)).toHaveText(pillText(m, 2));
});

test('once a wrong move has been refuted the hint says so and selects nothing', async ({
  page,
}, info) => {
  const m = missionById('side-step')!;
  await openMission(page, m);
  const start = decode(m.state);
  const solver = new Solver(start, m.goal);
  const sols = solver.solutions(start, m.moves);
  const wrong = legalActions(start).find(
    (a) => a.kind === 'move' && !sols.some((x) => same(x, a)),
  )!;
  await play(page, info, await ava(page), wrong);
  await pill(page).click();
  await expect(pill(page)).toHaveText('Out of reach · Menu → Restart');
  expect(await sel(page)).toBeNull();
  // The goal text comes back as soon as the board next refreshes.
  const s: GameState = await ava(page);
  await play(
    page,
    info,
    s,
    legalActions(s).find((a) => a.kind === 'move')!,
  );
  await expect(page.locator('#mission-result .stamp')).toHaveText('MISSION FAILED');
});

test('there is no hint button while a solution replays, and the briefing mentions hints', async ({
  page,
}) => {
  await page.goto('/?test=1&speed=1&mission=double-tap&solution=1');
  await page.evaluate(() => (window as any).__AVA__.ready);
  await expect(pill(page)).toHaveText('Solution · watch the line');
  await expect(pill(page)).toBeDisabled();
  await page.goto('/?test=1&speed=0&mission=double-tap');
  await page.evaluate(() => (window as any).__AVA__.ready);
  await expect(page.locator('#briefing .hint-tip')).toHaveText(
    'Stuck? Tap the goal pill for a hint.',
  );
});

test('hint then destination works with touch and mouse alike (two-move mission)', async ({
  page,
}, info) => {
  const m = missionById('grab-and-go')!;
  await openMission(page, m);
  const solver = new Solver(decode(m.state), m.goal);
  for (let made = 0; made < m.moves; made++) {
    const s = await ava(page);
    await pill(page).click();
    const want = (await sel(page))!;
    const a = solver
      .solutions(s, m.moves - made)
      .find((x) =>
        want === 'reserve' ? x.kind === 'deploy' : x.kind === 'move' && x.spyId === want,
      )!;
    const to = (a as { to: { r: number; c: number } }).to;
    await tapTo(page, info, to.r, to.c);
  }
  await expect(page.locator('#mission-result .stamp')).toHaveText('MISSION COMPLETE');
});
