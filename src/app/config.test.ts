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
});
