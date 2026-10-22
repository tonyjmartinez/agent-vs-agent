import { describe, expect, it } from 'vitest';
import { applyAction, createGame, hash, isTerminal, legalActions, previewAction } from './engine';
import { duelRules } from './rules';
import { board, render } from './testing';
import type { Action, GameEvent } from './types';

const mv = (spyId: string, r: number, c: number): Action => ({ kind: 'move', spyId, to: { r, c } });
const dp = (spyId: string, r: number, c: number): Action => ({
  kind: 'deploy',
  spyId,
  to: { r, c },
});
const norm = (t: string) =>
  t
    .trim()
    .split('\n')
    .map((l) => l.trim().split(/\s+/).join(' '))
    .join('\n');
/** Build a 6x6 board string from {'r,c': token}. */
const g = (cells: Record<string, string>): string =>
  Array.from({ length: 6 }, (_, r) =>
    Array.from({ length: 6 }, (_, c) => cells[`${r},${c}`] ?? '.').join(' '),
  ).join('\n');
const pos = (s: ReturnType<typeof board>, id: string) => s.spies.find((p) => p.id === id)!.pos;
const tags = (ev: GameEvent[]) => ev.map((e) => e.t);

describe('setup', () => {
  it('matches the Duel spec', () => {
    const s = createGame();
    expect(render(s)).toBe(
      norm(`
      . T . . T .
      . . . . . .
      . . i . . .
      . . . i . .
      . . . . . .
      . R . . R .`),
    );
    expect(s.current).toBe(0);
    expect(s.scores).toEqual([0, 0]);
    expect(s.spies.map((p) => p.id)).toEqual(['p0a', 'p0b', 'p1a', 'p1b']);
    expect(s.winner).toBeNull();
  });

  it('spawn order starts with the centre four and covers every cell once', () => {
    const order = duelRules().intelSpawnOrder;
    expect(order.slice(0, 4)).toEqual([
      { r: 2, c: 2 },
      { r: 3, c: 3 },
      { r: 2, c: 3 },
      { r: 3, c: 2 },
    ]);
    expect(new Set(order.map((c) => c.r * 6 + c.c)).size).toBe(36);
  });
});

describe('movement', () => {
  it('lists the 8 king moves in clockwise order from north', () => {
    const s = board(`
      . . . . . .
      . . . . . .
      . . R . . .
      . . . . . .
      . . . . . .
      . . . . . .`);
    const moves = legalActions(s).filter((a) => a.kind === 'move' && a.spyId === 'p0a');
    expect(moves.map((a) => (a.kind === 'move' ? `${a.to.r}${a.to.c}` : ''))).toEqual([
      '12',
      '13',
      '23',
      '33',
      '32',
      '31',
      '21',
      '11',
    ]);
  });

  it('respects corners and edges', () => {
    const s = board(`
      R . . . . .
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . . .`);
    const to = legalActions(s).flatMap((a) => (a.kind === 'move' ? [`${a.to.r}${a.to.c}`] : []));
    expect(to).toEqual(['01', '11', '10']);
  });

  it('cannot move onto spies of either side', () => {
    const s = board(`
      . . . . . .
      . . . . . .
      . R R . . .
      . . T . . .
      . . . . . .
      . . . . . .`);
    const to = legalActions(s).flatMap((a) =>
      a.kind === 'move' && a.spyId === 'p0a' ? [`${a.to.r}${a.to.c}`] : [],
    );
    expect(to).not.toContain('22');
    expect(to).not.toContain('32');
    expect(() => applyAction(s, mv('p0a', 2, 2))).toThrow(/occupied/);
  });

  it('carriers cannot step onto intel but empty-handed spies can', () => {
    const s = board(`
      . . . . . .
      . . . . . .
      . R* i . . .
      . . . . . .
      . . . . . .
      . . . . . .`);
    expect(legalActions(s).some((a) => a.kind === 'move' && a.to.r === 2 && a.to.c === 2)).toBe(
      false,
    );
    expect(() => applyAction(s, mv('p0a', 2, 2))).toThrow(/intel/);
    const e = board(`
      . . . . . .
      . . . . . .
      . R i . . .
      . . . . . .
      . . . . . .
      . . . . . .`);
    expect(legalActions(e).some((a) => a.kind === 'move' && a.to.r === 2 && a.to.c === 2)).toBe(
      true,
    );
  });

  it('rejects non-adjacent, off-board, wrong-owner and reserve moves', () => {
    const s = createGame();
    expect(() => applyAction(s, mv('p0a', 3, 1))).toThrow(/adjacent/);
    expect(() => applyAction(s, mv('p0a', 6, 1))).toThrow(/off board/);
    expect(() => applyAction(s, mv('p1a', 1, 1))).toThrow(/not your spy/);
    expect(() => applyAction(s, mv('nope', 1, 1))).toThrow(/not your spy/);
    expect(() => applyAction(s, { kind: 'pass' })).toThrow(/pass/);
  });

  it('orthogonal movement knob', () => {
    const s = board(
      `
      . . . . . .
      . . . . . .
      . . R . . .
      . . . . . .
      . . . . . .
      . . . . . .`,
      { rules: { movement: 'orthogonal' } },
    );
    expect(legalActions(s).filter((a) => a.kind === 'move')).toHaveLength(4);
    expect(() => applyAction(s, mv('p0a', 1, 1))).toThrow(/adjacent/);
  });
});

