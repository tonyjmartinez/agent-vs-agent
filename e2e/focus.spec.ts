import { test, expect, type Page } from '@playwright/test';
import { open } from './helpers';

/** Tab through the page; every button that takes focus must show a visible outline. */
async function tabAudit(page: Page, what: string, max = 25) {
  const seen = new Set<string>();
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      return {
        id: el.id || el.className || el.tagName,
        width: parseFloat(s.outlineWidth),
        style: s.outlineStyle,
        shadow: s.boxShadow,
      };
    });
    if (!r) continue;
    if (seen.has(r.id)) break;
    seen.add(r.id);
    const ok = (r.style !== 'none' && r.width >= 2) || r.shadow !== 'none';
    expect.soft(ok, `${what}: ${r.id} has a focus ring`).toBe(true);
  }
  expect(seen.size, `${what}: something is focusable`).toBeGreaterThan(0);
}

test('menu and rules card buttons show a focus ring', async ({ page }) => {
  await open(page);
  await tabAudit(page, 'menu');
  await page.click('#btn-howto');
  await expect(page.locator('#rules')).toBeVisible();
  await tabAudit(page, 'rules');
});

test('in-game HUD buttons show a focus ring', async ({ page }) => {
  await open(page);
  await page.click('[data-level="easy"]');
  await page.click('#btn-play-bot');
  await expect(page.locator('#menu')).toHaveCount(0);
  // In play, Tab cycles your spies (keyboard play), so reach the HUD buttons by focusing them after a key press.
  await page.keyboard.press('Shift+Tab');
  const buttons = page.locator('#hud-top button, #hud-bottom button:not([disabled])');
  const n = await buttons.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    await buttons.nth(i).focus();
    const r = await buttons.nth(i).evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        w: parseFloat(s.outlineWidth),
        st: s.outlineStyle,
        sh: s.boxShadow,
        m: el.matches(':focus-visible'),
      };
    });
    expect
      .soft(r.m && ((r.st !== 'none' && r.w >= 2) || r.sh !== 'none'), `hud button ${i} ring`)
      .toBe(true);
  }
});
