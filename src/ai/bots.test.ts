import { describe, expect, it } from 'vitest';
import { applyAction, createGame, legalActions } from '../engine/engine';
import { board } from '../engine/testing';
import type { Action, GameState } from '../engine/types';
import { BOT_LEVELS, makeBot, type BotLevel } from './bots';
import { WIN, evaluate } from './evaluate';
import { mulberry32 } from './rng';
import { playGame, runSim, wilson } from './simulate';
import { search } from './search';

const g = (cells: Record<string, string>): string =>
  Array.from({ length: 6 }, (_, r) =>
    Array.from({ length: 6 }, (_, c) => cells[`${r},${c}`] ?? '.').join(' '),
  ).join('\n');
const fast = { maxNodes: 1500, timeMs: Infinity };
const same = (a: Action, b: Action) => JSON.stringify(a) === JSON.stringify(b);
const shuffleNone = <T>(xs: T[]): T[] => xs;

function playOut(level: BotLevel, seed: number, maxPlies = 60): Action[] {
  const bots = [makeBot(level, seed, fast), makeBot(level, seed + 1, fast)];
  const rnd = mulberry32(seed);
  let s: GameState = createGame();
  const log: Action[] = [];
  while (s.winner === null && s.ply < maxPlies) {
    const a =
      s.ply < 2
        ? legalActions(s)[Math.floor(rnd() * legalActions(s).length)]!
        : bots[s.current]!.choose(s);
    expect(legalActions(s).some((x) => same(x, a))).toBe(true); // bots only return legal actions
    log.push(a);
    s = applyAction(s, a).state;
  }
  return log;
}

describe('bots', () => {
  it.each(BOT_LEVELS.map((l) => [l]))('%s only plays legal actions', (level) => {
    for (const seed of [1, 2, 3]) playOut(level, seed);
  });

  it.each(BOT_LEVELS.map((l) => [l]))(
    '%s is deterministic for a seed and varies across seeds',
    (level) => {
      expect(playOut(level, 7)).toEqual(playOut(level, 7));
      if (level !== 'hard' && level !== 'medium') {
        expect(JSON.stringify(playOut(level, 7))).not.toBe(JSON.stringify(playOut(level, 8)));
      }
    },
  );

  it('refuses to choose when the game is over', () => {
    expect(() => makeBot('random', 1).choose({ ...createGame(), winner: 0 })).toThrow(/no legal/);
  });

  it('takes an immediate winning extraction (hard and medium)', () => {
    const s = board(g({ '4,2': 'R*', '3,3': 'i', '0,1': 'T', '0,4': 'T' }), { scores: [2, 0] });
    for (const level of ['medium', 'hard'] as const) {
      const a = makeBot(level, 3, fast).choose(s);
      expect(applyAction(s, a).state.winner).toBe(0);
    }
  });

  it('wins even when a distraction is on offer (a burn is available too)', () => {
    const s = board(g({ '4,2': 'R*', '5,5': 'T', '3,3': 'i', '0,1': 'T' }), { scores: [2, 0] });
    const a = makeBot('hard', 5, fast).choose(s);
    expect(applyAction(s, a).state.winner).toBe(0);
  });

  it('hard avoids leaving a spy where it can be burned next move when a safe move exists', () => {
    // Red spy on the left edge with a Teal spy two cells away: stepping Teal to (4,1) would burn it.
    const s = board(g({ '4,0': 'R', '4,2': 'T', '0,4': 'T', '2,3': 'i', '3,3': 'i' }));
    const burnable = (st: GameState) =>
      legalActions(st).some((r) =>
        applyAction(st, r).events.some(
          (e) => e.t === 'burned' && st.spies.find((p) => p.id === e.spyId)!.owner === 0,
        ),
      );
    const safe = legalActions(s).filter((a) => !burnable(applyAction(s, a).state));
    expect(safe.length).toBeGreaterThan(0);
    expect(safe.length).toBeLessThan(legalActions(s).length); // the test is meaningful
    for (const seed of [1, 2, 3, 4]) {
      const a = makeBot('hard', seed, fast).choose(s);
      expect(burnable(applyAction(s, a).state)).toBe(false);
    }
  });

  it('hard burns an enemy when it is free to do so', () => {
    const s = board(g({ '2,2': 'R', '0,2': 'T', '5,4': 'R', '0,5': 'T' }));
    const a = makeBot('hard', 1, fast).choose(s);
    const { events } = applyAction(s, a);
    expect(events.some((e) => e.t === 'burned')).toBe(true);
  });
});