describe('deploy', () => {
  const reserve = board(`
    . . . . . .
    . . . . . .
    . . . . . .
    . . . . . .
    . . . . . .
    . . R . . .`); // p0 has one spy on board and one in reserve

  it('only from reserve, only to empty home cells', () => {
    const deploys = legalActions(reserve).filter((a) => a.kind === 'deploy');
    expect(deploys).toHaveLength(5); // row 5 minus the occupied cell
    expect(deploys.every((a) => a.kind === 'deploy' && a.spyId === 'p0b')).toBe(true);
    expect(deploys.some((a) => a.kind === 'deploy' && a.to.c === 2)).toBe(false);
    expect(() => applyAction(reserve, dp('p0b', 4, 0))).toThrow(/extraction/);
    expect(() => applyAction(reserve, dp('p0b', 5, 2))).toThrow(/occupied/);
    expect(() => applyAction(reserve, dp('p0a', 5, 0))).toThrow(/not in reserve/);
    expect(() => applyAction(reserve, mv('p0b', 4, 0))).toThrow(/reserve/);
  });

  it('bumps on arrival, including your own spy', () => {
    const { state, events } = applyAction(reserve, dp('p0b', 5, 1));
    // p0a at (5,2) is east of the arrival cell, so it is pushed to (5,3).
    expect(pos(state, 'p0a')).toEqual({ r: 5, c: 3 });
    expect(pos(state, 'p0b')).toEqual({ r: 5, c: 1 });
    expect(tags(events)).toEqual(['deployed', 'bumped']);
  });

  it('deploy bump pushes the neighbour away', () => {
    const s = board(`
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . T .
      . . . R . .`);
    // p0b in reserve; deploy at (5,4): neighbours (4,4) T pushes north to (3,4), (5,3) R pushes west to (5,2)
    const { state, events } = applyAction(s, dp('p0b', 5, 4));
    expect(render(state)).toBe(
      norm(`
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . T .
      . . . . . .
      . . R . R .`),
    );
    expect(tags(events)).toEqual(['deployed', 'bumped', 'bumped']);
  });
});

