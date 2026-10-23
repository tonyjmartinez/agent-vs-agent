import { expect, test, type Page } from '@playwright/test';
import { commit, state, waitPly } from './helpers';

const noOverflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <= innerWidth &&
      document.documentElement.scrollHeight <= innerHeight,
  );

test.describe('menu and onboarding', () => {
  test('start menu: pick a difficulty and start a game against the agent', async ({
    page,
  }, info) => {
    const touch = info.project.name === 'mobile';
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/?menu=1&test=1&speed=0');
    await expect(page.getByRole('heading', { name: 'Agent vs Agent' })).toBeVisible();
    await expect(page.getByTestId('last-mode')).toHaveCount(0);
    expect(await noOverflow(page)).toBe(true);
    await page.screenshot({ path: `artifacts/screens/ava-${info.project.name}-menu.png` });

    await expect(page.getByTestId('diff-medium')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('diff-easy').click();
    await expect(page.getByTestId('diff-easy')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('diff-medium')).toHaveAttribute('aria-pressed', 'false');
    await page.getByTestId('play-bot').click();

    await page.waitForURL(/play=1/);
    await page.evaluate(() => window.__AVA__!.ready);
    expect(await page.evaluate(() => window.__AVA__!.seats)).toEqual(['human', 'bot:easy']);
    await expect(page.getByTestId('menu-btn')).toBeVisible();

    await commit(page, touch, [5, 1], [4, 1]);
    expect((await state(page)).ply).toBe(2); // our move + the agent's reply
    expect(errors).toEqual([]);
  });

  test('plays 3 human moves vs Easy, each answered by the agent', async ({ page }, info) => {
    const touch = info.project.name === 'mobile';
    await page.goto('/?play=1&test=1&speed=0&p1=bot:easy');
    await page.evaluate(() => window.__AVA__!.ready);
    for (let i = 0; i < 3; i++) {
      const legal = await page.evaluate(() => window.__AVA__!.legal());
      const a = legal.find((x) => x.kind === 'move')!;
      if (a.kind !== 'move') throw new Error('expected a move');
      const s = await state(page);
      const p = s.spies.find((x) => x.id === a.spyId)!.pos!;
      await commit(page, touch, [p.r, p.c], [a.to.r, a.to.c]);
      await waitPly(page, (i + 1) * 2);
    }
    expect((await state(page)).ply).toBe(6);
  });

  test('remembers the last mode and offers it on the next visit', async ({ page }) => {
    await page.goto('/?menu=1&test=1&speed=0');
    await page.getByTestId('diff-hard').click();
    await page.getByTestId('play-bot').click();
    await page.waitForURL(/play=1/);
    await page.evaluate(() => window.__AVA__!.ready);
    await page.getByTestId('menu-btn').click();
    await page.getByTestId('pause-quit').click();
    await page.waitForURL(/menu=1/);
    await expect(page.getByTestId('diff-hard')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('last-mode')).toContainText('hard');
    await page.getByTestId('play-hotseat').click();
    await page.waitForURL(/play=1/);
    await page.evaluate(() => window.__AVA__!.ready);
    expect(await page.evaluate(() => window.__AVA__!.seats)).toEqual(['human', 'human']);
  });

  test('a bare URL opens the menu (no game booted)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('play-bot')).toBeVisible();
    expect(await page.locator('#board canvas').count()).toBe(0);
  });

  test('rules card reads well and fits the viewport', async ({ page }, info) => {
    await page.goto('/?menu=1&test=1');
    await page.getByTestId('menu-rules').click();
    const card = page.getByTestId('rules-card');
    await expect(card).toBeVisible();
    await expect(card.locator('svg')).toHaveCount(3);
    for (const word of ['Goal', 'Bump', 'Burned', 'Intel']) await expect(card).toContainText(word);
    const box = (await card.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
    expect(box.height).toBeLessThanOrEqual(vp.height);
    await page.screenshot({ path: `artifacts/screens/ava-${info.project.name}-rules.png` });
    await page.getByTestId('rules-close').click();
    await expect(card).toBeHidden();
  });

  test('pause menu: resume, restart, rules, quit', async ({ page }, info) => {
    const touch = info.project.name === 'mobile';
    await page.goto('/?play=1&test=1&speed=0');
    await page.evaluate(() => window.__AVA__!.ready);
    await commit(page, touch, [5, 1], [4, 1]);

    await page.getByTestId('menu-btn').click();
    await expect(page.getByTestId('pause-resume')).toBeVisible();
    await page.screenshot({ path: `artifacts/screens/ava-${info.project.name}-pause.png` });
    await page.getByTestId('pause-resume').click();
    await expect(page.getByTestId('pause-resume')).toBeHidden();
    expect((await state(page)).ply).toBe(1);

    await page.getByTestId('menu-btn').click();
    await page.getByTestId('pause-rules').click();
    await expect(page.getByTestId('rules-card')).toBeVisible();
    await page.getByTestId('rules-close').click();
    await expect(page.getByTestId('pause-quit')).toBeVisible(); // still paused underneath

    await page.getByTestId('pause-restart').click();
    expect((await state(page)).ply).toBe(0);
    await expect(page.getByTestId('pause-quit')).toBeHidden();

    await page.getByTestId('menu-btn').click();
    await page.getByTestId('pause-quit').click();
    await page.waitForURL(/menu=1/);
    await expect(page.getByTestId('play-bot')).toBeVisible();
  });

  test('HUD with the new Menu button still fits the phone viewport', async ({ page }) => {
    await page.goto(
      '/?play=1&test=1&speed=0&state=' +
        encodeURIComponent('1;4;0;0,0;-;p0a@42,p0b@x,p1a@01,p1b@04;22,33'),
    );
    await page.evaluate(() => window.__AVA__!.ready);
    expect(await noOverflow(page)).toBe(true);
    for (const id of ['undo', 'menu-btn']) {
      const b = (await page.getByTestId(id).boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('coach marks guide the first move once, then never return', async ({ page }, info) => {
    const touch = info.project.name === 'mobile';
    await page.goto('/?play=1&test=1&speed=0&coach=1');
    await page.evaluate(() => window.__AVA__!.ready);
    const coach = page.getByTestId('coach-text');
    await expect(coach).toHaveText(touch ? 'Tap one of your spies' : 'Click one of your spies');
    await page.screenshot({ path: `artifacts/screens/ava-${info.project.name}-coach.png` });

    const tap = async (r: number, c: number) => {
      const { x, y } = await page.evaluate(
        ([rr, cc]) => window.__AVA__!.cellClient(rr!, cc!),
        [r, c],
      );
      if (touch) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
    };
    await tap(5, 1);
    await expect(coach).toHaveText(
      touch ? 'Tap a glowing square to preview' : 'Click a glowing square to move',
    );
    if (touch) {
      await tap(4, 1);
      await expect(coach).toHaveText('Tap it again to move');
      await tap(4, 1);
    } else {
      await tap(4, 1);
    }
    await waitPly(page, 1);
    await expect(page.getByTestId('coach-dismiss')).toBeHidden();

    await page.reload();
    await page.evaluate(() => window.__AVA__!.ready);
    await expect(page.getByTestId('coach-text')).toHaveCount(0);
  });

  test('coach marks can be dismissed and stay dismissed', async ({ page }) => {
    await page.goto('/?play=1&test=1&speed=0&coach=1');
    await page.evaluate(() => window.__AVA__!.ready);
    await page.getByTestId('coach-dismiss').click();
    await expect(page.getByTestId('coach-dismiss')).toBeHidden();
    await page.reload();
    await page.evaluate(() => window.__AVA__!.ready);
    await expect(page.getByTestId('coach-dismiss')).toHaveCount(0);
  });

  test('works with storage blocked (private mode)', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('SecurityError');
        },
      });
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/?menu=1&test=1&speed=0');
    await page.getByTestId('play-hotseat').click();
    await page.waitForURL(/play=1/);
    await page.evaluate(() => window.__AVA__!.ready);
    expect(errors).toEqual([]);
  });
});
