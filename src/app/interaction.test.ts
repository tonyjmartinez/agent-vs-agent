import { describe, expect, test } from 'vitest';
import { createGame } from '../engine/engine';
import { board } from '../engine/fixtures';
import { duelRules } from '../engine/rules';
import {
  emptySelection,
  hoverCell,
  selectableSpies,
  tapCell,
  tapReserve,
  targetsFor,
} from './interaction';

describe('interaction', () => {
  const s = createGame(duelRules());

  test('tap spy selects, tap target previews (confirm), tap again commits', () => {
    const a = tapCell(s, emptySelection, { r: 5, c: 1 }, true);
    expect(a.selection.selected).toBe('p0a');
    const b = tapCell(s, a.selection, { r: 4, c: 1 }, true);
    expect(b.kind).toBe('select');
    expect(b.selection.pending).toEqual({ kind: 'move', spyId: 'p0a', to: { r: 4, c: 1 } });
    const c = tapCell(s, b.selection, { r: 4, c: 1 }, true);
    expect(c).toMatchObject({ kind: 'commit', action: { spyId: 'p0a' } });
  });

  test('direct mode commits on first target tap', () => {
    const a = tapCell(s, emptySelection, { r: 5, c: 1 }, false);
    expect(tapCell(s, a.selection, { r: 4, c: 2 }, false).kind).toBe('commit');
  });

  test('tapping elsewhere cancels; tapping enemy does nothing; re-tap deselects', () => {
    const a = tapCell(s, emptySelection, { r: 5, c: 1 }, true);
    expect(tapCell(s, a.selection, { r: 2, c: 5 }, true).selection).toEqual(emptySelection);
    expect(tapCell(s, emptySelection, { r: 0, c: 1 }, true).selection).toEqual(emptySelection);
    expect(tapCell(s, a.selection, { r: 5, c: 1 }, true).selection).toEqual(emptySelection);
  });

  test('switching selection between own spies', () => {
    const a = tapCell(s, emptySelection, { r: 5, c: 1 }, true);
    expect(tapCell(s, a.selection, { r: 5, c: 4 }, true).selection.selected).toBe('p0b');
  });

  test('hover previews only legal targets', () => {
    const a = tapCell(s, emptySelection, { r: 5, c: 1 }, false).selection;
    expect(hoverCell(s, a, { r: 4, c: 1 }).pending).not.toBeNull();
    expect(hoverCell(s, a, { r: 2, c: 2 }).pending).toBeNull();
    expect(hoverCell(s, a, null).pending).toBeNull();
  });

  test('reserve selection targets empty home cells', () => {
    const r = board(
      `
      . . . . . T
      . . . . . .
      . . . . . .
      . . . . . .
      . . . . . .
      R . . . . .`,
      { reserve: [0] },
    );
    const sel = tapReserve(r, emptySelection);
    expect(sel.selected).toBe('reserve');
    expect(targetsFor(r, 'reserve').length).toBe(5);
    expect(tapReserve(r, sel)).toEqual(emptySelection);
    expect(tapReserve(s, emptySelection)).toEqual(emptySelection);
    expect(selectableSpies(s)).toEqual(['p0a', 'p0b']);
  });
});