describe('bumping', () => {
  const dirs: [string, number, number][] = [
    ['N', -1, 0],
    ['NE', -1, 1],
    ['E', 0, 1],
    ['SE', 1, 1],
    ['S', 1, 0],
    ['SW', 1, -1],
    ['W', 0, -1],
    ['NW', -1, -1],
  ];
  it.each(dirs)('pushes a neighbour straight away in direction %s', (_n, dr, dc) => {
    // Actor steps to (3,2) from the opposite side; the victim sits at (3,2)+d and must end at (3,2)+2d.
    const s = board(g({ [`${3 - dr},${2 - dc}`]: 'R', [`${3 + dr},${2 + dc}`]: 'T' }));
    const { state, events } = applyAction(s, mv('p0a', 3, 2));
    expect(pos(state, 'p1a')).toEqual({ r: 3 + 2 * dr, c: 2 + 2 * dc });
    expect(tags(events)).toEqual(['moved', 'bumped']);
    expect(events[1]).toMatchObject({ t: 'bumped', spyId: 'p1a', by: 'p0a' });
  });

  it('bumps own spies too, and bumpOwnSpies=false spares them', () => {
    const text = g({ '3,1': 'R', '4,2': 'R' });
    const hit = applyAction(board(text), mv('p0a', 3, 2)).state;
    expect(pos(hit, 'p0b')).toEqual({ r: 5, c: 2 });
    const safe = applyAction(
      board(text, { rules: { bumpOwnSpies: false } }),
      mv('p0a', 3, 2),
    ).state;
    expect(pos(safe, 'p0b')).toEqual({ r: 4, c: 2 });
  });

  it('is blocked by a spy directly behind the target', () => {
    const s = board(g({ '3,0': 'R', '3,2': 'T', '3,3': 'T' }));
    const { state, events } = applyAction(s, mv('p0a', 3, 1));
    expect(pos(state, 'p1a')).toEqual({ r: 3, c: 2 });
    expect(tags(events)).toEqual(['moved', 'bumpBlocked']);
    expect(events[1]).toMatchObject({ spyId: 'p1a', at: { r: 3, c: 2 }, dir: { r: 0, c: 1 } });
  });

  it('is blocked by a friendly spy behind too', () => {
    const s = board(g({ '3,0': 'R', '3,2': 'R', '3,3': 'T' }));
    const { state, events } = applyAction(s, mv('p0a', 3, 1));
    expect(pos(state, 'p0b')).toEqual({ r: 3, c: 2 });
    expect(tags(events)).toContain('bumpBlocked');
  });

  it('is not blocked by intel, and the bumped spy picks it up', () => {
    const s = board(g({ '3,1': 'R', '3,3': 'T', '3,4': 'i' }));
    const { state, events } = applyAction(s, mv('p0a', 3, 2));
    expect(pos(state, 'p1a')).toEqual({ r: 3, c: 4 });
    expect(state.spies.find((p) => p.id === 'p1a')!.carrying).toBe(true);
    expect(state.intel).toEqual([]);
    expect(tags(events)).toEqual(['moved', 'bumped', 'pickedUp']);
  });

  it('does not chain: a bumped spy does not bump its new neighbours', () => {
    const s = board(g({ '3,1': 'R', '3,3': 'T', '3,5': 'T' }));
    const { state } = applyAction(s, mv('p0a', 3, 2));
    expect(pos(state, 'p1a')).toEqual({ r: 3, c: 4 });
    expect(pos(state, 'p1b')).toEqual({ r: 3, c: 5 });
  });

  it('resolves several bumps simultaneously against the pre-bump board', () => {
    const s = board(g({ '3,1': 'R', '2,2': 'T', '2,3': 'T', '4,3': 'R', '3,3': 'T' }), {
      rules: { spiesPerPlayer: 3 },
    });
    const { state, events } = applyAction(s, mv('p0a', 3, 2));
    expect(pos(state, 'p1a')).toEqual({ r: 1, c: 2 }); // (2,2) pushed N
    expect(pos(state, 'p1b')).toEqual({ r: 1, c: 4 }); // (2,3) pushed NE
    expect(pos(state, 'p1c')).toEqual({ r: 3, c: 4 }); // (3,3) pushed E
    expect(pos(state, 'p0b')).toEqual({ r: 5, c: 4 }); // own (4,3) pushed SE
    expect(events.filter((e) => e.t === 'bumped')).toHaveLength(4);
  });

  it('the actor itself is never bumped and ends where it moved', () => {
    const s = board(g({ '3,1': 'R', '3,3': 'T' }));
    expect(pos(applyAction(s, mv('p0a', 3, 2)).state, 'p0a')).toEqual({ r: 3, c: 2 });
  });

  it('firstMoveNoBump skips the bump on ply 0 only', () => {
    const text = g({ '3,1': 'R', '3,3': 'T' });
    const rules = { firstMoveNoBump: true };
    expect(pos(applyAction(board(text, { rules }), mv('p0a', 3, 2)).state, 'p1a')).toEqual({
      r: 3,
      c: 3,
    });
    expect(pos(applyAction(board(text, { rules, ply: 1 }), mv('p0a', 3, 2)).state, 'p1a')).toEqual({
      r: 3,
      c: 4,
    });
  });
});

