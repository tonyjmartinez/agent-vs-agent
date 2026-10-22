import Phaser from 'phaser';
import type { Cell, GameEvent, GameState } from '../engine/types';
import type { BoardHandlers, BoardView, InteractionView } from './BoardView';
import { BoardScene, LOGICAL, cellX, cellY } from './BoardScene';

export class PhaserBoardView implements BoardView {
  private game?: Phaser.Game;
  private scene?: BoardScene;

  async mount(el: HTMLElement, handlers: BoardHandlers): Promise<void> {
    await document.fonts.load('500 16px Fredoka');
    // Phaser needs a laid-out parent (PLAN.md risk 4).
    await new Promise<void>((res) => requestAnimationFrame(() => res()));
    await new Promise<void>((resolve) => {
      this.scene = new BoardScene(handlers, resolve);
      this.game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: el,
        transparent: true,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: LOGICAL,
          height: LOGICAL,
        },
        scene: [this.scene],
      });
    });
  }

  sync(s: GameState): void {
    this.scene?.sync(s);
  }

  play(events: GameEvent[], speed: number): Promise<void> {
    return this.scene ? this.scene.play(events, speed) : Promise.resolve();
  }

  setInteraction(i: InteractionView): void {
    this.scene?.setInteraction(i);
  }

  cellToClient(c: Cell): { x: number; y: number } {
    const rect = this.game!.canvas.getBoundingClientRect();
    return {
      x: rect.left + (cellX(c.c) / LOGICAL) * rect.width,
      y: rect.top + (cellY(c.r) / LOGICAL) * rect.height,
    };
  }

  destroy(): void {
    this.game?.destroy(true);
  }
}
