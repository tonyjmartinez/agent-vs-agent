import { test, expect, type Page } from '@playwright/test';
import { MISSIONS } from '../src/missions';
import { shot, trackErrors } from './helpers';
import { openMission, solve } from './missionHelpers';

async function seed(page: Page, ids: string[]): Promise<void> {
  await page.addInitScript((v) => {
    try {
      localStorage.setItem('ava.missions.v1', JSON.stringify(v));
    } catch {
      /* ignore */
    }
  }, ids);
}

async function openList(page: Page): Promise<void> {
  await page.goto('/?test=1&speed=0');
  await page.evaluate(() => (window as any).__AVA__.ready);
  await page.click('#btn-missions');
  await expect(page.locator('#missions')).toBeVisible();
}

test('a fresh list highlights nothing special: no "Next up" tag, first mission is on top', async ({
  page,
}) => {
  await openList(page);
  await expect(page.locator('.next-tag')).toHaveCount(0);
  await expect(page.locator('.mission-btn.next')).toHaveAttribute('data-mission', MISSIONS[0]!.id);
});

test('with progress, the list opens at the next mission, which is tagged and on screen', async ({
  page,
}, info) => {
  const errors = trackErrors(page);
  const doneIds = MISSIONS.slice(0, 11).map((m) => m.id);
  await seed(page, doneIds);
  await openList(page);
  const next = page.locator('.mission-btn.next');
  await expect(next).toHaveAttribute('data-mission', MISSIONS[11]!.id);
  await expect(page.locator('.next-tag')).toHaveText('Next up');
  await expect(page.locator('.next-tag')).toHaveCount(1);
  // Described by its tag, so a screen reader hears "Next up" with the mission.
  await expect(next).toHaveAttribute('aria-describedby', 'next-up');
  // It is inside the visible part of the list (the card scrolls on phones).
  const b = (await next.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
  await shot(page, info, 'missions-next-up');
  // Tapping it starts exactly that mission.
  await next.click();
  await expect(page.locator('#briefing .stamp')).toHaveText(MISSIONS[11]!.title.toUpperCase());
  expect(errors).toEqual([]);
});

test('completing a mission moves "Next up" along; a gap stays the next one', async ({
  page,
}, info) => {
  const m = MISSIONS[2]!;
  await seed(page, [MISSIONS[0]!.id]); // 1 done, 2 not, 3 about to be done
  await openMission(page, m);
  await solve(page, info, m);
  await page.click('#btn-mission-list');
  // Mission 2 was skipped, so it is still the next one.
  await expect(page.locator('.mission-btn.next')).toHaveAttribute('data-mission', MISSIONS[1]!.id);
  await expect(page.locator('[data-mission="' + m.id + '"]')).toHaveClass(/done/);
});

test('when every mission is done nothing is tagged', async ({ page }) => {
  await seed(
    page,
    MISSIONS.map((m) => m.id),
  );
  await openList(page);
  await expect(page.locator('.mission-btn.next')).toHaveCount(0);
  await expect(page.locator('.next-tag')).toHaveCount(0);
  await expect(page.locator('[data-testid="missions-progress"]')).toHaveText(
    `All ${MISSIONS.length} missions complete. Nice work.`,
  );
});