describe('burning', () => {
  // [name, victim cell, actor start, actor destination]
  const cases: [string, [number, number], [number, number], [number, number]][] = [
    ['top edge', [0, 2], [2, 2], [1, 2]],
    ['bottom edge', [5, 2], [3, 2], [4, 2]],
    ['left edge', [2, 0], [2, 2], [2, 1]],
    ['right edge', [2, 5], [2, 3], [2, 4]],
    ['top-left corner', [0, 0], [2, 2], [1, 1]],
    ['top-right corner', [0, 5], [2, 3], [1, 4]],
    ['bottom-left corner', [5, 0], [3, 2], [4, 1]],
    ['bottom-right corner', [5, 5], [3, 3], [4, 4]],
  ];
  it.each(cases)('burns a spy off the %s into reserve', (_n, v, from, to) => {
    const s = board(g({ [`${from}`]: 'R', [`${v}`]: 'T' }));
    const { state, events } = applyAction(s, mv('p0a', to[0], to[1]));
    expect(pos(state, 'p1a')).toBeNull();
    expect(state.spies.find((p) => p.id === 'p1a')!.carrying).toBe(false);
    expect(tags(events)).toEqual(['moved', 'burned']);
    // the burned spy can be redeployed on its owner's row
    const next = legalActions(state).filter((a) => a.kind === 'deploy');
    expect(next.length).toBeGreaterThan(0);
  });
});

