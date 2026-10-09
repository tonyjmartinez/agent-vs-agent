import type { Action, Cell, GameEvent, GameState } from '../engine/types';

export interface Highlights {
  /** Spy currently selected, or 'reserve' when a reserve spy is being deployed. */
  selected: string | 'reserve' | null;
  /** Spies the current human may select (subtle hint ring). */
  selectable: string[];
  /** Legal destination cells for the selection. */
  targets: Cell[];
  /** Keyboard cursor cell (desktop nicety). */
  cursor: Cell | null;
  /** The previous action's footprint, so you can see what just happened (esp. bot moves). */
  lastMove: { from: Cell | null; to: Cell; owner: number } | null;
}

export interface ViewHandlers {
  onTap(cell: Cell, touch: boolean): void;
  onHover(cell: Cell | null): void;
}

/** Narrow boundary between the controller and whatever renders the board (PLAN 4.5, adapted). */
export interface BoardView {
  mount(el: HTMLElement): Promise<void>;
  sync(s: GameState): void;
  play(events: GameEvent[], before: GameState): Promise<void>;
  setHandlers(h: ViewHandlers): void;
  setHighlights(h: Highlights): void;
  showPreview(action: Action | null, events: GameEvent[] | null): void;
  cellToClient(c: Cell): { x: number; y: number };
  setSpeed(n: number): void;
  /** Re-measure after DOM layout changes. */
  relayout(): void;
  destroy(): void;
}
