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

describe('dropOnBump=false (experimental knob)', () => {
  const opts = { rules: { dropOnBump: false } };
  test('a shoved carrier keeps its intel', () => {
    const s = board(
      `
      . . . . . .
      . . . . . .
      . R . T* . .
      . . . . . .
      . . . . . .
      . . . . . .`,
      opts,
    );
    const { state, events } = applyAction(s, { kind: 'move', spyId: 'p0a', to: { r: 2, c: 2 } });
    expect(events.map((e) => e.t)).toEqual(['moved', 'bumped']);
    expect(state.spies.find((x) => x.id === 'p1a')).toMatchObject({
      pos: { r: 2, c: 4 },
      carrying: true,
    });
  });
  test('a burned carrier still drops; a carrier cannot be shoved onto intel', () => {
    const s = board(
      `
      . . T* . . .
      . . . . . .
      . R . T* i .
      . . . . . .
      . . . . . .
      . . . . . .`,
      opts,
    );
    const { state, events } = applyAction(s, { kind: 'move', spyId: 'p0a', to: { r: 1, c: 2 } });
    // (0,2) is burned and drops; (2,3) is shoved diagonally to (3,4) and keeps its intel.
    expect(events.map((e) => e.t)).toEqual(['moved', 'dropped', 'burned', 'bumped']);
    expect(state.intel).toContainEqual({ r: 0, c: 2 });
    expect(state.spies.find((x) => x.id === 'p1b')).toMatchObject({
      pos: { r: 3, c: 4 },
      carrying: true,
    });
    const b = applyAction(s, { kind: 'move', spyId: 'p0a', to: { r: 2, c: 2 } });
    expect(b.events.map((e) => e.t).slice(0, 2)).toEqual(['moved', 'bumpBlocked']);
    expect(b.state.spies.find((x) => x.id === 'p1b')).toMatchObject({
      pos: { r: 2, c: 3 },
      carrying: true,
    });
  });
});

describe('fumble (experimental knob)', () => {
  test('the team that dropped intel cannot re-grab it on its next turn; the other team can', () => {
    const s = board(
      `
      . . . . . .
      . . . . . .
      . R . T* . .
      . . . . . .
      . . . . . T
      . . . . . .`,
      { rules: { fumble: true } },
    );
    const a = applyAction(s, { kind: 'move', spyId: 'p0a', to: { r: 2, c: 2 } });
    expect(a.state.intel).toEqual([{ r: 2, c: 3 }]);
    expect(a.state.locks).toEqual([{ at: { r: 2, c: 3 }, player: 1 }]);
    // Teal's spy at (2,4) is adjacent but may not step back onto its fumbled folder.
    const tealTargets = legalActions(a.state).filter((x) => x.kind === 'move' && x.spyId === 'p1a');
    expect(tealTargets.some((x) => x.kind === 'move' && x.to.r === 2 && x.to.c === 3)).toBe(false);
    // After teal's turn the lock is gone; red can grab it meanwhile.
    const b = applyAction(a.state, { kind: 'move', spyId: 'p1b', to: { r: 4, c: 4 } });
    expect(b.state.locks).toBeUndefined();
    const c = applyAction(b.state, { kind: 'move', spyId: 'p0a', to: { r: 2, c: 3 } });
    expect(c.events.map((e) => e.t)).toContain('pickedUp');
  });
});
