import { chooseAction, type BotResult, type Level } from '../ai/bots';
import { hash } from '../engine/engine';
import type { Action, GameState } from '../engine/types';
import AiWorker from '../ai/ai.worker.ts?worker&inline';

/**
 * Runs bot search in a Web Worker so animations never hitch. If the worker can't start or
 * errors (some file:// / sandboxed contexts), falls back to searching on the main thread.
 */
export class BotClient {
  private worker: Worker | null = null;
  private next = 1;
  private pending = new Map<number, (r: BotResult | null) => void>();

  constructor() {
    try {
      this.worker = new AiWorker();
      this.worker.onmessage = (e: MessageEvent<{ id: number; result: BotResult }>) => {
        this.pending.get(e.data.id)?.(e.data.result);
        this.pending.delete(e.data.id);
      };
      this.worker.onerror = (e) => {
        console.warn('AI worker failed; using main thread', e.message);
        this.disable();
      };
    } catch (e) {
      console.warn('AI worker unavailable; using main thread', e);
      this.worker = null;
    }
  }

  private disable(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const resolve of this.pending.values()) resolve(null);
    this.pending.clear();
  }

  private local(s: GameState, level: Level, seed: number, history: string[]): Action {
    const now = () => performance.now();
    return chooseAction(s, level, seed, { history, now, timeMs: 400 }).action;
  }

  async choose(s: GameState, level: Level, seed: number, history: GameState[]): Promise<Action> {
    const hist = history.map(hash);
    if (!this.worker) return this.local(s, level, seed, hist);
    const id = this.next++;
    const r = await new Promise<BotResult | null>((res) => {
      this.pending.set(id, res);
      // Safety net: a silent worker must never hang the game.
      setTimeout(() => {
        if (this.pending.has(id)) {
          console.warn('AI worker timed out; using main thread');
          this.disable();
        }
      }, 4000);
      this.worker!.postMessage({ id, state: s, level, seed, opts: { history: hist } });
    });
    return r ? r.action : this.local(s, level, seed, hist);
  }
}
