import { describe, expect, test } from 'vitest';
import { add, cell, cheb, key, sub } from './board';
import { applyAction, createGame, legalActions } from './engine';
import { board } from './fixtures';
import { duelRules, ffaRules } from './rules';

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

describe('escort (experimental knob)', () => {
  const opts = { rules: { escort: true } };
  test('a carrier with a teammate next to it keeps its intel when shoved', () => {
    const s = board(
      `
      . . . . . .
      . . . . T .
      . R . T* . .
      . . . . . .
      . . . . . .
      . . . . . .`,
      opts,
    );
    // Teal carrier at (2,3) is escorted by teal at (1,4). Red arrives at (2,2) and shoves it.
    const { state, events } = applyAction(s, { kind: 'move', spyId: 'p0a', to: { r: 2, c: 2 } });
    expect(events.map((e) => e.t)).not.toContain('dropped');
    expect(state.spies.find((x) => x.id === 'p1b')).toMatchObject({
      pos: { r: 2, c: 4 },
      carrying: true,
    });
  });
  test('an unescorted carrier still drops; escort is judged before the shove', () => {
    const s = board(
      `
      . . . . . .
      . . . . . .
      . R . T* . .
      . . . . . .
      . . . . . .
      . . . . T .`,
      opts,
    );
    const { events } = applyAction(s, { kind: 'move', spyId: 'p0a', to: { r: 2, c: 2 } });
    expect(events.map((e) => e.t)).toContain('dropped');
  });
  test('an escorted carrier burned off the board still drops', () => {
    const s = board(
      `
      . . T* T . .
      . . . . . .
      . . R . . .
      . . . . . .
      . . . . . .
      . . . . . .`,
      { ...opts, current: 0 },
    );
    const { events } = applyAction(s, { kind: 'move', spyId: 'p0a', to: { r: 1, c: 2 } });
    expect(events.map((e) => e.t).slice(0, 3)).toEqual(['moved', 'dropped', 'burned']);
  });
  test('an escorted carrier cannot be shoved onto intel (blocked instead)', () => {
    const s = board(
      `
      . . . . . .
      . . . . T .
      . R . T* i .
      . . . . . .
      . . . . . .
      . . . . . .`,
      opts,
    );
    const { state, events } = applyAction(s, { kind: 'move', spyId: 'p0a', to: { r: 2, c: 2 } });
    expect(events[1]).toMatchObject({ t: 'bumpBlocked', spyId: 'p1b' });
    expect(state.spies.find((x) => x.id === 'p1b')).toMatchObject({
      pos: { r: 2, c: 3 },
      carrying: true,
    });
  });
});

describe('sprint (experimental knob)', () => {
  const opts = { rules: { sprint: true } };
  const targets = (s: ReturnType<typeof board>, id: string) =>
    legalActions(s)
      .filter((a) => a.kind === 'move' && a.spyId === id)
      .map((a) => (a.kind === 'move' ? `${a.to.r}${a.to.c}` : ''))
      .sort();
  test('a carrier may also dash 2 squares in a straight line over an empty square', () => {
    const s = board(
      `
      . . . . . .
      . . . . . .
      . . R* . . .
      . . . T . .
      . . . . . .
      . . . . . T`,
      opts,
    );
    // 8 one-step moves (none blocked) + 2-step dashes, except through the spy at (3,3) -> no (4,4).
    expect(targets(s, 'p0a')).toEqual(
      [
        '00',
        '02',
        '04',
        '11',
        '12',
        '13',
        '20',
        '21',
        '23',
        '24',
        '31',
        '32',
        '33',
        '40',
        '42',
      ].filter((x) => x !== '33'),
    );
  });
  test('empty-handed spies cannot dash; dashing bumps only at the landing square', () => {
    const s = board(
      `
      . . . . . .
      . . . . . .
      . . R* . . .
      . . . . . .
      . . T . . .
      . . . . . .`,
      opts,
    );
    expect(targets({ ...s, current: 1 }, 'p1a').length).toBe(8); // not carrying: no dashes
    // Red dashes (2,2) -> (0,2)? no: dash toward home (row 5) is blocked by teal at (4,2): (3,2) is empty, lands (4,2)? occupied.
    expect(targets(s, 'p0a')).not.toContain('42');
    const { events } = applyAction(s, { kind: 'move', spyId: 'p0a', to: { r: 4, c: 4 } });
    // Lands on (4,4): teal at (4,2) is two away, so nothing is bumped.
    expect(events.map((e) => e.t)).toEqual(['moved']);
  });
  test('a dash cannot land on intel or pass over a spy', () => {
    const s = board(
      `
      . . . . . .
      . . . . . .
      . . R* T i .
      . . . . . .
      . . i . . .
      . . . . . T`,
      opts,
    );
    expect(targets(s, 'p0a')).not.toContain('24'); // over a spy
    expect(targets(s, 'p0a')).not.toContain('42'); // onto intel
  });
});

test('shipped Duel defaults: sprint and fumble on, other experimental flags off', () => {
  const r = duelRules();
  expect([r.sprint, r.fumble, r.escort, r.dropOnBump, r.firstMoveNoBump]).toEqual([
    true,
    true,
    false,
    true,
    false,
  ]);
});
