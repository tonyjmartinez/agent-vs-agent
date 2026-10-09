import { test, expect } from '@playwright/test';
import { open, shot, tapCell, trackErrors } from './helpers';

test('sprint targets and a fumble lock render, and a dash commits', async ({ page }, info) => {
  const errors = trackErrors(page);
  // Red carrier at (3,2): one-step dots plus ringed dash targets.
  await open(page, 'p0=human&p1=human&state=v1.0.0.0-0.32*,54,01,04.22');
  await tapCell(page, info, 3, 2);
  const dashes = await page.evaluate(
    () =>
      (window as any).__AVA__
        .legal()
        .filter(
          (a: any) =>
            a.kind === 'move' &&
            a.spyId === 'p0a' &&
            Math.max(Math.abs(a.to.r - 3), Math.abs(a.to.c - 2)) === 2,
        ).length,
  );
  expect(dashes).toBeGreaterThan(0);
  await shot(page, info, 'sprint-targets');
  // Dash home: (3,2) -> (5,2) over (4,2) extracts.
  await tapCell(page, info, 5, 2);
  if (info.project.use.hasTouch) await tapCell(page, info, 5, 2);
  await page.evaluate(() => (window as any).__AVA__.idle());
  await expect(page.locator('[data-testid="score-0"]')).toHaveAttribute('data-score', '1');

  // Fumble: red knocks teal's carrier loose; the folder is locked for teal.
  await open(page, 'p0=human&p1=human&state=v1.0.0.0-0.21,54,23*,04.33');
  await page.evaluate(() =>
    (window as any).__AVA__.act({ kind: 'move', spyId: 'p0a', to: { r: 2, c: 2 } }),
  );
  const st = await page.evaluate(() => (window as any).__AVA__.getState());
  expect(st.locks).toEqual([{ at: { r: 2, c: 3 }, player: 1 }]);
  await shot(page, info, 'fumble-lock');
  // Colour-blind check (PLAN 6): teams must stay distinguishable in greyscale (hat shape, scarf).
  await page.addStyleTag({ content: 'html { filter: grayscale(1) }' });
  await shot(page, info, 'greyscale');
  expect(errors).toEqual([]);
});

test('last-move trail shows where the bot just moved', async ({ page }, info) => {
  const errors = trackErrors(page);
  await open(page, 'p0=human&p1=bot:easy&seed=7');
  await page.evaluate(() =>
    (window as any).__AVA__.act({ kind: 'move', spyId: 'p0a', to: { r: 4, c: 1 } }),
  );
  await page.waitForFunction(() => (window as any).__AVA__.getState().ply >= 2);
  await page.evaluate(() => (window as any).__AVA__.idle());
  const last = await page.evaluate(() => (window as any).__AVA__.controller().moves.at(-1));
  expect(last.owner).toBe(1);
  expect(last.to).toBeTruthy();
  await shot(page, info, 'last-move');
  // Undo rewinds the trail with the history.
  await page.click('#btn-undo');
  const after = await page.evaluate(() => {
    const c = (window as any).__AVA__.controller();
    return { len: c.moves.length, hist: c.history.length };
  });
  expect(after.len).toBe(after.hist);
  expect(errors).toEqual([]);
});