describe('carrying', () => {
  it('actor picks up intel on arrival', () => {
    const s = board(g({ '3,1': 'R', '3,2': 'i' }));
    const { state, events } = applyAction(s, mv('p0a', 3, 2));
    expect(state.spies[0]!.carrying).toBe(true);
    expect(state.intel).toEqual([]);
    expect(tags(events)).toEqual(['moved', 'pickedUp']);
  });

  it('a carrier already holding intel keeps one only (cannot pick up a second)', () => {
    const s = board(g({ '3,1': 'R*', '3,3': 'i' }));
    expect(legalActions(s).some((a) => a.kind === 'move' && a.to.c === 3)).toBe(false);
  });

  it('bumped carrier drops intel at the cell it stood on', () => {
    const s = board(g({ '3,1': 'R', '3,3': 'T*' }));
    const { state, events } = applyAction(s, mv('p0a', 3, 2));
    expect(state.intel).toEqual([{ r: 3, c: 3 }]);
    expect(pos(state, 'p1a')).toEqual({ r: 3, c: 4 });
    expect(state.spies.find((p) => p.id === 'p1a')!.carrying).toBe(false);
    expect(tags(events)).toEqual(['moved', 'dropped', 'bumped']);
  });

  it('burned carrier drops intel at the cell it stood on', () => {
    const s = board(g({ '2,2': 'R', '0,2': 'T*' }));
    const { state, events } = applyAction(s, mv('p0a', 1, 2));
    expect(state.intel).toEqual([{ r: 0, c: 2 }]);
    expect(pos(state, 'p1a')).toBeNull();
    expect(tags(events)).toEqual(['moved', 'dropped', 'burned']);
  });

  it('a blocked carrier keeps its intel', () => {
    const s = board(g({ '3,0': 'R', '3,2': 'T*', '3,3': 'T' }));
    const { state } = applyAction(s, mv('p0a', 3, 1));
    expect(state.spies.find((p) => p.id === 'p1a')!.carrying).toBe(true);
    expect(state.intel).toEqual([]);
  });

  it('a spy that drops intel and lands on other intel picks that one up', () => {
    const s = board(g({ '3,1': 'R', '3,3': 'T*', '3,4': 'i' }));
    const { state } = applyAction(s, mv('p0a', 3, 2));
    expect(state.spies.find((p) => p.id === 'p1a')!.carrying).toBe(true);
    expect(state.intel).toEqual([{ r: 3, c: 3 }]);
  });

  it('keeps one intel per cell when a carrier standing on intel is bumped', () => {
    // T* was previously bumped onto an intel cell (3,3); bumping it again would drop onto occupied intel.
    const s = board(g({ '3,1': 'R', '3,3': 'T*i' }));
    expect(s.intel).toHaveLength(1);
    const { state, events } = applyAction(s, mv('p0a', 3, 2));
    expect(new Set(state.intel.map((c) => `${c.r},${c.c}`)).size).toBe(state.intel.length);
    expect(state.intel).toHaveLength(2); // total intel conserved: one dropped intel respawned
    expect(tags(events)).toEqual(['moved', 'dropped', 'bumped', 'intelSpawned']);
  });
});

