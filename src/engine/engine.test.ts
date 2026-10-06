import { describe, expect, test } from 'vitest';
import { applyAction, createGame, hash, legalActions, previewAction } from './engine';
import { board, deepFreeze } from './fixtures';
import { duelRules } from './rules';
import type { Action, GameEvent, GameState } from './types';

const mv = (spyId: string, r: number, c: number): Action => ({ kind: 'move', spyId, to: { r, c } });
const dep = (spyId: string, r: number, c: number): Action => ({
  kind: 'deploy',
  spyId,
  to: { r, c },
});
const spy = (s: GameState, id: string) => s.spies.find((x) => x.id === id)!;
const pos = (s: GameState, id: string) => spy(s, id).pos;
const types = (ev: GameEvent[]) => ev.map((e) => e.t);
const targetsOf = (s: GameState, id: string) =>
  legalActions(s)
    .filter((a) => a.kind !== 'pass' && a.spyId === id)
    .map((a) => (a.kind === 'pass' ? '' : `${a.to.r}${a.to.c}`))
    .sort();

describe('setup', () => {
  test('duel start position', () => {
    const s = createGame(duelRules());
    expect(s.current).toBe(0);
    expect(s.ply).toBe(0);
    expect(s.spies.map((x) => [x.id, x.pos])).toEqual([
      ['p0a', { r: 5, c: 1 }],
      ['p0b', { r: 5, c: 4 }],
      ['p1a', { r: 0, c: 1 }],
      ['p1b', { r: 0, c: 4 }],
    ]);
    expect(s.intel).toEqual([
      { r: 2, c: 2 },
      { r: 3, c: 3 },
    ]);
    expect(s.scores).toEqual([0, 0]);
    expect(s.winner).toBeNull();
  });

  test('spawn order starts with the 4 centre cells and avoids extraction rows', () => {
    const order = duelRules().intelSpawnOrder;
    expect(order.slice(0, 4)).toEqual([
      { r: 2, c: 2 },
      { r: 3, c: 3 },
      { r: 2, c: 3 },
      { r: 3, c: 2 },
    ]);
    expect(order.some((p) => p.r === 0 || p.r === 5)).toBe(false);
    expect(new Set(order.map((p) => `${p.r}${p.c}`)).size).toBe(order.length);
    expect(order.length).toBe(24);
  });
});

describe('movement', () => {
  test('king moves in all 8 directions from the middle', () => {
    const s = board(`
      . . . . . .
      . . . . . .
      . . R . . .
      . . . . . .
      . . . . . .
      . . . . . T`);
    expect(targetsOf(s, 'p0a')).toEqual(['11', '12', '13', '21', '23', '31', '32', '33']);
  });

  test('corner spy has 3 moves, edge spy has 5', () => {
    const s = board(`
      R . . . . .
      . . . . . .
      . . . . . .
      R . . . . .
      . . . . . .
      . . . . . T`);
    expect(targetsOf(s, 'p0a')).toEqual(['01', '10', '11']);
    expect(targetsOf(s, 'p0b')).toEqual(['20', '21', '31', '40', '41']);
  });

  test('cannot move onto spies (either team)', () => {
    const s = board(`
      . . . . . .
      . R T . . .
      . R . . . .
      . . . . . .
      . . . . . .
      . . . . . .`);
    expect(targetsOf(s, 'p0a')).not.toContain('12');
    expect(targetsOf(s, 'p0a')).not.toContain('21');
  });

  test('empty-handed spies may enter intel; carriers may not', () => {
    const s = board(`
      . . . . . .
      . R . . . .
      . i . . . .
      . R* . . . .
      . . . . . .
      . . . . . T`);
    expect(targetsOf(s, 'p0a')).toContain('21');
    expect(targetsOf(s, 'p0b')).not.toContain('21');
    expect(() => applyAction(s, mv('p0b', 2, 1))).toThrow();
  });

  test('orthogonal movement knob', () => {
    const s = board(
      `
      . . . . . .
      . . . . . .
      . . R . . .
      . . . . . .
      . . . . . .
      . . . . . T`,
      { rules: { movement: 'orthogonal' } },
    );
    expect(targetsOf(s, 'p0a')).toEqual(['12', '21', '23', '32']);
  });

  test('only the current player acts; illegal actions throw', () => {
    const s = createGame(duelRules());
    expect(() => applyAction(s, mv('p1a', 1, 1))).toThrow();
    expect(() => applyAction(s, mv('p0a', 3, 1))).toThrow();
    expect(() => applyAction(s, { kind: 'pass' })).toThrow();
  });

  test('legal actions are deterministic', () => {
    const s = createGame(duelRules());
    expect(legalActions(s)).toEqual(legalActions(s));
    expect(legalActions(s)[0]).toEqual(mv('p0a', 4, 0));
  });
});

