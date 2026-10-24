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
      {
        turns: 0,
        burns: 0,
        burned: 0,
        steals: 0,
        shoves: 0,
        dashes: 0,
        carry: 0,
        longestCarry: 0,
        extractions: 0,
      },
      {
        turns: 0,
        burns: 0,
        burned: 0,
        steals: 0,
        shoves: 0,
        dashes: 0,
        carry: 0,
        longestCarry: 0,
        extractions: 0,
      },
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
    expect(st[0]).toEqual({
      turns: 1,
      burns: 0,
      burned: 0,
      steals: 0,
      shoves: 0,
      dashes: 0,
      carry: 0,
      longestCarry: 0,
      extractions: 0,
    });
    expect(st[1]).toEqual({
      turns: 0,
      burns: 0,
      burned: 0,
      steals: 0,
      shoves: 0,
      dashes: 0,
      carry: 0,
      longestCarry: 0,
      extractions: 0,
    });
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

  it('counts a shove for each enemy spy bumped, not for your own or a blocked bump', () => {
    // Teal carrier at (3,3); Red arrives at (3,2) and bumps it east.
    const enemy = play('v1.0.0.0-0.31,54,33*,04.22', 'p0a', 3, 2);
    expect(enemy.events.some((e) => e.t === 'bumped')).toBe(true);
    const st = addAction(emptyStats(2), enemy.s, enemy.events);
    expect(st[0]!.shoves).toBe(1);
    expect(st[1]!.shoves).toBe(0);
    // Red's own spy at (3,3) shoved by Red's other spy: not a shove.
    const own = play('v1.0.0.0-0.31,33*,02,04.22', 'p0a', 3, 2);
    expect(own.events.some((e) => e.t === 'bumped')).toBe(true);
    expect(addAction(emptyStats(2), own.s, own.events)[0]!.shoves).toBe(0);
  });

  it('counts a carrier sprint as a dash and a one-square step as nothing', () => {
    // Red's carrier at (3,3) sprints two squares south to (5,3); Red's other spy steps one square.
    const dash = play('v1.0.6.0-0.51,33*,12,04.22', 'p0b', 5, 3);
    expect(dash.events.some((e) => e.t === 'moved')).toBe(true);
    const st = addAction(emptyStats(2), dash.s, dash.events);
    expect(st[0]).toMatchObject({ turns: 1, dashes: 1 });
    expect(st[1]!.dashes).toBe(0);
    const step = play('v1.0.6.0-0.51,33*,12,04.22', 'p0b', 4, 3);
    expect(addAction(emptyStats(2), step.s, step.events)[0]!.dashes).toBe(0);
    const other = play('v1.0.6.0-0.51,33*,12,04.22', 'p0a', 4, 1);
    expect(addAction(emptyStats(2), other.s, other.events)[0]!.dashes).toBe(0);
  });

  it('counts consecutive turns that start with intel in hand, and restarts after it is lost', () => {
    // Red carrier at (2,1) walks (3,1), (4,1), then banks at (5,1); Teal shuffles a far spy in between.
    let s = decode('v1.0.0.0-0.21*,45,03,05.33');
    let st = emptyStats(2);
    const red = (r: number, c: number) => {
      const a = { kind: 'move', spyId: 'p0a', to: { r, c } } as const;
      const { state, events } = applyAction(s, a);
      st = addAction(st, s, events);
      s = state;
    };
    const teal = () => {
      const a = legalActions(s).find((x) => x.kind === 'move' && x.spyId === 'p1a')!;
      const { state, events } = applyAction(s, a);
      st = addAction(st, s, events);
      s = state;
    };
    red(3, 1);
    expect(st[0]).toMatchObject({ carry: 1, longestCarry: 1 });
    teal();
    red(4, 1);
    expect(st[0]).toMatchObject({ carry: 2, longestCarry: 2 });
    teal();
    red(5, 1); // banks: the turn still started with intel in hand
    expect(st[0]).toMatchObject({ carry: 3, longestCarry: 3, extractions: 1 });
    // Teal never carried.
    expect(st[1]).toMatchObject({ carry: 0, longestCarry: 0 });
    // Next Red turn starts empty-handed: the run restarts, the record stays.
    teal();
    const a = legalActions(s).find((x) => x.kind === 'move')!;
    const { events } = applyAction(s, a);
    st = addAction(st, s, events);
    expect(st[0]).toMatchObject({ carry: 0, longestCarry: 3 });
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
    let totalDashes = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const rng = mulberry32(seed);
      let s = createGame(duelRules());
      let stats: MatchStats = emptyStats(2);
      let burnedEvents = 0;
      let droppedEvents = 0;
      let selfBurns = 0;
      let enemyShoves = 0;
      let dashEvents = 0;
      const run = [0, 0];
      const best = [0, 0];
      while (s.winner === null) {
        const a = pick(rng, legalActions(s));
        const { state, events } = applyAction(s, a);
        stats = addAction(stats, s, events);
        {
          const me = s.current;
          if (s.spies.some((x) => x.owner === me && x.carrying && x.pos)) {
            run[me]!++;
            best[me] = Math.max(best[me]!, run[me]!);
          } else run[me] = 0;
        }
        for (const e of events) {
          if (e.t === 'burned') {
            burnedEvents++;
            if (s.spies.find((x) => x.id === e.spyId)!.owner === s.current) selfBurns++;
          }
          if (e.t === 'dropped') droppedEvents++;
          if (
            e.t === 'moved' &&
            Math.max(Math.abs(e.to.r - e.from.r), Math.abs(e.to.c - e.from.c)) === 2
          ) {
            dashEvents++;
          }
          if (e.t === 'bumped' && s.spies.find((x) => x.id === e.spyId)!.owner !== s.current) {
            enemyShoves++;
          }
        }
        s = state;
      }
      const sum = (f: (p: MatchStats[number]) => number) => stats.reduce((n, p) => n + f(p), 0);
      expect(
        sum((p) => p.turns),
        `seed ${seed} turns`,
      ).toBe(s.ply);
      expect(
        stats.map((p) => p.longestCarry),
        `seed ${seed} longest carry`,
      ).toEqual(best);
      for (const p of stats) expect(p.longestCarry).toBeLessThanOrEqual(p.turns);
      expect(
        sum((p) => p.dashes),
        `seed ${seed} dashes`,
      ).toBe(dashEvents);
      expect(
        sum((p) => p.shoves),
        `seed ${seed} shoves`,
      ).toBe(enemyShoves);
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
      totalDashes += dashEvents;
    }
    // The property is not vacuous: random play does sprint.
    expect(totalDashes).toBeGreaterThan(0);
  });
});