describe('extraction', () => {
  it('banks immediately on reaching your own row, then respawns intel', () => {
    const s = board(g({ '4,2': 'R*', '3,3': 'i' }));
    const { state, events } = applyAction(s, mv('p0a', 5, 2));
    expect(state.scores).toEqual([1, 0]);
    expect(state.spies[0]!.carrying).toBe(false);
    expect(state.intel).toEqual([
      { r: 2, c: 2 },
      { r: 3, c: 3 },
    ]);
    expect(tags(events)).toEqual(['moved', 'extracted', 'intelSpawned']);
    expect(events[1]).toMatchObject({ owner: 0, score: 1 });
  });

  it('does not bank on the opponent row', () => {
    const s = board(g({ '1,2': 'R*', '3,3': 'i' }));
    const { state } = applyAction(s, mv('p0a', 0, 2));
    expect(state.scores).toEqual([0, 0]);
    expect(state.spies[0]!.carrying).toBe(true);
  });

  it('steal at the door: bumped carrier drops on your row, you step on it and bank', () => {
    // Teal carrier stands on Red's row (5,3); Red bumps it from (4,2)->(5,2)? Drop cell is its origin.
    const s0 = board(g({ '4,2': 'R', '5,3': 'T*', '2,2': 'T' }), { rules: { spiesPerPlayer: 3 } });
    const s1 = applyAction(s0, mv('p0a', 5, 2)).state; // bumps (5,3) east to (5,4); drop at (5,3)
    expect(s1.intel).toContainEqual({ r: 5, c: 3 });
    expect(s1.scores).toEqual([0, 0]);
    const s2 = applyAction(s1, mv('p1a', 1, 2)).state; // teal wastes a move elsewhere
    const s3 = applyAction(s2, mv('p0a', 5, 3)).state;
    expect(s3.scores).toEqual([1, 0]);
    expect(s3.spies.find((p) => p.id === 'p0a')!.carrying).toBe(false);
  });

  it('an enemy spy you bump onto intel in its own zone picks it up and banks for its owner', () => {
    const s = board(g({ '2,2': 'R', '1,3': 'T', '0,3': 'i', '3,3': 'i' }));
    const { state, events } = applyAction(s, mv('p0a', 2, 3));
    expect(state.scores).toEqual([0, 1]);
    expect(tags(events)).toEqual(['moved', 'bumped', 'pickedUp', 'extracted', 'intelSpawned']);
    expect(events[3]).toMatchObject({ owner: 1, at: { r: 0, c: 3 }, score: 1 });
  });

  it('a bumped carrier always drops, so it cannot bank by being pushed home', () => {
    const s = board(g({ '2,2': 'R', '1,3': 'T*', '3,3': 'i' }));
    const { state } = applyAction(s, mv('p0a', 2, 3));
    expect(state.scores).toEqual([0, 0]);
    expect(state.intel).toContainEqual({ r: 1, c: 3 });
  });

  it('banks several spies of one owner in one action, ordered by spy id', () => {
    const s = board(g({ '2,1': 'R', '1,1': 'T', '1,2': 'T', '0,0': 'i', '0,2': 'i' }), {
      rules: { spiesPerPlayer: 2 },
    });
    const { state, events } = applyAction(s, mv('p0a', 2, 2));
    expect(events.flatMap((e) => (e.t === 'extracted' ? [e.spyId] : []))).toEqual(['p1a', 'p1b']);
    expect(state.scores).toEqual([0, 2]);
    expect(state.intel).toHaveLength(2);
  });

  it('respawns on the first free cell, skipping spies and existing intel', () => {
    const s = board(g({ '4,5': 'R*', '2,2': 'T', '3,3': 'i' }));
    const { state } = applyAction(s, mv('p0a', 5, 5));
    expect(state.intel).toEqual([
      { r: 2, c: 3 },
      { r: 3, c: 3 },
    ]);
  });

  it("banks every owner's carrier standing in its own zone, mover first", () => {
    // Custom rules: Teal banks on row 3. Red steps onto row 5 and bumps a Teal spy onto intel in row 3.
    const base = duelRules();
    const rules = duelRules({
      players: [base.players[0]!, { ...base.players[1]!, extraction: [{ r: 3, c: 2 }] }],
    });
    const s = board(g({ '4,1': 'R*', '4,2': 'T', '3,2': 'i' }), { rules, scores: [2, 2] });
    const { state, events } = applyAction(s, mv('p0a', 5, 2));
    const owners = events.flatMap((e) => (e.t === 'extracted' ? [e.owner] : []));
    expect(owners).toEqual([0, 1]);
    expect(state.scores).toEqual([3, 3]);
    expect(state.winner).toBe(0); // simultaneous win: the mover takes it
    expect(tags(events).filter((t) => t === 'intelSpawned')).toHaveLength(2);
  });
});

describe('winning', () => {
  it('reaching intelToWin ends the game and locks further play', () => {
    const s = board(g({ '4,2': 'R*', '3,3': 'i' }), { scores: [2, 0] });
    const { state, events } = applyAction(s, mv('p0a', 5, 2));
    expect(state.winner).toBe(0);
    expect(isTerminal(state)).toBe(true);
    expect(events.at(-1)).toMatchObject({ t: 'gameOver', winner: 0 });
    expect(legalActions(state)).toEqual([]);
    expect(() => applyAction(state, mv('p0a', 4, 2))).toThrow(/over/);
  });

  it("the non-mover wins if the mover's bump lets them bank the third intel", () => {
    const s = board(g({ '2,2': 'R', '1,3': 'T', '0,3': 'i', '3,3': 'i' }), { scores: [0, 2] });
    expect(applyAction(s, mv('p0a', 2, 3)).state.winner).toBe(1);
  });

  it('maxPlies: higher score wins, equal scores draw', () => {
    const text = g({ '3,3': 'R', '0,0': 'T' });
    const lead = board(text, { ply: 119, scores: [1, 0] });
    expect(applyAction(lead, mv('p0a', 3, 2)).state.winner).toBe(0);
    const behind = board(text, { ply: 119, scores: [0, 1] });
    expect(applyAction(behind, mv('p0a', 3, 2)).state.winner).toBe(1);
    const level = board(text, { ply: 119, scores: [1, 1] });
    const done = applyAction(level, mv('p0a', 3, 2));
    expect(done.state.winner).toBe('draw');
    expect(done.events.at(-1)).toMatchObject({ t: 'gameOver', winner: 'draw' });
    const early = board(text, { ply: 118 });
    expect(applyAction(early, mv('p0a', 3, 2)).state.winner).toBeNull();
  });
});

