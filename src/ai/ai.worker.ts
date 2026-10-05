/// <reference lib="webworker" />
import { chooseAction, type BotOpts, type Level } from './bots';
import type { GameState } from '../engine/types';

interface Req {
  id: number;
  state: GameState;
  level: Level;
  seed: number;
  opts: BotOpts;
}

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, state, level, seed, opts } = e.data;
  const t = performance.now();
  // The worker may use a clock; ai/ itself never reads one.
  const r = chooseAction(state, level, seed, {
    ...opts,
    now: () => performance.now(),
    timeMs: 600,
  });
  (self as unknown as Worker).postMessage({ id, result: r, ms: performance.now() - t });
};