describe('deploy', () => {
  test('only reserve spies deploy, only to empty cells of own zone', () => {
    const s = board(
      `
      . . . . . T
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . . .
      R . T . . .`,
      { reserve: [0] },
    );
    const deploys = legalActions(s).filter((a) => a.kind === 'deploy');
    expect(deploys.map((a) => (a.kind === 'deploy' ? `${a.spyId}${a.to.r}${a.to.c}` : ''))).toEqual(
      ['p0b51', 'p0b53', 'p0b54', 'p0b55'],
    );
    expect(() => applyAction(s, dep('p0a', 5, 3))).toThrow();
    expect(() => applyAction(s, dep('p0b', 4, 3))).toThrow();
  });

  test('deploy bumps neighbours', () => {
    const s = board(
      `
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . . .
      . . T . . .
      . . . . . .`,
      { reserve: [0] },
    );
    const { state, events } = applyAction(s, dep('p0a', 5, 2));
    expect(types(events)).toEqual(['deployed', 'bumped']);
    expect(pos(state, 'p1a')).toEqual({ r: 3, c: 2 });
  });

  test('deploy onto intel cell in own row picks it up and extracts', () => {
    const s = board(
      `
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . . .
      . . i . . .`,
      { reserve: [0, 1] },
    );
    const { state, events } = applyAction(s, dep('p0a', 5, 2));
    expect(types(events)).toEqual(['deployed', 'pickedUp', 'extracted', 'intelSpawned']);
    expect(state.scores).toEqual([1, 0]);
  });
});

