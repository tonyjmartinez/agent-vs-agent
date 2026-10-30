import { test, expect, type Page } from '@playwright/test';
import { MISSIONS } from '../src/missions';
import { shot } from './helpers';

const RECORD = JSON.stringify({ hard: { w: 2, l: 1, d: 0 } });

async function seed(page: Page): Promise<void> {
  await page.addInitScript(
    ([ids, record]) => {
      try {
        if (localStorage.getItem('ava.seeded')) return; // seed once, so a reload keeps what the page wrote
        localStorage.setItem('ava.seeded', '1');
        localStorage.setItem('ava.missions.v1', JSON.stringify(ids));
        localStorage.setItem('ava.daily.v1', JSON.stringify(['2026-05-01', '2026-05-02']));
        localStorage.setItem('ava.record.v1', record);
      } catch {
        /* ignore */
      }
    },
    [MISSIONS.slice(0, 5).map((m) => m.id), RECORD] as const,
  );
}

async function openList(page: Page): Promise<void> {
  await page.goto('/?test=1&speed=0&day=2026-05-02');
  await page.evaluate(() => (window as any).__AVA__.ready);
  await page.click('#btn-missions');
  await expect(page.locator('#missions')).toBeVisible();
}

test('reset needs two taps, wipes missions and streak, and keeps the bot record', async ({
  page,
}, info) => {
  await seed(page);
  await openList(page);
  const progress = page.locator('[data-testid="missions-progress"]');
  const streak = page.locator('[data-testid="daily-streak"]');
  const reset = page.locator('[data-testid="reset-progress"]');
  await expect(progress).toHaveText(`5 of ${MISSIONS.length} complete`);
  await expect(streak).toHaveText('Streak: 2 days');

  // First tap only arms the button.
  await reset.scrollIntoViewIfNeeded();
  await reset.click();
  await expect(reset).toHaveText('Tap again to erase all progress');
  await expect(progress).toHaveText(`5 of ${MISSIONS.length} complete`);
  await shot(page, info, 'reset-armed');

  // Leaving and coming back disarms it: nothing was lost.
  await page.click('#btn-missions-back');
  await page.click('#btn-missions');
  await expect(page.locator('[data-testid="reset-progress"]')).toHaveText('Reset progress');
  await expect(progress).toHaveText(`5 of ${MISSIONS.length} complete`);

  // Two taps wipe progress and streak, and the list redraws empty.
  await page.locator('[data-testid="reset-progress"]').scrollIntoViewIfNeeded();
  await page.locator('[data-testid="reset-progress"]').click();
  await page.locator('[data-testid="reset-progress"]').click();
  await expect(progress).toHaveText(`0 of ${MISSIONS.length} complete`);
  await expect(streak).toHaveText("Solve today's daily to start a streak.");
  await expect(page.locator('.mission-btn.done')).toHaveCount(0);
  await expect(page.locator('.next-tag')).toHaveCount(0);
  await expect(page.locator('[data-testid="daily-btn"]')).not.toHaveClass(/done/);

  const stored = await page.evaluate(() => ({
    missions: localStorage.getItem('ava.missions.v1'),
    daily: localStorage.getItem('ava.daily.v1'),
    record: localStorage.getItem('ava.record.v1'),
  }));
  expect(stored).toEqual({ missions: '[]', daily: '[]', record: RECORD });

  // It stays reset after a reload.
  await openList(page);
  await expect(progress).toHaveText(`0 of ${MISSIONS.length} complete`);
});
