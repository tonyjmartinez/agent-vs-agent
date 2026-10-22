import { expect, test } from '@playwright/test';
import { applyAction } from '../src/engine/engine';
import type { GameState } from '../src/engine/types';
import { commit, legal, load, state, tapCell, waitPly } from './helpers';

const pos = (s: GameState, id: string) => s.spies.find((p) => p.id === id)!.pos;

test.describe('hotseat', () => {
  test('select, move, turn passes; enemy spies cannot be selected; undo restores', async ({
    page,
  }, info) => {
    const touch = info.project.name === 'mobile';
    const errors = await load(page);
    await tapCell(page, touch, [0, 1]); // Teal spy on Red's turn: ignored
    await tapCell(page, touch, [1, 1]);
    expect((await state(page)).ply).toBe(0);

    await commit(page, touch, [5, 1], [4, 1]);
    const s = await state(page);
    expect(pos(s, 'p0a')).toEqual({ r: 4, c: 1 });
    expect(s.current).toBe(1);
    await expect(page.getByTestId('turn-1')).toHaveText('Your turn');
    await expect(page.getByTestId('turn-0')).toHaveText('');

    await page.getByTestId('undo').click();
    const u = await state(page);
    expect(u.ply).toBe(0);
    expect(pos(u, 'p0a')).toEqual({ r: 5, c: 1 });
    await expect(page.getByTestId('undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test('touch needs a second tap; a stray tap cancels the selection', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'touch-only behaviour');
    await load(page);
    await tapCell(page, true, [5, 1]);
    await tapCell(page, true, [4, 1]); // preview only
    expect((await state(page)).ply).toBe(0);
    await tapCell(page, true, [2, 0]); // cancel
    await tapCell(page, true, [4, 1]); // no selection: ignored
    expect((await state(page)).ply).toBe(0);
    await tapCell(page, true, [5, 1]);
    await tapCell(page, true, [4, 1]);
    await tapCell(page, true, [4, 1]);
    await waitPly(page, 1);
  });

  test('wins by extraction, shows game over, rematch resets', async ({ page }, info) => {
    const touch = info.project.name === 'mobile';
    // Red carrier one step from its row with 2 points banked.
    await load(page, '&state=' + encodeURIComponent('1;4;0;2,0;-;p0a@42*,p0b@54,p1a@01,p1b@04;33'));
    await commit(page, touch, [4, 2], [5, 2]);
    const s = await state(page);
    expect(s.winner).toBe(0);
    expect(s.scores).toEqual([3, 0]);
    await expect(page.getByTestId('winner-text')).toHaveText('Mission complete: Red wins!');
    await expect(page.getByTestId('score-0')).toHaveText('Score 3/3');
    await page.screenshot({ path: `artifacts/screens/ava-${info.project.name}-gameover.png` });
    // Input is locked after game over.
    await tapCell(page, touch, [5, 4]);
    expect((await state(page)).ply).toBe(s.ply);

    await page.getByTestId('rematch').click();
    await expect(page.getByTestId('winner-text')).toBeHidden();
    const r = await state(page);
    expect(r.ply).toBe(0);
    expect(r.scores).toEqual([0, 0]);
    await expect(page.getByTestId('score-0')).toHaveText('Score 0/3');
  });

  test('deploys from the reserve tray and bumps on arrival', async ({ page }, info) => {
    const touch = info.project.name === 'mobile';
    await load(
      page,
      '&state=' + encodeURIComponent('1;4;0;0,0;-;p0a@42,p0b@x,p1a@01,p1b@04;22,33'),
    );
    await expect(page.getByTestId('reserve-0')).toHaveCount(1);
    await expect(page.getByTestId('reserve-0')).toBeEnabled();
    await expect(page.getByTestId('reserve-1')).toHaveCount(0);
    const fits = () =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      );
    expect(await fits()).toBe(true); // reserve tray must not push the HUD past the viewport
    await commit(page, touch, 'reserve', [5, 2]);
    const s = await state(page);
    expect(pos(s, 'p0b')).toEqual({ r: 5, c: 2 });
    await expect(page.getByTestId('reserve-0')).toHaveCount(0);
  });

  test('previews a burn without committing, then burns into the reserve tray', async ({
    page,
  }, info) => {
    const touch = info.project.name === 'mobile';
    await load(page, '&state=' + encodeURIComponent('1;4;0;0,0;-;p0a@22,p0b@54,p1a@02,p1b@04;33'));
    await tapCell(page, touch, [2, 2]);
    if (touch) await tapCell(page, touch, [1, 2]);
    else {
      const { x, y } = await page.evaluate(() => window.__AVA__!.cellClient(1, 2));
      await page.mouse.move(x, y);
    }
    await page.waitForTimeout(150);
    expect((await state(page)).ply).toBe(4); // preview must not commit
    await page.screenshot({ path: `artifacts/screens/ava-${info.project.name}-preview-burn.png` });

    if (touch) await tapCell(page, touch, [1, 2]);
    else
      await page.mouse.click(
        ...(Object.values(await page.evaluate(() => window.__AVA__!.cellClient(1, 2))) as [
          number,
          number,
        ]),
      );
    await waitPly(page, 5);
    const s = await state(page);
    expect(pos(s, 'p1a')).toBeNull();
    await expect(page.getByTestId('reserve-1')).toHaveCount(1);
  });

  test('a scripted 40-ply game driven through real taps matches the engine move for move', async ({
    page,
  }, info) => {
    test.setTimeout(120_000);
    const touch = info.project.name === 'mobile';
    const errors = await load(page);
    let expected = await state(page);
    for (let i = 0; i < 40 && expected.winner === null; i++) {
      const acts = await legal(page);
      const a = acts[(i * 7) % acts.length]!;
      if (a.kind === 'pass') break;
      const from =
        a.kind === 'deploy'
          ? 'reserve'
          : ((): [number, number] => {
              const p = expected.spies.find((x) => x.id === a.spyId)!.pos!;
              return [p.r, p.c];
            })();
      await commit(page, touch, from, [a.to.r, a.to.c]);
      expected = applyAction(expected, a).state;
      expect(await state(page)).toEqual(expected);
    }
    expect(expected.ply).toBeGreaterThanOrEqual(10);
    expect(errors).toEqual([]);
  });
});

test('animations complete and leave the board in sync (speed 1)', async ({ page }, info) => {
  const touch = info.project.name === 'mobile';
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(
    '/?test=1&speed=1&state=' + encodeURIComponent('1;4;0;0,0;-;p0a@22,p0b@54,p1a@02,p1b@04;33'),
  );
  await page.evaluate(() => window.__AVA__!.ready);
  await commit(page, touch, [2, 2], [1, 2]); // burns p1a: exercises move + burn + shake
  await page.waitForTimeout(800);
  expect((await state(page)).spies.find((p) => p.id === 'p1a')!.pos).toBeNull();
  await page.screenshot({ path: `artifacts/screens/ava-${info.project.name}-after-burn.png` });
  expect(errors).toEqual([]);
});