describe('bumping', () => {
  test('pushes in 8 directions from a central arrival', () => {
    const s = board(`
      . . . . . .
      . T T T . .
      . T . T . .
      . T R . . .
      . . . . . .
      . . . . . .`);
    // R at (3,2) moves to (2,2): neighbours (1,1),(1,2),(1,3),(2,1),(2,3),(3,1) are T; (3,2) is now empty; (3,3) empty.
    const { state, events } = applyAction(s, mv('p0a', 2, 2));
    expect(types(events).filter((t) => t === 'bumped').length).toBe(6);
    expect(pos(state, 'p1a')).toEqual({ r: 0, c: 0 }); // (1,1) -> up-left
    expect(pos(state, 'p1b')).toEqual({ r: 0, c: 2 }); // (1,2) -> up
    expect(pos(state, 'p1c')).toEqual({ r: 0, c: 4 }); // (1,3) -> up-right
    expect(pos(state, 'p1d')).toEqual({ r: 2, c: 0 }); // (2,1) -> left
    expect(pos(state, 'p1e')).toEqual({ r: 2, c: 4 }); // (2,3) -> right
    expect(pos(state, 'p1f')).toEqual({ r: 4, c: 0 }); // (3,1) -> down-left
  });

  test('down and down-right pushes', () => {
    const s = board(`
      . . . . . .
      . R . . . .
      . . . . . .
      . . T T . .
      . . . . . .
      . . . . . .`);
    const { state } = applyAction(s, mv('p0a', 2, 2));
    expect(pos(state, 'p1a')).toEqual({ r: 4, c: 2 });
    expect(pos(state, 'p1b')).toEqual({ r: 4, c: 4 });
  });

  test('own spies get bumped too', () => {
    const s = board(`
      . . . . . .
      . . . . . .
      . . R R . .
      . . . . . .
      . . . . . .
      . . . . . .`);
    const { state, events } = applyAction(s, mv('p0a', 3, 2));
    expect(events.find((e) => e.t === 'bumped')).toMatchObject({ spyId: 'p0b', by: 'p0a' });
    expect(pos(state, 'p0b')).toEqual({ r: 1, c: 4 });
  });

  test('bumpOwnSpies=false knob spares teammates', () => {
    const s = board(
      `
      . . . . . .
      . . . . . .
      . . R R . .
      . . . . . .
      . . . . . .
      . . . . . .`,
      { rules: { bumpOwnSpies: false } },
    );
    const { state } = applyAction(s, mv('p0a', 3, 2));
    expect(pos(state, 'p0b')).toEqual({ r: 2, c: 3 });
  });

  test('a spy with another spy behind it does not move', () => {
    const s = board(`
      . . . . . .
      . . . . . .
      . R . T T .
      . . . . . .
      . . . . . .
      . . . . . .`);
    const { state, events } = applyAction(s, mv('p0a', 2, 2));
    expect(events.filter((e) => e.t === 'bumpBlocked')).toEqual([
      { t: 'bumpBlocked', spyId: 'p1a', at: { r: 2, c: 3 }, dir: { r: 0, c: 1 }, phase: 1 },
    ]);
    expect(pos(state, 'p1a')).toEqual({ r: 2, c: 3 });
    expect(pos(state, 'p1b')).toEqual({ r: 2, c: 4 });
  });

  test('intel does not block bumps; bumped spy picks it up', () => {
    const s = board(`
      . . . . . .
      . . . . . .
      . R . T i .
      . . . . . .
      . . . . . .
      . . . . . .`);
    const { state, events } = applyAction(s, mv('p0a', 2, 2));
    expect(types(events)).toEqual(['moved', 'bumped', 'pickedUp']);
    expect(spy(state, 'p1a')).toMatchObject({ pos: { r: 2, c: 4 }, carrying: true });
    expect(state.intel).toEqual([]);
  });

  test('a bumped carrier landing on intel drops at origin and does not re-pick', () => {
    const s = board(`
      . . . . . .
      . . . . . .
      . R . T* i .
      . . . . . .
      . . . . . .
      . . . . . .`);
    const { state, events } = applyAction(s, mv('p0a', 2, 2));
    expect(types(events)).toEqual(['moved', 'dropped', 'bumped', 'pickedUp']);
    expect(spy(state, 'p1a')).toMatchObject({ pos: { r: 2, c: 4 }, carrying: true });
    expect(state.intel).toEqual([{ r: 2, c: 3 }]);
  });

  test('no chaining: the pushed spy does not push its new neighbours', () => {
    const s = board(`
      . . . . . .
      . . . . . .
      . R . T . T
      . . . . . .
      . . . . . .
      . . . . . .`);
    const { state } = applyAction(s, mv('p0a', 2, 2));
    expect(pos(state, 'p1a')).toEqual({ r: 2, c: 4 });
    expect(pos(state, 'p1b')).toEqual({ r: 2, c: 5 });
  });

  test('simultaneous multi-bump uses the pre-bump board', () => {
    // (1,2) is pushed up to (0,2); (2,3) is pushed right to (2,4). (3,3) blocked? no, pushed to (4,4).
    const s = board(`
      . . . . . .
      . . T . . .
      . R . T . .
      . . . T . .
      . . . . . .
      . . . . . .`);
    const { state, events } = applyAction(s, mv('p0a', 2, 2));
    expect(types(events)).toEqual(['moved', 'bumped', 'bumped', 'bumped']);
    expect(pos(state, 'p1a')).toEqual({ r: 0, c: 2 });
    expect(pos(state, 'p1b')).toEqual({ r: 2, c: 4 });
    expect(pos(state, 'p1c')).toEqual({ r: 4, c: 4 });
  });

  test('firstMoveNoBump knob: the very first action does not bump', () => {
    const s = board(
      `
      . . . . . .
      . . . . . .
      . R . T . .
      . . . . . .
      . . . . . .
      . . . . . .`,
      { rules: { firstMoveNoBump: true } },
    );
    const { state, events } = applyAction(s, mv('p0a', 2, 2));
    expect(types(events)).toEqual(['moved']);
    expect(pos(state, 'p1a')).toEqual({ r: 2, c: 3 });
    const later = applyAction({ ...s, ply: 1 }, mv('p0a', 2, 2));
    expect(types(later.events)).toContain('bumped');
  });
});

