import { test, expect, type Page } from '@playwright/test';
import { MISSIONS, type Mission } from '../src/missions';
import { shot, trackErrors } from './helpers';

// A replay of a solved mission shows its best on the briefing label, so the player knows what to beat.
const m: Mission = MISSIONS.find((x) => x.moves >= 2)!;
const n = MISSIONS.indexOf(m) + 1;

async function open(page: Page, query: string) {
  await page.goto(`/?test=1&speed=0&${query}`);
  await page.evaluate(() => (window as any).__AVA__.ready);
  await expect(page.locator('#briefing')).toBeVisible();
}

test('a first look at a mission labels only its number', async ({ page }) => {
  const errors = trackErrors(page);
  await open(page, `mission=${m.id}`);
  await expect(page.locator('[data-testid="briefing-label"]')).toHaveText(
    `Mission ${n} of ${MISSIONS.length}`,
  );
  expect(errors).toEqual([]);
});

test('a replay shows the best moves on the briefing label, one line at 320x568', async ({
  page,
}, info) => {
  const errors = trackErrors(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(
    (best) => {
      try {
        localStorage.setItem('ava.missionBest.v1', JSON.stringify(best));
      } catch {
        /* ignore */
      }
    },
    { [m.id]: 1 },
  );
  await open(page, `mission=${m.id}`);
  const label = page.locator('[data-testid="briefing-label"]');
  await expect(label).toHaveText(`Mission ${n} of ${MISSIONS.length} · Best 1 of ${m.moves}`);
  const box = (await label.boundingBox())!;
  const style = await label.evaluate(
    (el) =>
      parseFloat(getComputedStyle(el).lineHeight) ||
      parseFloat(getComputedStyle(el).fontSize) * 1.2,
  );
  expect(box.height).toBeLessThan(style * 1.6); // still one line
  const card = (await page.locator('#briefing .card').boundingBox())!;
  expect(card.y + card.height).toBeLessThanOrEqual(568);
  await shot(page, info, 'briefing-best-320');
  expect(errors).toEqual([]);
});
