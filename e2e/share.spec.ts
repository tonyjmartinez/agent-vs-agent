import { test, expect, type Page } from '@playwright/test';
import { missionById } from '../src/missions';
import { shareText } from '../src/share';
import { shot, trackErrors } from './helpers';

/** Replace the browser's share/clipboard with recorders (headless Chromium has no share sheet). */
async function stub(page: Page, share: 'none' | 'ok' | 'abort'): Promise<void> {
  await page.addInitScript((mode) => {
    const w = window as any;
    w.__sent = [] as string[];
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value:
        mode === 'none'
          ? undefined
          : async (d: { text: string }) => {
              if (mode === 'abort') throw Object.assign(new Error('x'), { name: 'AbortError' });
              w.__sent.push('share:' + d.text);
            },
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (t: string) => void w.__sent.push('clip:' + t) },
    });
  }, share);
}
const sent = (page: Page) => page.evaluate(() => (window as any).__sent as string[]);

test('briefing Share copies a spoiler-free link that reopens the same puzzle', async ({
  page,
}, info) => {
  const errors = trackErrors(page);
  await stub(page, 'none');
  const m = missionById('grab-and-go')!;
  await page.goto(`/?test=1&speed=0&mission=${m.id}`);
  await page.evaluate(() => (window as any).__AVA__.ready);
  await page.click('[data-testid="share-btn"]');
  await expect(page.locator('[data-testid="share-note"]')).toHaveText('Link copied.');
  const [msg] = await sent(page);
  const text = msg!.replace(/^clip:/, '');
  const link = text.split('\n')[1]!;
  expect(text).toBe(shareText(m, page.url()));
  expect(text).not.toContain(m.state);
  await shot(page, info, 'share-briefing');
  // The link is a real entry point: it opens that mission's briefing and position.
  await page.goto(link.replace(/^https?:\/\/[^/]+/, '') + '&test=1&speed=0');
  await page.evaluate(() => (window as any).__AVA__.ready);
  await expect(page.locator('#briefing .stamp')).toHaveText(m.title.toUpperCase());
  await page.click('#btn-briefing-go');
  expect(await page.evaluate(() => (window as any).__AVA__.encode())).toBe(m.state);
  expect(errors).toEqual([]);
});

test('the share sheet is used when present; dismissing it is silent success', async ({ page }) => {
  await stub(page, 'ok');
  await page.goto('/?test=1&speed=0&mission=backdoor');
  await page.evaluate(() => (window as any).__AVA__.ready);
  await page.click('[data-testid="share-btn"]');
  await expect(page.locator('[data-testid="share-note"]')).toHaveText('Shared.');
  expect((await sent(page))[0]).toMatch(/^share:Agent vs Agent: Backdoor/);
  await stub(page, 'abort');
  await page.goto('/?test=1&speed=0&mission=backdoor');
  await page.evaluate(() => (window as any).__AVA__.ready);
  await page.click('[data-testid="share-btn"]');
  await expect(page.locator('[data-testid="share-note"]')).toHaveText('Shared.');
  expect(await sent(page)).toEqual([]);
});

test('the daily link is pinned to its date, and the result card shares too', async ({
  page,
}, info) => {
  await stub(page, 'none');
  const day = '2026-03-10';
  // Reach a result card cheaply via the solution replay.
  await page.goto(`/?test=1&speed=0&mission=daily&day=${day}&solution=1`);
  // Locators retry across a late reload; a bare evaluate here raced one on slow runs.
  await expect(page.locator('#mission-result .stamp')).toHaveText('SOLUTION');
  await page.click('#mission-result [data-testid="share-btn"]');
  await expect(page.locator('#mission-result [data-testid="share-note"]')).toHaveText(
    'Link copied.',
  );
  const [msg] = await sent(page);
  expect(msg).toContain('mission=daily&day=2026-03-10');
  expect(msg).toContain('Agent vs Agent Daily 2026-03-10');
  await shot(page, info, 'share-result');
});

test('share button fits small screens', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'viewport sweep runs once');
  for (const [w, h] of [
    [320, 568],
    [667, 375],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/?test=1&speed=0&mission=double-tap');
    await page.evaluate(() => (window as any).__AVA__.ready);
    const b = (await page.locator('[data-testid="share-btn"]').boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(w);
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
