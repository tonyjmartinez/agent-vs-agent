import { test, expect, type Page } from '@playwright/test';
import { missionById } from '../src/missions';
import { openMission } from './missionHelpers';

const SIZES = [
  [320, 568],
  [360, 640],
  [390, 844],
  [667, 375],
  [844, 390],
  [1024, 768],
] as const;

/** Every open overlay card: inside the viewport, and (unless it is meant to scroll) with nothing hidden behind an inner scroll. */
async function expectCardsFit(page: Page, what: string, w: number, h: number, scrolls = false) {
  const cards = page.locator('.overlay .card');
  await expect(cards.last()).toBeVisible();
  for (const card of await cards.all()) {
    const b = (await card.boundingBox())!;
    const at = `${what} at ${w}x${h}`;
    expect.soft(b.x, `${at}: left edge`).toBeGreaterThanOrEqual(0);
    expect.soft(b.x + b.width, `${at}: right edge`).toBeLessThanOrEqual(w);
    expect.soft(b.y, `${at}: top edge`).toBeGreaterThanOrEqual(0);
    expect.soft(b.y + b.height, `${at}: bottom edge`).toBeLessThanOrEqual(h);
    if (!scrolls) {
      const overflow = await card.evaluate((e) => e.scrollHeight - e.clientHeight);
      expect
        .soft(overflow, `${at}: ${overflow}px hidden behind an inner scroll`)
        .toBeLessThanOrEqual(1);
    }
  }
}

test('menus, briefings and result cards never hide behind an inner scroll', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'viewport sweep runs once');
  test.setTimeout(240_000);
  const m = missionById('grab-and-go')!;
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });

    await page.goto('/?test=1&speed=0');
    await page.evaluate(() => (window as any).__AVA__.ready);
    await expectCardsFit(page, 'main menu', w, h);
    await page.screenshot({ path: `artifacts/screens/menu-${w}x${h}.png` });

    await page.click('#btn-missions');
    await expectCardsFit(page, 'missions list', w, h, true);
    await page.click('#btn-missions-back');

    await page.click('#btn-howto');
    await expectCardsFit(page, 'how to play', w, h, true);
    await page.keyboard.press('Escape');

    await openMission(page, m);
    await page.click('#btn-menu');
    await expectCardsFit(page, 'pause menu', w, h);
    await page.click('#btn-resume');

    await page.goto(`/?test=1&speed=0&mission=${m.id}`);
    await page.evaluate(() => (window as any).__AVA__.ready);
    await expectCardsFit(page, 'mission briefing', w, h);

    await page.goto(`/?test=1&speed=0&mission=${m.id}&solution=1`);
    await expectCardsFit(page, 'mission result', w, h);

    await page.goto('/?test=1&speed=0&mission=daily&day=2026-05-02');
    await page.evaluate(() => (window as any).__AVA__.ready);
    await expectCardsFit(page, 'daily briefing', w, h);
  }
});