describe('pass', () => {
  const stuck = board(g({ '0,0': 'R', '0,1': 'T', '1,0': 'T', '1,1': 'T' }), {
    rules: {
      spiesPerPlayer: 3,
      players: duelRules().players.map((p, i) => (i === 0 ? { ...p, extraction: [] } : p)),
    },
  });
  it('is the only action when nothing else is legal', () => {
    expect(legalActions(stuck)).toEqual([{ kind: 'pass' }]);
    const { state, events } = applyAction(stuck, { kind: 'pass' });
    expect(events).toEqual([]);
    expect(state.current).toBe(1);
    expect(state.ply).toBe(1);
    expect(render(state)).toBe(render(stuck));
  });
});

describe('invariants of the action pipeline', () => {
  it('orders event phases monotonically in a rich scenario', () => {
    // Red steps onto intel (pickup), bumps a carrier (drop), burns a spy, and extracts.
    const s = board(g({ '4,3': 'R', '4,4': 'i', '3,4': 'T', '3,5': 'T*', '5,4': 'T' }), {
      rules: { spiesPerPlayer: 3 },
    });
    const { events } = applyAction(s, mv('p0a', 4, 4));
    const phases = events.map((e) => e.phase);
    expect(phases).toEqual([...phases].sort((a, b) => a - b));
    expect(tags(events)).toEqual(['moved', 'pickedUp', 'bumped', 'dropped', 'burned', 'burned']);
    expect(events.map((e) => e.phase)).toEqual([0, 0, 1, 1, 1, 1]);
  });

  it('never mutates its input and previewAction matches applyAction', () => {
    const s = createGame();
    const frozen = JSON.stringify(s);
    const deepFreeze = <T>(o: T): T => {
      if (o && typeof o === 'object') {
        Object.values(o).forEach(deepFreeze);
        Object.freeze(o);
      }
      return o;
    };
    deepFreeze(s);
    for (const a of legalActions(s)) {
      expect(previewAction(s, a)).toEqual(applyAction(s, a).events);
    }
    expect(JSON.stringify(s)).toBe(frozen);
  });

  it('hash ignores ply and distinguishes positions', () => {
    const a = createGame();
    const b = { ...createGame(), ply: 7 };
    expect(hash(a)).toBe(hash(b));
    const c = applyAction(a, legalActions(a)[0]!).state;
    expect(hash(c)).not.toBe(hash(a));
    const carrier = board(g({ '0,0': 'R*' }));
    expect(hash(carrier)).not.toBe(hash(board(g({ '0,0': 'R' }))));
    expect(hash(board(g({ '0,0': 'R' }), { scores: [1, 0] }))).not.toBe(
      hash(board(g({ '0,0': 'R' }))),
    );
  });

  it('legalActions is deterministic', () => {
    const s = createGame();
    expect(legalActions(s)).toEqual(legalActions(createGame()));
  });
});

describe('test helpers', () => {
  it('board() rejects malformed input and render() inverts it', () => {
    expect(() => board('. . .')).toThrow(/6x6/);
    expect(() => board(g({ '0,0': 'X' }))).toThrow(/bad token/);
    const text = g({ '0,0': 'R*', '1,1': 'Ti', '2,2': 'i' });
    expect(render(board(text))).toBe(text);
  });
});
