import { describe, expect, test } from 'vitest';
import { eq } from './board';
import { applyAction, createGame, hash, legalActions } from './engine';
import { duelRules } from './rules';
import { decode, encode, fromJSON, toJSON } from './serialize';
import type { GameState } from './types';

/** Tiny local PRNG so engine tests do not depend on ai/. */
function lcg(seed: number) {
  let x = seed >>> 0;
  return () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function checkInvariants(s: GameState, prev: GameState) {
  const cells = s.intel.map((c) => `${c.r}${c.c}`);
  assert(new Set(cells).size === cells.length, 'intel overlap');
  const spyCells = s.spies.filter((x) => x.pos).map((x) => `${x.pos!.r}${x.pos!.c}`);
  assert(new Set(spyCells).size === spyCells.length, 'spies overlap');
  for (const x of s.spies) {
    if (x.pos) assert(x.pos.r >= 0 && x.pos.r < 6 && x.pos.c >= 0 && x.pos.c < 6, 'off board');
    else assert(!x.carrying, 'reserve spy carrying');
    if (x.carrying) assert(!s.intel.some((i) => eq(i, x.pos)), 'carrier on intel');
  }
  assert(
    s.intel.length + s.spies.filter((x) => x.carrying).length === s.rules.intelOnBoard,
    'intel conservation',
  );
  s.scores.forEach((sc, i) => assert(sc >= prev.scores[i]!, 'score decreased'));
}

describe('random-play invariants', () => {
  test('2,000 random games keep every invariant and terminate by maxPlies', () => {
    const rules = duelRules();
    const rnd = lcg(12345);
    let extractions = 0;
    let burns = 0;
    for (let g = 0; g < 2000; g++) {
      let s = createGame(rules);
      let steps = 0;
      while (s.winner === null) {
        const acts = legalActions(s);
        const a = acts[Math.floor(rnd() * acts.length)]!;
        const { state, events } = applyAction(s, a);
        extractions += events.filter((e) => e.t === 'extracted').length;
        burns += events.filter((e) => e.t === 'burned').length;
        // events are grouped in non-decreasing phase order
        for (let i = 1; i < events.length; i++)
          assert(events[i]!.phase >= events[i - 1]!.phase, 'phase order');
        checkInvariants(state, s);
        s = state;
        assert(++steps <= rules.maxPlies, 'did not terminate');
      }
    }
    expect(extractions).toBeGreaterThan(0);
    expect(burns).toBeGreaterThan(0);
  }, 120_000);
});

describe('serialize', () => {
  test('round-trips JSON and the compact string through random play', () => {
    const rnd = lcg(7);
    let s = createGame(duelRules());
    expect(encode(s)).toBe('v1.0.0.0-0.51,54,01,04.2233');
    for (let i = 0; i < 300 && s.winner === null; i++) {
      const acts = legalActions(s);
      s = applyAction(s, acts[Math.floor(rnd() * acts.length)]!).state;
      expect(fromJSON(toJSON(s))).toEqual(s);
      if (s.winner === null) {
        const d = decode(encode(s));
        expect(hash(d)).toBe(hash(s));
        expect(d.ply).toBe(s.ply);
      }
    }
  });

  test('rejects garbage', () => {
    expect(() => decode('nope')).toThrow();
    expect(() => decode('v1.0.0.0-0.51,54.')).toThrow();
  });
});

describe('random-play invariants under experimental rule flags', () => {
  const variants: [string, Partial<import('./types').Rules>][] = [
    ['sprint', { sprint: true }],
    ['fumble', { fumble: true }],
    ['escort', { escort: true }],
    ['sprint+fumble', { sprint: true, fumble: true }],
    ['keep-on-shove', { dropOnBump: false }],
  ];
  test.each(variants)(
    '%s: 300 random games keep every invariant',
    (_name, patch) => {
      const rules = duelRules(patch);
      const rnd = lcg(99);
      for (let g = 0; g < 300; g++) {
        let s = createGame(rules);
        while (s.winner === null) {
          const acts = legalActions(s);
          const { state } = applyAction(s, acts[Math.floor(rnd() * acts.length)]!);
          checkInvariants(state, s);
          s = state;
        }
      }
    },
    60_000,
  );
});
