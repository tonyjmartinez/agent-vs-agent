import Phaser from 'phaser';
import { theme, hex } from '../ui/theme';
import { CELL, MARGIN, SIZE, WORLD, cellCenter, pointToCell } from './geometry';

/** Phase 0 skeleton scene: draws the grid and reports taps. */
export class BoardScene extends Phaser.Scene {
  onReady: () => void = () => {};
  onCellTap: (r: number, c: number) => void = () => {};
  private flash!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('board');
  }

  create(): void {
    const g = this.add.graphics();
    g.fillStyle(hex(theme.board), 1);
    g.fillRoundedRect(MARGIN - 18, MARGIN - 18, CELL * SIZE + 36, CELL * SIZE + 36, 36);
    g.lineStyle(6, hex(theme.ink), 1);
    g.strokeRoundedRect(MARGIN - 18, MARGIN - 18, CELL * SIZE + 36, CELL * SIZE + 36, 36);
    const gap = CELL * 0.06;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        g.fillStyle(hex((r + c) % 2 ? theme.tileB : theme.tileA), 1);
        g.fillRoundedRect(
          MARGIN + c * CELL + gap / 2,
          MARGIN + r * CELL + gap / 2,
          CELL - gap,
          CELL - gap,
          18,
        );
      }
    }
    this.flash = this.add
      .rectangle(0, 0, CELL - gap, CELL - gap, hex(theme.mustard), 0.6)
      .setVisible(false);
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const cell = pointToCell(p.x, p.y);
      if (!cell) return;
      console.log('tap', cell);
      const { x, y } = cellCenter(cell.r, cell.c);
      this.flash.setPosition(x, y).setVisible(true).setAlpha(0.6);
      this.tweens.add({ targets: this.flash, alpha: 0, duration: 250 });
      this.onCellTap(cell.r, cell.c);
    });
    void WORLD;
    this.onReady();
  }
}
