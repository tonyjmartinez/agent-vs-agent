import { test, expect } from '@playwright/test';
import { Solver } from '../src/ai/solve';
import { decode } from '../src/engine/serialize';
import { missionById } from '../src/missions';
import { hintSelection } from '../src/hint';
import { trackErrors } from './helpers';
import { ava, idle, openMission } from './missionHelpers';

test('keyboard: ask for a hint with the pill, then aim with the arrows and Enter to move', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'keyboard is a desktop nicety');
  const errors = trackErrors(page);
  const m = missionById('first-contact')!;
  await openMission(page, m);
  const start = decode(m.state);
  const solver = new Solver(start, m.goal);
  // Reach the pill by keyboard alone and press it.
  await page.locator('#mission-pill').focus();
  await page.keyboard.press('Enter');
  const want = hintSelection(solver, start, m.moves);
  expect(await page.evaluate(() => (window as any).__AVA__.controller().sel.selected)).toBe(want);
  // The pill must not keep swallowing Enter/Tab: focus has to leave it once the hint is given.
  expect(await page.evaluate(() => document.activeElement instanceof HTMLButtonElement)).toBe(
    false,
  );
  const a = solver.solutions(start, m.moves).find((x) => x.kind === 'move' && x.spyId === want)!;
  const to = (a as { to: { r: number; c: number } }).to;
  // First arrow press puts the cursor on the first selectable spy; then walk it to the target cell.
  await page.keyboard.press('ArrowUp');
  const cur = await page.evaluate(
    () => (window as any).__AVA__.controller().cursor as { r: number; c: number },
  );
  for (let r = cur.r; r !== to.r; r += Math.sign(to.r - r)) {
    await page.keyboard.press(to.r > r ? 'ArrowDown' : 'ArrowUp');
  }
  for (let c = cur.c; c !== to.c; c += Math.sign(to.c - c)) {
    await page.keyboard.press(to.c > c ? 'ArrowRight' : 'ArrowLeft');
  }
  await page.keyboard.press('Enter');
  await idle(page);
  await expect(page.locator('#mission-result .stamp')).toHaveText('MISSION COMPLETE');
  expect((await ava(page)).ply).toBeGreaterThan(start.ply);
  expect(errors).toEqual([]);
});

test('keyboard only: a whole two-move mission, hint then aim then Enter, every turn', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'keyboard is a desktop nicety');
  const m = missionById('double-tap')!;
  await openMission(page, m);
  const solver = new Solver(decode(m.state), m.goal);
  for (let made = 0; made < m.moves; made++) {
    const s = await ava(page);
    const left = m.moves - made;
    await page.locator('#mission-pill').focus();
    await page.keyboard.press('Enter');
    const want = hintSelection(solver, s, left);
    expect(await page.evaluate(() => (window as any).__AVA__.controller().sel.selected)).toBe(want);
    const a = solver
      .solutions(s, left)
      .find((x) =>
        want === 'reserve' ? x.kind === 'deploy' : x.kind === 'move' && x.spyId === want,
      )!;
    const to = (a as { to: { r: number; c: number } }).to;
    await page.keyboard.press('ArrowUp');
    const cur = await page.evaluate(
      () => (window as any).__AVA__.controller().cursor as { r: number; c: number },
    );
    for (let r = cur.r; r !== to.r; r += Math.sign(to.r - r)) {
      await page.keyboard.press(to.r > r ? 'ArrowDown' : 'ArrowUp');
    }
    for (let c = cur.c; c !== to.c; c += Math.sign(to.c - c)) {
      await page.keyboard.press(to.c > c ? 'ArrowRight' : 'ArrowLeft');
    }
    await page.keyboard.press('Enter');
    await idle(page);
  }
  await expect(page.locator('#mission-result .stamp')).toHaveText('MISSION COMPLETE');
});
