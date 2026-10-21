import Phaser from 'phaser';
import { hex, theme } from '../ui/theme';

export const LOGICAL = 1080;
export const MARGIN = 72;
export const CELL = 156;
export const N = 6;

export class BoardScene extends Phaser.Scene {
  private tiles: Phaser.GameObjects.Graphics[] = [];

  constructor(private onTile: (r: number, c: number) => void) {
    super('board');
  }

  create(): void {
    const bg = this.add.graphics();
    bg.fillStyle(hex(theme.board), 1);
    bg.fillRoundedRect(MARGIN - 18, MARGIN - 18, CELL * N + 36, CELL * N + 36, 36);
    bg.lineStyle(6, hex(theme.ink), 1);
    bg.strokeRoundedRect(MARGIN - 18, MARGIN - 18, CELL * N + 36, CELL * N + 36, 36);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const x = MARGIN + CELL * c;
        const y = MARGIN + CELL * r;
        const g = this.add.graphics({ x, y });
        this.paint(g, (r + c) % 2 === 0 ? theme.tileA : theme.tileB);
        const hit = this.add.zone(x + CELL / 2, y + CELL / 2, CELL, CELL).setInteractive();
        hit.on('pointerup', () => {
          this.onTile(r, c);
          this.paint(g, theme.mustard);
          this.time.delayedCall(180, () =>
            this.paint(g, (r + c) % 2 === 0 ? theme.tileA : theme.tileB),
          );
        });
        this.tiles.push(g);
      }
    }
  }

  private paint(g: Phaser.GameObjects.Graphics, color: string): void {
    const gap = Math.round(CELL * 0.06);
    g.clear();
    g.fillStyle(hex(color), 1);
    g.fillRoundedRect(gap / 2, gap / 2, CELL - gap, CELL - gap, 18);
  }
}
