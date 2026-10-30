import { test, expect } from '@playwright/test';
import { MISSIONS, type Mission } from '../src/missions';
import { shot, trackErrors } from './helpers';
import { openMission, solve } from './missionHelpers';

// A mission that leaves room to beat a stored best (budget above one move).
const m: Mission = MISSIONS.find((x) => x.moves >= 2)!;

async function seedBest(page: import('@playwright/test').Page, id: string, best: number) {
  await page.addInitScript(
    ([k, v]) => {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {
        /* ignore */
      }
    },
    ['ava.missionBest.v1', { [id]: best }] as const,
  );
}

test('a win that beats the stored best says "New best!" on the result card', async ({
  page,
}, info) => {
  const errors = trackErrors(page);
  await seedBest(page, m.id, m.moves + 1); // any win within budget beats this
  await openMission(page, m);
  await solve(page, info, m);
  const sub = page.locator('#mission-result .stamp-card > .sub:not(.share-note)');
  await expect(sub).toBeVisible();
  const text = (await sub.textContent()) ?? '';
  const used = Number(/Solved in (\d+) of/.exec(text)?.[1]);
  expect(used).toBeGreaterThan(0);
  expect(used).toBeLessThan(m.moves + 1);
  expect(text).toContain('New best!');
  await shot(page, info, 'newbest-result');
  expect(errors).toEqual([]);
});

test('a win that does not beat the stored best has no "New best!"', async ({ page }, info) => {
  const errors = trackErrors(page);
  await seedBest(page, m.id, 1); // a win needs at least one move, so nothing beats 1
  await openMission(page, m);
  await solve(page, info, m);
  await expect(page.locator('#mission-result .stamp-card > .sub:not(.share-note)')).toContainText(
    'Solved in',
  );
  await expect(
    page.locator('#mission-result .stamp-card > .sub:not(.share-note)'),
  ).not.toContainText('New best!');
  expect(errors).toEqual([]);
});

test('a first win (no stored best) does not claim "New best!"', async ({ page }, info) => {
  const errors = trackErrors(page);
  await openMission(page, m);
  await solve(page, info, m);
  await expect(page.locator('#mission-result .stamp-card > .sub:not(.share-note)')).toContainText(
    'Solved in',
  );
  await expect(
    page.locator('#mission-result .stamp-card > .sub:not(.share-note)'),
  ).not.toContainText('New best!');
  expect(errors).toEqual([]);
});
