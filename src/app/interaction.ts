import { eq } from '../engine/board';
import { legalActions } from '../engine/engine';
import type { Action, Cell, GameState } from '../engine/types';

/** Selection state for a human turn. Pure: no DOM, no Phaser. */
export interface Selection {
  selected: string | 'reserve' | null;
  /** The previewed (not yet committed) action, when confirm-mode is on or on hover. */
  pending: Action | null;
}

export const emptySelection: Selection = { selected: null, pending: null };

type Placed = Extract<Action, { kind: 'move' | 'deploy' }>;

export function actionsFor(s: GameState, sel: string | 'reserve' | null): Placed[] {
  if (!sel) return [];
  return legalActions(s).filter(
    (a): a is Placed =>
      a.kind !== 'pass' &&
      (sel === 'reserve' ? a.kind === 'deploy' : a.kind === 'move' && a.spyId === sel),
  );
}

export const targetsFor = (s: GameState, sel: string | 'reserve' | null): Cell[] =>
  actionsFor(s, sel).map((a) => a.to);

/** Own spies that have at least one legal move. */
export function selectableSpies(s: GameState): string[] {
  const ids = new Set<string>();
  for (const a of legalActions(s)) if (a.kind === 'move') ids.add(a.spyId);
  return [...ids];
}

export type TapResult =
  | { kind: 'select'; selection: Selection }
  | { kind: 'commit'; action: Action; selection: Selection };

/**
 * Tap on a board cell.
 * - Tapping a legal target previews it (confirm mode) or commits it (direct mode).
 * - Tapping the pending target again commits it.
 * - Tapping one of your movable spies selects it (tap again to deselect).
 * - Anything else clears the selection.
 */
export function tapCell(s: GameState, sel: Selection, cell: Cell, confirm: boolean): TapResult {
  if (sel.pending && sel.pending.kind !== 'pass' && eq(sel.pending.to, cell)) {
    return { kind: 'commit', action: sel.pending, selection: emptySelection };
  }
  const hit = actionsFor(s, sel.selected).find((a) => eq(a.to, cell));
  if (hit) {
    if (confirm) return { kind: 'select', selection: { selected: sel.selected, pending: hit } };
    return { kind: 'commit', action: hit, selection: emptySelection };
  }
  const spy = s.spies.find((x) => eq(x.pos, cell));
  if (spy && spy.owner === s.current && selectableSpies(s).includes(spy.id)) {
    if (sel.selected === spy.id) return { kind: 'select', selection: emptySelection };
    return { kind: 'select', selection: { selected: spy.id, pending: null } };
  }
  return { kind: 'select', selection: emptySelection };
}

/** Desktop hover: preview a legal target of the selected spy, else clear the preview. */
export function hoverCell(s: GameState, sel: Selection, cell: Cell | null): Selection {
  const hit = cell ? actionsFor(s, sel.selected).find((a) => eq(a.to, cell)) : undefined;
  return { selected: sel.selected, pending: hit ?? null };
}

export function tapReserve(s: GameState, sel: Selection): Selection {
  if (sel.selected === 'reserve') return emptySelection;
  return actionsFor(s, 'reserve').length ? { selected: 'reserve', pending: null } : sel;
}
