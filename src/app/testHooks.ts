import { legalActions } from '../engine/engine';
import { encode } from '../engine/serialize';
import type { Action, GameState } from '../engine/types';
import type { BoardView } from '../view/BoardView';
import type { Controller } from './controller';

export interface AvaHooks {
  ready: Promise<void>;
  getState(): GameState;
  encode(): string;
  legal(): Action[];
  act(a: Action): Promise<void>;
  idle(): Promise<void>;
  cellClient(r: number, c: number): { x: number; y: number };
  setSpeed(n: number): void;
  controller(): Controller | null;
}

export function installHooks(
  ready: Promise<void>,
  get: () => { controller: Controller | null; view: BoardView | null },
): void {
  const ctl = () => {
    const c = get().controller;
    if (!c) throw new Error('no game running');
    return c;
  };
  const hooks: AvaHooks = {
    ready,
    getState: () => ctl().state,
    encode: () => encode(ctl().state),
    legal: () => legalActions(ctl().state),
    act: (a) => ctl().commit(a),
    async idle() {
      while (get().controller && (ctl().busy || ctl().thinking))
        await new Promise((r) => setTimeout(r, 20));
    },
    cellClient: (r, c) => get().view!.cellToClient({ r, c }),
    setSpeed: (n) => ctl().setSpeed(n),
    controller: () => get().controller,
  };
  (window as unknown as { __AVA__: AvaHooks }).__AVA__ = hooks;
}
