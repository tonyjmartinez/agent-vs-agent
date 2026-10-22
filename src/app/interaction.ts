import { legalActions } from '../engine/engine';
import { sameCell } from '../engine/board';
import type { Action, Cell, GameState } from '../engine/types';

/** Select → target → commit flow (PLAN.md 4.7), as a pure reducer so it is unit-testable. */
export interface UiState {
  /** Spy id of the selected spy (a reserve spy id means "deploy"). */
  selected: string | null;
  /** The action currently previewed (hover on desktop, first tap on touch). */
  preview: Action | null;
}
export type Input =
  | { kind: 'cell'; cell: Cell }
  | { kind: 'reserve' }
  | { kind: 'hover'; cell: Cell | null }
  | { kind: 'cancel' };

export const IDLE: UiState = { selected: null, preview: null };

const spyActions = (s: GameState, spyId: string): Action[] =>
  legalActions(s).filter((a) => a.kind !== 'pass' && a.spyId === spyId);

export const targetsFor = spyActions;

/** Ids the current player may select: board spies with a move, plus the reserve spy if it can deploy. */
export function selectable(s: GameState): string[] {
  const ids = new Set<string>();
  for (const a of legalActions(s)) if (a.kind !== 'pass') ids.add(a.spyId);
  return [...ids];
}

export const reserveSpyId = (s: GameState): string | null =>
  legalActions(s).find((a) => a.kind === 'deploy')?.spyId ?? null;

const sameAction = (a: Action | null, b: Action): boolean =>
  !!a &&
  a.kind === b.kind &&
  (a.kind === 'pass' || (b.kind !== 'pass' && a.spyId === b.spyId && sameCell(a.to, b.to)));

export function reduce(
  s: GameState,
  ui: UiState,
  input: Input,
  confirm: boolean,
): { ui: UiState; commit: Action | null } {
  if (s.winner !== null) return { ui: IDLE, commit: null };
  const keep = { ui, commit: null };
  switch (input.kind) {
    case 'cancel':
      return { ui: IDLE, commit: null };
    case 'reserve': {
      const id = reserveSpyId(s);
      if (!id) return keep;
      return { ui: ui.selected === id ? IDLE : { selected: id, preview: null }, commit: null };
    }
    case 'hover': {
      if (!ui.selected) return keep;
      const hit = input.cell
        ? spyActions(s, ui.selected).find((a) => a.kind !== 'pass' && sameCell(a.to, input.cell!))
        : undefined;
      return { ui: { selected: ui.selected, preview: hit ?? null }, commit: null };
    }
    case 'cell': {
      const target = ui.selected
        ? spyActions(s, ui.selected).find((a) => a.kind !== 'pass' && sameCell(a.to, input.cell))
        : undefined;
      if (target) {
        if (!confirm || sameAction(ui.preview, target)) return { ui: IDLE, commit: target };
        return { ui: { selected: ui.selected, preview: target }, commit: null };
      }
      const here = s.spies.find(
        (p) => p.owner === s.current && p.pos && sameCell(p.pos, input.cell),
      );
      if (here && selectable(s).includes(here.id)) {
        return { ui: { selected: here.id, preview: null }, commit: null };
      }
      return { ui: IDLE, commit: null };
    }
  }
}