describe('burning', () => {
  const edges: [string, number, number, number, number][] = [
    // board, actor dest, victim id final expectation via dir
    ['top', 1, 2, -1, 0],
    ['bottom', 4, 2, 1, 0],
    ['left', 2, 1, 0, -1],
    ['right', 2, 4, 0, 1],
  ];
  test.each(edges)('off the %s edge into reserve', (_name, dr, dc, vr, vc) => {
    // victim sits on the edge cell beyond (dr,dc) in direction (vr,vc)
    const victim = { r: dr + vr, c: dc + vc };
    const actorFrom = { r: dr - vr, c: dc - vc };
    const rows = Array.from({ length: 6 }, () => Array(6).fill('.'));
    rows[victim.r]![victim.c] = 'T';
    rows[actorFrom.r]![actorFrom.c] = 'R';
    const s = board(rows.map((r) => r.join(' ')).join('\n'));
    const { state, events } = applyAction(s, mv('p0a', dr, dc));
    expect(events.find((e) => e.t === 'burned')).toEqual({
      t: 'burned',
      spyId: 'p1a',
      from: victim,
      dir: { r: vr, c: vc },
      phase: 1,
    });
    expect(spy(state, 'p1a')).toMatchObject({ pos: null, carrying: false });
  });

  test('off a corner diagonally', () => {
    const s = board(`
      T . . . . .
      . . . . . .
      . . R . . .
      . . . . . .
      . . . . . .
      . . . . . .`);
    const { state, events } = applyAction(s, mv('p0a', 1, 1));
    expect(types(events)).toEqual(['moved', 'burned']);
    expect(pos(state, 'p1a')).toBeNull();
  });

  test('burned carrier drops intel at origin cell', () => {
    const s = board(`
      . . T* . . .
      . . . . . .
      . . R . . .
      . . . . . .
      . . . . . .
      . . . . . .`);
    const { state, events } = applyAction(s, mv('p0a', 1, 2));
    expect(types(events)).toEqual(['moved', 'dropped', 'burned']);
    expect(state.intel).toEqual([{ r: 0, c: 2 }]);
    expect(spy(state, 'p1a')).toMatchObject({ pos: null, carrying: false });
  });

  test('your own spy can be burned by you', () => {
    const s = board(`
      . . . . . .
      . . . . . .
      . . . . . .
      . . R . . .
      . . . . . .
      . . R . . .`);
    const { state } = applyAction(s, mv('p0a', 4, 2));
    expect(pos(state, 'p0b')).toBeNull();
  });
});

describe('carrying', () => {
  test('actor picks up on arrival', () => {
    const s = board(`
      . . . . . .
      . . . . . .
      . . i . . .
      . . R . . .
      . . . . . .
      . . . . . .`);
    const { state, events } = applyAction(s, mv('p0a', 2, 2));
    expect(types(events)).toEqual(['moved', 'pickedUp']);
    expect(events[1]!.phase).toBe(0);
    expect(spy(state, 'p0a').carrying).toBe(true);
    expect(state.intel).toEqual([]);
  });

  test('bumped carrier drops intel where it stood', () => {
    const s = board(`
      . . . . . .
      . . . . . .
      . R . T* . .
      . . . . . .
      . . . . . .
      . . . . . .`);
    const { state } = applyAction(s, mv('p0a', 2, 2));
    expect(spy(state, 'p1a')).toMatchObject({ pos: { r: 2, c: 4 }, carrying: false });
    expect(state.intel).toEqual([{ r: 2, c: 3 }]);
  });

  test('blocked carrier keeps its intel', () => {
    const s = board(`
      . . . . . .
      . . . . . .
      . R . T* T .
      . . . . . .
      . . . . . .
      . . . . . .`);
    const { state } = applyAction(s, mv('p0a', 2, 2));
    expect(spy(state, 'p1a').carrying).toBe(true);
  });

  test('actor that picks up in the bump step is not double-handled', () => {
    const s = board(`
      . . . . . .
      . . . . . .
      . . i T . .
      . R . . . .
      . . . . . .
      . . . . . .`);
    const { state, events } = applyAction(s, mv('p0a', 2, 2));
    expect(types(events)).toEqual(['moved', 'pickedUp', 'bumped']);
    expect(spy(state, 'p0a').carrying).toBe(true);
  });
});

