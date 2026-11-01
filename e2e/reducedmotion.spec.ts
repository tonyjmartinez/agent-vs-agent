import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { shot, tapCell, trackErrors } from './helpers';

// Red carrier one step from home on 2 points; Red's other spy can burn Teal's edge spy at (0,2).
const URL = '/?test=1&speed=1&p0=human&p1=human&state=v1.0.0.2-0.41*,21,02,04.33';
const touch = (info: TestInfo) => !!info.project.use.hasTouch;

async function move(page: Page, info: TestInfo, from: [number, number], to: [number, number]) {
  await tapCell(page, info, from[0], from[1]);
  await tapCell(page, info, to[0], to[1]);
  if (touch(info)) await tapCell(page, info, to[0], to[1]);
  await page.evaluate(() => (window as any).__AVA__.idle());
}

/** Play a burn then a winning bank at real speed, counting camera shakes and confetti pieces (rectangles). */
async function playBurnAndBank(page: Page, info: TestInfo) {
  await page.goto(URL);
  await page.waitForFunction(() => !!(window as any).__AVA__);
  await page.evaluate(() => (window as any).__AVA__.ready);
  await page.evaluate(() => {
    const scene = (window as any).__AVA__.controller().o.view.scene;
    const probe = { shakes: 0, rects: 0 };
    (window as any).__probe = probe;
    const shake = scene.cameras.main.shake.bind(scene.cameras.main);
    scene.cameras.main.shake = (...a: unknown[]) => (probe.shakes++, shake(...a));
    const rect = scene.add.rectangle.bind(scene.add);
    scene.add.rectangle = (...a: unknown[]) => (probe.rects++, rect(...a));
  });
  const t0 = Date.now();
  await move(page, info, [2, 1], [1, 2]); // burn
  await move(page, info, [0, 4], [1, 4]); // Teal moves
  await move(page, info, [4, 1], [5, 1]); // bank for the win (confetti)
  const ms = Date.now() - t0;
  const probe = await page.evaluate(() => (window as any).__probe as { shakes: number; rects: number });
  return { ...probe, ms };
}

test('control: normal motion shakes the camera and throws confetti', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const r = await playBurnAndBank(page, info);
  expect(r.shakes).toBeGreaterThan(0);
  expect(r.rects).toBeGreaterThan(0);
});

test('prefers-reduced-motion: no camera shake, no confetti, pip pop animation off', async ({ page }, info) => {
  const errors = trackErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const r = await playBurnAndBank(page, info);
  expect(r.shakes).toBe(0);
  expect(r.rects).toBe(0);
  await expect(page.locator('#game-over')).toBeVisible();
  // The score pip that just popped must not run its 520 ms animation.
  const dur = await page.evaluate(() => {
    const pip = document.querySelector('.pip.new, .pip') as HTMLElement;
    return parseFloat(getComputedStyle(pip).animationDuration) * 1000;
  });
  expect(dur).toBeLessThanOrEqual(1);
  await shot(page, info, 'reduced-motion-game-over');
  expect(errors).toEqual([]);
});
