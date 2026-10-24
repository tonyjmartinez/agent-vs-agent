import { expect, test } from 'vitest';
import { parseConfig } from './config';

test('parses URL params with defaults', () => {
  const c = parseConfig('?seed=42&p0=human&p1=bot:hard&speed=0&test=1');
  expect(c.seed).toBe(42);
  expect(c.seats).toEqual([{ kind: 'human' }, { kind: 'bot', level: 'hard' }]);
  expect(c.speed).toBe(0);
  expect(c.test).toBe(true);
  expect(c.direct).toBe(true);
  const d = parseConfig('');
  expect(d.seats).toEqual([{ kind: 'human' }, { kind: 'human' }]);
  expect(d.speed).toBe(1);
  expect(d.direct).toBe(false);
  expect(parseConfig('?p1=bot:nope').seats[1]).toEqual({ kind: 'human' });
  expect(parseConfig('?rules=escort,bogus,fumble&win=2').rules).toEqual({
    escort: true,
    fumble: true,
    intelToWin: 2,
  });
  expect(parseConfig('').rules).toEqual({});
});

test('mission and solution params', () => {
  const m = parseConfig('?mission=double-tap');
  expect(m.mission).toBe('double-tap');
  expect(m.solution).toBe(false);
  expect(m.direct).toBe(true); // a mission link skips the menu
  expect(parseConfig('?mission=double-tap&solution=1').solution).toBe(true);
  expect(parseConfig('?mission=double-tap&solution=yes').solution).toBe(false);
  expect(parseConfig('').mission).toBeNull();
  expect(parseConfig('').solution).toBe(false);
});

test('day param: only real calendar dates are accepted', () => {
  expect(parseConfig('?mission=daily&day=2026-03-10').day).toBe('2026-03-10');
  expect(parseConfig('?mission=daily').day).toBeNull();
  for (const bad of ['2026-02-30', '2026-13-01', 'today', '', '2026-3-1', '2026-03-10T00:00']) {
    expect(parseConfig(`?mission=daily&day=${bad}`).day, bad).toBeNull();
  }
  expect(parseConfig('?mission=daily').mission).toBe('daily');
});
