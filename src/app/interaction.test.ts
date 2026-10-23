import { describe, expect, it } from 'vitest';
import { createGame } from '../engine/engine';
import { board } from '../engine/testing';
import { IDLE, reduce, reserveSpyId, selectable, targetsFor } from './interaction';
import { parseConfig } from './config';

const cell = (r: number, c: number) => ({ kind: 'cell' as const, cell: { r, c } });
const g = createGame();

describe('interaction reducer', () => {
  it('selects an own spy, ignores enemy spies and empty cells', () => {
    expect(reduce(g, IDLE, cell(5, 1), false).ui.selected).toBe('p0a');
    expect(reduce(g, IDLE, cell(0, 1), false).ui).toEqual(IDLE);
    expect(reduce(g, IDLE, cell(3, 0), false).ui).toEqual(IDLE);
  });

  it('desktop: a target click commits immediately', () => {
    const sel = reduce(g, IDLE, cell(5, 1), false).ui;
    const r = reduce(g, sel, cell(4, 1), false);
    expect(r.commit).toEqual({ kind: 'move', spyId: 'p0a', to: { r: 4, c: 1 } });
    expect(r.ui).toEqual(IDLE);
  });

  it('touch: first tap previews, same target again commits, another target re-previews', () => {
    const sel = reduce(g, IDLE, cell(5, 1), true).ui;
    const first = reduce(g, sel, cell(4, 1), true);
    expect(first.commit).toBeNull();
    expect(first.ui.preview).toEqual({ kind: 'move', spyId: 'p0a', to: { r: 4, c: 1 } });
    const other = reduce(g, first.ui, cell(4, 0), true);
    expect(other.commit).toBeNull();
    expect(other.ui.preview).toMatchObject({ to: { r: 4, c: 0 } });
    expect(reduce(g, first.ui, cell(4, 1), true).commit).not.toBeNull();
  });

  it('tapping elsewhere cancels; tapping another own spy switches selection', () => {
    const sel = reduce(g, IDLE, cell(5, 1), true).ui;
    expect(reduce(g, sel, cell(2, 0), true).ui).toEqual(IDLE);
    expect(reduce(g, sel, cell(5, 4), true).ui.selected).toBe('p0b');
    expect(reduce(g, sel, { kind: 'cancel' }, true).ui).toEqual(IDLE);
  });

  it('hover previews a target on desktop and clears off targets', () => {
    const sel = reduce(g, IDLE, cell(5, 1), false).ui;
    const hov = reduce(g, sel, { kind: 'hover', cell: { r: 4, c: 1 } }, false);
    expect(hov.ui.preview).not.toBeNull();
    expect(hov.commit).toBeNull();
    expect(reduce(g, hov.ui, { kind: 'hover', cell: { r: 0, c: 0 } }, false).ui.preview).toBeNull();
    expect(reduce(g, hov.ui, { kind: 'hover', cell: null }, false).ui.preview).toBeNull();
    expect(reduce(g, IDLE, { kind: 'hover', cell: { r: 4, c: 1 } }, false).ui).toEqual(IDLE);
  });

  it('reserve tray selects the deploy spy and deploys to home cells', () => {
    const s = board('. . . . . .\n. . . . . .\n. . . . . .\n. . . . . .\n. . . . . .\n. . R . . .');
    expect(reserveSpyId(s)).toBe('p0b');
    expect(reserveSpyId(g)).toBeNull();
    const sel = reduce(s, IDLE, { kind: 'reserve' }, false).ui;
    expect(sel.selected).toBe('p0b');
    expect(targetsFor(s, 'p0b')).toHaveLength(5);
    expect(reduce(s, sel, { kind: 'reserve' }, false).ui).toEqual(IDLE);
    expect(reduce(g, IDLE, { kind: 'reserve' }, false).ui).toEqual(IDLE);
    const commit = reduce(s, sel, cell(5, 0), false).commit;
    expect(commit).toEqual({ kind: 'deploy', spyId: 'p0b', to: { r: 5, c: 0 } });
  });

  it('does nothing once the game is over, and lists selectable spies', () => {
    expect(reduce({ ...g, winner: 0 }, IDLE, cell(5, 1), false)).toEqual({
      ui: IDLE,
      commit: null,
    });
    expect(selectable(g).sort()).toEqual(['p0a', 'p0b']);
  });
});

describe('parseConfig', () => {
  it('reads params with safe defaults', () => {
    expect(parseConfig('', false)).toMatchObject({
      seed: 1,
      speed: 1,
      test: false,
      state: null,
      confirm: false,
    });
    expect(parseConfig('?test=1&speed=0&seed=7&state=abc&confirm=1', false)).toMatchObject({
      seed: 7,
      speed: 0,
      test: true,
      state: 'abc',
      confirm: true,
    });
    expect(parseConfig('', true).confirm).toBe(true);
    expect(parseConfig('?confirm=0', true).confirm).toBe(false);
    expect(parseConfig('?speed=nope&seed=-3', false)).toMatchObject({ speed: 1, seed: 1 });
    expect(parseConfig('', false, true).test).toBe(true);
    expect(parseConfig('', false).seats).toEqual([{ kind: 'human' }, { kind: 'human' }]);
    expect(parseConfig('?p0=bot:easy&p1=bot:hard', false).seats).toEqual([
      { kind: 'bot', level: 'easy' },
      { kind: 'bot', level: 'hard' },
    ]);
    expect(parseConfig('?p0=bot:genius&p1=robot', false).seats).toEqual([
      { kind: 'human' },
      { kind: 'human' },
    ]);
  });
});
