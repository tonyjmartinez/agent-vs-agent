import { describe, expect, it } from 'vitest';
import { applyAction, createGame, legalActions } from './engine';
import { fromCompact, fromJSON, toCompact, toJSON } from './serialize';
import { board } from './testing';

const play = (n: number) => {
  let s = createGame();
  for (let i = 0; i < n; i++)
    s = applyAction(s, legalActions(s)[i % 3 === 0 ? 0 : legalActions(s).length - 1]!).state;
  return s;
};

describe('serialize', () => {
  it('round-trips JSON', () => {
    const s = play(15);
    expect(fromJSON(toJSON(s))).toEqual(s);
  });

  it('round-trips the compact form, including reserve, carriers and winners', () => {
    for (const s of [
      createGame(),
      play(9),
      board('. . . . . .\n. . . . . .\n. . . . . .\n. . R* . . .\n. . . . . .\n. . . . . .'),
    ]) {
      expect(fromCompact(toCompact(s), s.rules)).toEqual({ ...s, ply: s.ply });
    }
    const done = { ...play(3), winner: 0 as const };
    expect(fromCompact(toCompact(done)).winner).toBe(0);
    expect(fromCompact(toCompact({ ...done, winner: 'draw' })).winner).toBe('draw');
  });

  it('has a stable, documented shape', () => {
    expect(toCompact(createGame())).toBe('1;0;0;0,0;-;p0a@51,p0b@54,p1a@01,p1b@04;22,33');
  });

  it('rejects inconsistent states', () => {
    const s = createGame();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bad = (f: (x: any) => void) => {
      const x = JSON.parse(toJSON(s));
      f(x);
      return () => fromJSON(JSON.stringify(x));
    };
    expect(bad((x) => (x.spies[0].pos = x.spies[1].pos))).toThrow(/overlapping/);
    expect(bad((x) => (x.spies[0].pos = { r: 9, c: 0 }))).toThrow(/position/);
    expect(bad((x) => (x.intel = [x.intel[0], x.intel[0]]))).toThrow(/two intel/);
    expect(bad((x) => (x.intel = [{ r: -1, c: 0 }]))).toThrow(/off board/);
    expect(bad((x) => (x.current = 5))).toThrow(/current/);
    expect(bad((x) => (x.scores = [0]))).toThrow(/scores/);
    expect(bad((x) => (x.ply = -1))).toThrow(/ply/);
    expect(bad((x) => (x.spies[0].owner = 4))).toThrow(/owner/);
    expect(bad((x) => ((x.spies[0].pos = null), (x.spies[0].carrying = true)))).toThrow(/reserve/);
    expect(() => fromJSON('null')).toThrow();
    expect(() => fromCompact('garbage')).toThrow(/compact/);
    expect(() => fromCompact('1;0;0;0,0;-;zz;22')).toThrow(/spy/);
    expect(() => fromCompact('1;0;0;0,0;-;p0a@51;9')).toThrow(/cell/);
    expect(() => fromCompact('1;0;0;0,0;-;p0a@5;22')).toThrow(/spy/);
    expect(() => fromCompact('1;0;0;0,0;-;p0a@51,p0b@51;22')).toThrow(/overlapping/);
  });

  it('parses an empty intel list', () => {
    expect(fromCompact('1;0;0;0,0;-;p0a@51;').intel).toEqual([]);
  });
});
