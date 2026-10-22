import type { Action, Cell, GameEvent, GameState } from '../engine/types';

export interface InteractionView {
  selected: string | null;
  /** Cells the selected spy may act on. */
  targets: Cell[];
  /** Events of the previewed action, drawn as ghost/arrows/tints. */
  preview: GameEvent[] | null;
  /** Spy ids that can be selected (to hint at them). */
  selectable: string[];
}

export interface BoardHandlers {
  onCell(cell: Cell): void;
  onHover(cell: Cell | null): void;
}

/** The narrow boundary between the controller and the renderer (PLAN.md 4.5). */
export interface BoardView {
  mount(el: HTMLElement, handlers: BoardHandlers): Promise<void>;
  /** Snap everything to the authoritative state, no animation. */
  sync(s: GameState): void;
  /** Animate events grouped by phase; resolves when done. Always followed by `sync`. */
  play(events: GameEvent[], speed: number): Promise<void>;
  setInteraction(i: InteractionView): void;
  /** Viewport coordinates of a cell centre (tests). */
  cellToClient(c: Cell): { x: number; y: number };
  destroy(): void;
}

export type { Action };
