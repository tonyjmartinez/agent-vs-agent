import { expect, test } from '@playwright/test';
import { applyAction, legalActions } from '../src/engine/engine';
import { commit, load, state, waitPly } from './helpers';

const pos = (s: Awaited<ReturnType<typeof state>>, id: string) =>
  s.spies.find((p) => p.id === id)!.pos;

test.describe('bot seats', () => {
  test('a human move is answered by a legal bot move, and undo rewinds both', async ({
    page,
  }, info) => {
    const touch = info.project.name === 'mobile';
    const errors = await load(page, '&p1=bot:medium');
    expect(await page.evaluate(() => window.__AVA__!.seats)).toEqual(['human', 'bot:medium']);
    await expect(page.getByTestId('turn-0')).toHaveText('Your turn');
    await expect(page.getByText('Agent Teal').first()).toBeVisible();

    const start = await state(page);
    await commit(page, touch, [5, 1], [4, 1]);
    await waitPly(page, 2); // human ply + bot reply
    const s = await state(page);
    expect(s.current).toBe(0);
    expect(s.winner).toBeNull();
    const humanMove = { kind: 'move', spyId: 'p0a', to: { r: 4, c: 1 } } as const;
    const afterHuman = applyAction(start, humanMove).state;
    // The bot's reply is one of the legal Teal replies in the position after the human move.
    const replies = legalActions(afterHuman).map((a) =>
      JSON.stringify(applyAction(afterHuman, a).state),
    );
    expect(replies).toContain(JSON.stringify(s));

    await page.getByTestId('undo').click();
    const u = await state(page);
    expect(u.ply).toBe(0);
    expect(pos(u, 'p0a')).toEqual({ r: 5, c: 1 });
    await expect(page.getByTestId('undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test('shows "Agent Teal is thinking…" and locks input while the bot is on move', async ({
    page,
  }, info) => {
    const touch = info.project.name === 'mobile';
    await page.goto('/?test=1&speed=3&p1=bot:easy');
    await page.evaluate(() => window.__AVA__!.ready);
    await commit(page, touch, [5, 1], [4, 1]);
    await expect(page.getByTestId('turn-1')).toHaveText('Agent Teal is thinking…');
    await expect(page.getByTestId('undo')).toBeDisabled();
    const mid = await state(page);
    expect(mid.ply).toBe(1);
    await expect(page.getByTestId('turn-0')).toHaveText('Your turn', { timeout: 10_000 });
    expect((await state(page)).ply).toBe(2);
    await expect(page.getByTestId('undo')).toBeEnabled();
  });

  test('a bot can open the game when it holds seat 0', async ({ page }) => {
    await load(page, '&p0=bot:easy');
    await waitPly(page, 1);
    expect((await state(page)).current).toBe(1);
    await expect(page.getByTestId('turn-1')).toHaveText('Your turn');
  });

  test('bot vs bot plays a full game to a result, keeping every invariant', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = await load(page, '&p0=bot:medium&p1=bot:easy&seed=5');
    await page.waitForFunction(() => window.__AVA__!.getState().winner !== null, undefined, {
      timeout: 90_000,
    });
    const s = await state(page);
    expect(s.ply).toBeLessThanOrEqual(120);
    const cells = s.spies.flatMap((p) => (p.pos ? [`${p.pos.r},${p.pos.c}`] : []));
    expect(new Set(cells).size).toBe(cells.length);
    const carriers = s.spies.filter((p) => p.carrying).length;
    expect(s.intel.length + carriers).toBe(s.rules.intelOnBoard);
    await expect(page.getByTestId('winner-text')).toBeVisible();
    if (s.winner === 'draw') await expect(page.getByTestId('winner-text')).toHaveText('Draw!');
    else expect(Math.max(...s.scores)).toBeGreaterThanOrEqual(0);
    await page.screenshot({ path: `artifacts/screens/ava-botgame-end.png` });
    // Rematch restarts the bots' game.
    await page.getByTestId('rematch').click();
    await expect(page.getByTestId('winner-text')).toBeHidden();
    await page.waitForFunction(() => window.__AVA__!.getState().ply > 0);
    expect(errors).toEqual([]);
  });

  test('hard bot answers within its time budget', async ({ page }, info) => {
    const touch = info.project.name === 'mobile';
    await load(page, '&p1=bot:hard');
    const t0 = Date.now();
    await commit(page, touch, [5, 1], [4, 1]);
    await waitPly(page, 2);
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});
