import { expect, test } from 'vitest';
import { mayVibrate } from './sound';

test('vibrate only with a vibrate API and, where known, a prior user gesture', () => {
  const v = () => true;
  expect(mayVibrate({})).toBe(false); // iOS Safari: no API
  expect(mayVibrate({ vibrate: 'nope' })).toBe(false);
  expect(mayVibrate({ vibrate: v })).toBe(true); // no activation API: previous behaviour
  expect(mayVibrate({ vibrate: v, userActivation: { hasBeenActive: false } })).toBe(false);
  expect(mayVibrate({ vibrate: v, userActivation: { hasBeenActive: true } })).toBe(true);
});