describe('evaluate', () => {
  it('scores terminal positions as +-(WIN - ply) and draws as 0', () => {
    const s = createGame();
    expect(evaluate({ ...s, winner: 0, ply: 10 }, 0)).toBe(WIN - 10);
    expect(evaluate({ ...s, winner: 1, ply: 10 }, 0)).toBe(-(WIN - 10));
    expect(evaluate({ ...s, winner: 'draw' }, 0)).toBe(0);
  });

  it('is zero-sum symmetric at the start and prefers carrying, scoring and a full roster', () => {
    const s = createGame();
    expect(evaluate(s, 0) + evaluate(s, 1)).toBeCloseTo(0, 5);
    const plain = board(g({ '3,2': 'R', '0,4': 'T' }));
    const carrying = board(g({ '3,2': 'R*', '0,4': 'T' }));
    const scored = board(g({ '3,2': 'R', '0,4': 'T' }), { scores: [1, 0] });
    expect(evaluate(carrying, 0)).toBeGreaterThan(evaluate(plain, 0));
    expect(evaluate(scored, 0)).toBeGreaterThan(evaluate(plain, 0) + 500);
    const burned = board(g({ '3,2': 'R', '0,4': 'T', '0,1': 'T' }));
    expect(evaluate(burned, 0)).toBeLessThan(evaluate(plain, 0) + 500); // more enemies on board is worse for Red
  });

  it('seeks intel and fears an edge bump', () => {
    const near = board(g({ '3,2': 'R', '2,2': 'i', '0,5': 'T' }));
    const far = board(g({ '5,5': 'R', '2,2': 'i', '0,5': 'T' }));
    expect(evaluate(near, 0)).toBeGreaterThan(evaluate(far, 0));
    const threatened = board(g({ '4,0': 'R', '4,2': 'T' }));
    const sheltered = board(g({ '4,0': 'R', '1,3': 'T' }));
    expect(evaluate(threatened, 0)).toBeLessThan(evaluate(sheltered, 0));
  });

  it('three-player positions average opponents', () => {
    const s = createGame();
    expect(
      Number.isFinite(
        evaluate(
          {
            ...s,
            rules: { ...s.rules, players: [...s.rules.players, s.rules.players[0]!] },
            scores: [0, 0, 0],
          },
          0,
        ),
      ),
    ).toBe(true);
  });
});

describe('search', () => {
  const s = createGame();
  it('honours the node budget and always returns a legal move', () => {
    const r = search(s, { maxDepth: 6, maxNodes: 300, timeMs: Infinity }, shuffleNone);
    expect(r.depth).toBeGreaterThanOrEqual(1);
    expect(legalActions(s).some((a) => same(a, r.action))).toBe(true);
    expect(r.nodes).toBeLessThan(2000);
  });

  it('searches deeper with a bigger budget and stops early on a forced win', () => {
    const shallow = search(s, { maxDepth: 2, maxNodes: Infinity, timeMs: Infinity }, shuffleNone);
    expect(shallow.depth).toBe(2);
    const win = board(g({ '4,2': 'R*', '3,3': 'i', '0,1': 'T' }), { scores: [2, 0] });
    const r = search(win, { maxDepth: 6, maxNodes: Infinity, timeMs: Infinity }, shuffleNone);
    expect(r.depth).toBeLessThan(6);
    expect(r.value).toBeGreaterThan(50_000);
  });

  it('a root bias steers the choice away from a penalised move', () => {
    const budget = { maxDepth: 2, maxNodes: Infinity, timeMs: Infinity };
    const first = search(s, budget, shuffleNone);
    const biased = search(s, budget, shuffleNone, undefined, (after) =>
      JSON.stringify(after) === JSON.stringify(applyAction(s, first.action).state) ? -1e6 : 0,
    );
    expect(same(biased.action, first.action)).toBe(false);
  });

  it('stops on the wall-clock deadline', () => {
    let t = 0;
    const r = search(
      s,
      { maxDepth: 8, maxNodes: Infinity, timeMs: 5 },
      shuffleNone,
      () => (t += 3),
    );
    expect(r.depth).toBeGreaterThanOrEqual(1);
    expect(r.depth).toBeLessThan(8);
  });

  it('rethrows unexpected errors instead of swallowing them', () => {
    const boom = () => {
      throw new Error('boom');
    };
    expect(() =>
      search(
        s,
        { maxDepth: 2, maxNodes: Infinity, timeMs: Infinity },
        shuffleNone,
        undefined,
        boom,
      ),
    ).toThrow(/boom/);
  });
});

describe('repetition memory', () => {
  it('reset() forgets history so the first choice repeats', () => {
    const bot = makeBot('medium', 5);
    const s = createGame();
    const first = bot.choose(s);
    bot.reset();
    expect(same(bot.choose(s), first)).toBe(true);
  });
});

describe('simulate', () => {
  it('plays complete, reproducible games and reports sane stats', () => {
    const a = runSim(
      { games: 6, p0: 'easy', p1: 'random', seed: 3, swap: true, rules: {}, randomPlies: 2 },
      () => 0,
    );
    const b = runSim(
      { games: 6, p0: 'easy', p1: 'random', seed: 3, swap: true, rules: {}, randomPlies: 2 },
      () => 0,
    );
    expect(a).toEqual(b);
    expect(a.aWins + a.bWins + a.draws).toBe(6);
    expect(a.seat0Wins + a.seat1Wins + a.draws).toBe(6);
    expect(a.medianPlies).toBeGreaterThan(0);
    expect(a.medianPlies).toBeLessThanOrEqual(120);
    expect(a.forcedPasses).toBe(0);
    expect(a.avgBranchingFactor).toBeGreaterThan(3);
  });

  it('applies rule overrides and random opening plies', () => {
    const o = runSim(
      {
        games: 4,
        p0: 'random',
        p1: 'random',
        seed: 1,
        swap: false,
        rules: { maxPlies: 10 },
        randomPlies: 2,
      },
      () => 0,
    );
    expect(o.p90Plies).toBeLessThanOrEqual(10);
    const st = playGame(
      [makeBot('random', 1), makeBot('random', 2)],
      createGame().rules,
      mulberry32(1),
      4,
      () => 0,
    );
    expect(st.moveMs[0].length + st.moveMs[1].length).toBe(st.plies - 4);
  });

  it('wilson interval brackets the proportion', () => {
    const [lo, hi] = wilson(50, 100);
    expect(lo).toBeLessThan(0.5);
    expect(hi).toBeGreaterThan(0.5);
    expect(wilson(0, 0)).toEqual([0, 0]);
  });
});
