import type { Action, Cell, GameState } from '../engine/types';

export interface AvaHooks {
  ready: Promise<void>;
  /** True when a move needs a second tap to commit. */
  confirm: boolean;
  getState(): GameState;
  legal(): Action[];
  act(a: Action): Promise<void>;
  cellClient(r: number, c: number): { x: number; y: number };
  setSpeed(n: number): void;
}

declare global {
  interface Window {
    __AVA__?: AvaHooks;
  }
}

export function installTestHooks(enabled: boolean, hooks: AvaHooks): void {
  if (enabled) window.__AVA__ = hooks;
}

export type { Cell };
