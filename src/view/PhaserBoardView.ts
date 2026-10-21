import Phaser from 'phaser';
import { BoardScene, LOGICAL } from './BoardScene';

export class PhaserBoardView {
  game?: Phaser.Game;

  async mount(el: HTMLElement, onTile: (r: number, c: number) => void): Promise<void> {
    await document.fonts.load('500 16px Fredoka');
    // Phaser needs a laid-out parent (PLAN.md risk 4).
    await new Promise<void>((res) => requestAnimationFrame(() => res()));
    await new Promise<void>((resolve) => {
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
        scene: [new BoardScene(onTile)],
        callbacks: { postBoot: () => resolve() },
      });
    });
  }

  destroy(): void {
    this.game?.destroy(true);
  }
}
