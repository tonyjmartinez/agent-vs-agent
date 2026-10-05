import { describe, expect, test } from 'vitest';
import { add, cell, cheb, key, sub } from './board';
import { applyAction, createGame, legalActions } from './engine';
import { board } from './fixtures';
import { ffaRules } from './rules';

describe('board helpers', () => {
  test('arithmetic', () => {
    expect(add(cell(1, 2), cell(1, -1))).toEqual({ r: 2, c: 1 });
    expect(sub(cell(1, 2), cell(1, -1))).toEqual({ r: 0, c: 3 });
    expect(key(cell(3, 4))).toBe('3,4');
    expect(cheb(cell(0, 0), cell(2, 5))).toBe(5);
  });
});

describe('rule decisions', () => {
  test('a bumped spy can land on dropped intel on its own row and extract on your turn; if that wins, they win', () => {
    // Teal empty-handed at (1,2); intel lying on teal's row at (0,2). Red arrives at (2,2) and bumps teal up.
    const s = board(
      `
      . . i . . .
      . . T . . .
      . . . . . .
      . . R . . .
      . . . . . .
      . . . . . .`,
      { scores: [0, 2] },
    );
    const { state, events } = applyAction(s, { kind: 'move', spyId: 'p0a', to: { r: 2, c: 2 } });
    expect(events.map((e) => e.t)).toEqual([
      'moved',
      'bumped',
      'pickedUp',
      'extracted',
      'intelSpawned',
      'gameOver',
    ]);
    expect(state.winner).toBe(1);
  });

  test('any reserve spy id may be named in a deploy', () => {
    const s = board(
      `
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . . T`,
      { reserve: [0, 0] },
    );
    expect(() =>
      applyAction(s, { kind: 'deploy', spyId: 'p0b', to: { r: 5, c: 0 } }),
    ).not.toThrow();
    expect(() => applyAction(s, { kind: 'deploy', spyId: 'p1a', to: { r: 5, c: 0 } })).toThrow();
  });
});

describe('ffa preset', () => {
  test('4 players × 1 spy, turns rotate, zones are edge non-corners', () => {
    const r = ffaRules();
    const s = createGame(r);
    expect(s.spies.map((x) => x.id)).toEqual(['p0a', 'p1a', 'p2a', 'p3a']);
    expect(r.players[2]!.zone).toEqual([1, 2, 3, 4].map((x) => ({ r: x, c: 0 })));
    let t = s;
    for (let i = 0; i < 4; i++) t = applyAction(t, legalActions(t)[0]!).state;
    expect(t.current).toBe(0);
    expect(
      r.intelSpawnOrder.some((p) =>
        r.players.some((pl) => pl.zone.some((z) => z.r === p.r && z.c === p.c)),
      ),
    ).toBe(false);
  });
});