describe('extraction', () => {
  test('a carrier reaching its own row banks immediately and intel respawns', () => {
    const s = board(`
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . . .
      . . R* . . .
      . . . . . .`);
    const { state, events } = applyAction(s, mv('p0a', 5, 2));
    expect(types(events)).toEqual(['moved', 'extracted', 'intelSpawned']);
    expect(events.map((e) => e.phase)).toEqual([0, 3, 4]);
    expect(state.scores).toEqual([1, 0]);
    expect(spy(state, 'p0a').carrying).toBe(false);
    expect(state.intel).toEqual([{ r: 2, c: 2 }]);
  });

  test('no extraction on the opponent row', () => {
    const s = board(`
      . . . . . .
      . . R* . . .
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . . .`);
    const { state, events } = applyAction(s, mv('p0a', 0, 2));
    expect(types(events)).toEqual(['moved']);
    expect(state.scores).toEqual([0, 0]);
    expect(spy(state, 'p0a').carrying).toBe(true);
  });

  test('bumping a carrier toward its own row drops the intel first, so no extraction', () => {
    const s2 = board(`
      . . . . . .
      . . T* . . .
      . . . . . .
      . . R . . .
      . . . . . .
      . . . . . .`);
    const { state, events } = applyAction(s2, mv('p0a', 2, 2));
    // carrier is bumped: it drops first (phase 1), so it arrives empty-handed. No extraction.
    expect(types(events)).toEqual(['moved', 'dropped', 'bumped']);
    expect(state.scores).toEqual([0, 0]);
  });

  test('steal at the door: drop on your row then pick up there extracts instantly', () => {
    const s = board(`
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . . .
      . R . T* . R`);
    // Red p0b (5,5) moves to (5,4): bumps teal carrier at (5,3) left? (5,3) is 1 col away: dir (0,-1) -> (5,2) empty.
    const a = applyAction(s, mv('p0b', 5, 4));
    expect(types(a.events)).toEqual(['moved', 'dropped', 'bumped']);
    expect(a.state.intel).toEqual([{ r: 5, c: 3 }]);
    // Teal's turn: teal moves away
    const b = applyAction(a.state, mv('p1a', 4, 1));
    // Red steps on the dropped intel at (5,3) which is red's own extraction row.
    const c = applyAction(b.state, mv('p0b', 5, 3));
    expect(types(c.events)).toEqual(['moved', 'pickedUp', 'extracted', 'intelSpawned']);
    expect(c.state.scores).toEqual([1, 0]);
  });

  test('respawn skips cells with spies or intel', () => {
    const s = board(`
      . . . . . .
      . . . . . .
      . . T i . .
      . . . . . .
      . . R* . . .
      . . . . . .`);
    // (2,2) has a spy, (3,3) free -> spawns at (3,3)
    const { state } = applyAction(s, mv('p0a', 5, 1));
    expect(state.intel).toEqual([
      { r: 2, c: 3 },
      { r: 3, c: 3 },
    ]);
  });

  test('extraction order: current player first, then by spy id', () => {
    // Contrived: a red carrier already on its row (can only arise in fixtures) extracts on teal's turn.
    const s2 = board(
      `
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . T .
      . . R* . . .`,
      { current: 1 },
    );
    const { events } = applyAction(s2, mv('p1a', 3, 4));
    expect(types(events)).toEqual(['moved', 'extracted', 'intelSpawned']);
  });
});

