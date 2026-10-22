import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../ai/rng';
import { applyAction, createGame, legalActions } from './engine';
import { duelRules } from './rules';
import type { GameState } from './types';

function must(ok: boolean, msg: string): void {
  if (!ok) throw new Error(`invariant broken: ${msg}`);
}

function check(s: GameState, prevScores: number[]): void {
  const cells = new Set<number>();
  for (const p of s.spies) {
    if (p.pos) {
      const k = p.pos.r * 6 + p.pos.c;
      must(p.pos.r >= 0 && p.pos.r < 6 && p.pos.c >= 0 && p.pos.c < 6, 'spy off board');
      must(!cells.has(k), 'spies overlap');
      cells.add(k);
    } else {
      must(!p.carrying, 'reserve spy carrying');
    }
  }
  const intel = new Set(s.intel.map((c) => c.r * 6 + c.c));
  must(intel.size === s.intel.length, 'two intel on one cell');
  const carriers = s.spies.filter((p) => p.carrying).length;
  must(s.intel.length + carriers === s.rules.intelOnBoard, 'intel not conserved');
  s.scores.forEach((v, i) => must(v >= prevScores[i]!, 'score decreased'));
}

describe('property: random self-play', () => {
  it('holds the invariants over 2000 seeded games and every game terminates', () => {
    const wins = [0, 0];
    let draws = 0;
    for (let seed = 1; seed <= 2000; seed++) {
      const rnd = mulberry32(seed);
      let s = createGame();
      check(s, [0, 0]);
      let plies = 0;
      while (s.winner === null) {
        const acts = legalActions(s);
        expect(acts.length).toBeGreaterThan(0);
        const prev = s.scores;
        s = applyAction(s, acts[Math.floor(rnd() * acts.length)]!).state;
        check(s, prev);
        plies++;
        expect(plies).toBeLessThanOrEqual(s.rules.maxPlies);
      }
      expect(s.ply).toBeLessThanOrEqual(120);
      if (s.winner === 'draw') draws++;
      else wins[s.winner]!++;
    }
    expect(wins[0]! + wins[1]! + draws).toBe(2000);
  });

  it('also holds for orthogonal movement and no friendly bumps', () => {
    const rules = duelRules({ movement: 'orthogonal', bumpOwnSpies: false, maxPlies: 80 });
    for (let seed = 1; seed <= 200; seed++) {
      const rnd = mulberry32(seed);
      let s = createGame(rules);
      while (s.winner === null) {
        const acts = legalActions(s);
        const prev = s.scores;
        s = applyAction(s, acts[Math.floor(rnd() * acts.length)]!).state;
        check(s, prev);
      }
    }
  });

  it('is deterministic for a given seed', () => {
    const run = () => {
      const rnd = mulberry32(42);
      let s = createGame();
      while (s.winner === null) {
        const acts = legalActions(s);
        s = applyAction(s, acts[Math.floor(rnd() * acts.length)]!).state;
      }
      return JSON.stringify(s);
    };
    expect(run()).toBe(run());
  });
});
