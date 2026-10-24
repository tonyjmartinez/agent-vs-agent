import { describe, expect, it } from 'vitest';
import { mulberry32, pick } from '../ai/rng';
import { applyAction, createGame, legalActions } from './engine';
import { duelRules } from './rules';
import { decode } from './serialize';
import { addAction, emptyStats, type MatchStats } from './stats';

const play = (code: string, spyId: string, r: number, c: number) => {
  const s = decode(code);
  const { events } = applyAction(s, { kind: 'move', spyId, to: { r, c } });
  return { s, events };
};

describe('addAction', () => {
  it('starts empty, one row per player, and never mutates its input', () => {
    const z = emptyStats(2);
    expect(z).toEqual([
      { turns: 0, burns: 0, burned: 0, steals: 0, extractions: 0 },
      { turns: 0, burns: 0, burned: 0, steals: 0, extractions: 0 },
    ]);
    const { s, events } = play('v1.0.0.0-0.22,54,02,04.33', 'p0a', 1, 2);
    const before = JSON.stringify(z);
    addAction(z, s, events);
    expect(JSON.stringify(z)).toBe(before);
    expect(emptyStats(4)).toHaveLength(4);
  });

  it('counts a plain move as a turn only', () => {
    const { s, events } = play('v1.0.0.0-0.51,54,01,04.2233', 'p0a', 4, 1);
    const st = addAction(emptyStats(2), s, events);
    expect(st[0]).toEqual({ turns: 1, burns: 0, burned: 0, steals: 0, extractions: 0 });
    expect(st[1]).toEqual({ turns: 0, burns: 0, burned: 0, steals: 0, extractions: 0 });
  });

  it('credits a burn to the mover and a loss to the victim', () => {
    // Red steps to (1,2), shoving Teal's (0,2) spy off the top edge.
    const { s, events } = play('v1.0.0.0-0.21,54,02,04.33', 'p0a', 1, 2);
    expect(events.some((e) => e.t === 'burned')).toBe(true);
    const st = addAction(emptyStats(2), s, events);
    expect(st[0]).toMatchObject({ turns: 1, burns: 1, burned: 0 });
    expect(st[1]).toMatchObject({ turns: 0, burns: 0, burned: 1 });
  });

  it('does not credit a burn when you bump your own spy off the board', () => {
    // Red's p0b sits on the left edge at (3,0); Red's p0a steps to (3,1) and shoves it west off the board.
    const { s, events } = play('v1.0.0.0-0.41,30,02,04.33', 'p0a', 3, 1);
    expect(events.filter((e) => e.t === 'burned')).toHaveLength(1);
    const st = addAction(emptyStats(2), s, events);
    expect(st[0]).toMatchObject({ burns: 0, burned: 1 });
    expect(st[1]).toMatchObject({ burns: 0, burned: 0 });
  });

  it('counts a steal when you bump an enemy carrier, not when you bump your own', () => {
    // Teal carrier at (3,3); Red arrives at (3,2) and bumps it east, so it drops the intel.
    const enemy = play('v1.0.0.0-0.31,54,33*,04.22', 'p0a', 3, 2);
    expect(enemy.events.some((e) => e.t === 'dropped')).toBe(true);
    const st = addAction(emptyStats(2), enemy.s, enemy.events);
    expect(st[0]).toMatchObject({ steals: 1, burns: 0 });
    expect(st[1]!.steals).toBe(0);
    // Red's own carrier at (3,3) gets bumped by Red's other spy: a drop, but not a steal.
    const own = play('v1.0.0.0-0.31,33*,02,04.22', 'p0a', 3, 2);
    expect(own.events.some((e) => e.t === 'dropped')).toBe(true);
    expect(addAction(emptyStats(2), own.s, own.events)[0]!.steals).toBe(0);
  });

  it('credits an extraction to the banking player', () => {
    const { s, events } = play('v1.0.0.0-0.41*,54,02,04.33', 'p0a', 5, 1);
    const st = addAction(emptyStats(2), s, events);
    expect(st[0]).toMatchObject({ turns: 1, extractions: 1 });
    expect(st[1]!.extractions).toBe(0);
  });

  it('credits the owner, not the mover, when a bump lets the opponent bank', () => {
    // Teal spy at (1,3) is shoved onto dropped intel at (0,3) in its own zone and banks it.
    const { s, events } = play('v1.0.0.0-0.22,54,13,04.03', 'p0a', 2, 3);
    const ex = events.find((e) => e.t === 'extracted');
    expect(ex).toBeTruthy();
    const st = addAction(emptyStats(2), s, events);
    expect(st[1]!.extractions).toBe(1);
    expect(st[0]!.extractions).toBe(0);
  });
});

describe('stats over whole games (property)', () => {
  it('always agree with the engine: 300 seeded random games', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = mulberry32(seed);
      let s = createGame(duelRules());
      let stats: MatchStats = emptyStats(2);
      let burnedEvents = 0;
      let droppedEvents = 0;
      let selfBurns = 0;
      while (s.winner === null) {
        const a = pick(rng, legalActions(s));
        const { state, events } = applyAction(s, a);
        stats = addAction(stats, s, events);
        for (const e of events) {
          if (e.t === 'burned') {
            burnedEvents++;
            if (s.spies.find((x) => x.id === e.spyId)!.owner === s.current) selfBurns++;
          }
          if (e.t === 'dropped') droppedEvents++;
        }
        s = state;
      }
      const sum = (f: (p: MatchStats[number]) => number) => stats.reduce((n, p) => n + f(p), 0);
      expect(
        sum((p) => p.turns),
        `seed ${seed} turns`,
      ).toBe(s.ply);
      expect(
        sum((p) => p.extractions),
        `seed ${seed} extractions`,
      ).toBe(s.scores.reduce((x, y) => x + y, 0));
      stats.forEach((p, i) => expect(p.extractions).toBe(s.scores[i]));
      expect(
        sum((p) => p.burned),
        `seed ${seed} burned`,
      ).toBe(burnedEvents);
      expect(
        sum((p) => p.burns),
        `seed ${seed} burns`,
      ).toBe(burnedEvents - selfBurns);
      expect(sum((p) => p.steals)).toBeLessThanOrEqual(droppedEvents);
    }
  });
});