describe('win', () => {
  test('reaching intelToWin ends the game', () => {
    const s = board(
      `
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . . .
      . . R* . . .
      . . . . . .`,
      { scores: [2, 0] },
    );
    const { state, events } = applyAction(s, mv('p0a', 5, 2));
    expect(state.winner).toBe(0);
    expect(events.at(-1)).toEqual({ t: 'gameOver', winner: 0, phase: 5 });
    expect(legalActions(state)).toEqual([]);
    expect(() => applyAction(state, mv('p0a', 4, 2))).toThrow();
  });

  test('simultaneous extraction to the win: the mover wins ties', () => {
    const s = board(
      `
      . . . . . .
      T* . . . . .
      . . . . . .
      . . . . . .
      . . . . . .
      . R* . . . .`,
      { current: 1, scores: [2, 2] },
    );
    // Teal moves carrier to (0,0); red's carrier was pre-placed on its row and extracts too.
    const { state } = applyAction(s, mv('p1a', 0, 0));
    expect(state.scores).toEqual([3, 3]);
    expect(state.winner).toBe(1);
  });

  test('maxPlies: higher score wins', () => {
    const s = board(
      `
      . . . . . .
      . . . . . T
      . . . . . .
      . . . . . .
      . R . . . .
      . . . . . .`,
      { ply: 119, scores: [1, 0] },
    );
    const { state, events } = applyAction(s, mv('p0a', 3, 1));
    expect(state.winner).toBe(0);
    expect(events.at(-1)?.t).toBe('gameOver');
  });

  test('maxPlies: equal scores draw', () => {
    const s = board(
      `
      . . . . . .
      . . . . . T
      . . . . . .
      . . . . . .
      . R . . . .
      . . . . . .`,
      { ply: 119 },
    );
    expect(applyAction(s, mv('p0a', 3, 1)).state.winner).toBe('draw');
  });

  test('turn advances and ply increments', () => {
    const s = createGame(duelRules());
    const { state } = applyAction(s, mv('p0a', 4, 1));
    expect(state.current).toBe(1);
    expect(state.ply).toBe(1);
  });
});

describe('pass', () => {
  test('pass is legal only when nothing else is', () => {
    // Red has no spies on board and no reserve (fixture-only position).
    const s = board(`
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . . T`);
    expect(legalActions(s)).toEqual([{ kind: 'pass' }]);
    const { state, events } = applyAction(s, { kind: 'pass' });
    expect(types(events)).toEqual(['passed']);
    expect(state.current).toBe(1);
  });

  test('a boxed-in spy contributes no actions', () => {
    const s = board(`
      R T . . . .
      T T . . . .
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . . .`);
    expect(legalActions(s)).toEqual([{ kind: 'pass' }]);
  });
});

describe('purity and helpers', () => {
  test('applyAction never mutates its input', () => {
    const s = deepFreeze(createGame(duelRules()));
    for (const a of legalActions(s)) expect(() => applyAction(s, a)).not.toThrow();
  });

  test('previewAction returns events without committing', () => {
    const s = createGame(duelRules());
    const h = hash(s);
    expect(previewAction(s, mv('p0a', 4, 1))[0]?.t).toBe('moved');
    expect(hash(s)).toBe(h);
  });

  test('hash distinguishes positions and players to move', () => {
    const s = createGame(duelRules());
    const a = applyAction(s, mv('p0a', 4, 1)).state;
    expect(hash(a)).not.toBe(hash(s));
    expect(hash({ ...s, current: 1 })).not.toBe(hash(s));
  });
});

test('double extraction emits both extractions before both spawns', () => {
  const s = board(
    `
    . . . . . .
    . . . . . .
    . . . . . .
    . . . . . .
    . . . . R* .
    . R* . . . .`,
  );
  const { events } = applyAction(s, mv('p0a', 5, 4)); // p0b already waits on its row (fixture-only)
  expect(events.map((e) => e.t)).toEqual([
    'moved',
    'extracted',
    'extracted',
    'intelSpawned',
    'intelSpawned',
  ]);
});
