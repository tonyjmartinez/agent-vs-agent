import Phaser from 'phaser';
import type { Action, Cell, GameEvent, GameState } from '../engine/types';
import { BoardScene } from './BoardScene';
import type { BoardView, Highlights, ViewHandlers } from './BoardView';
import { WORLD, cellCenter } from './geometry';

export class PhaserBoardView implements BoardView {
  private game: Phaser.Game | null = null;
  private scene = new BoardScene();

  async mount(el: HTMLElement): Promise<void> {
    const ready = new Promise<void>((res) => (this.scene.onReady = res));
    this.scene.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: el,
      transparent: true,
      banner: false,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: WORLD,
        height: WORLD,
      },
      render: { preserveDrawingBuffer: new URLSearchParams(location.search).get('test') === '1' },
      scene: [this.scene],
    });
    await ready;
    // The canvas can move without resizing (HUD content changes above it); keep input mapping fresh.
    const ro = new ResizeObserver(() => this.relayout());
    ro.observe(document.body);
    for (const id of ['hud-top', 'hud-bottom', 'board']) {
      const e = document.getElementById(id);
      if (e) ro.observe(e);
    }
  }

  relayout(): void {
    this.game?.scale.refresh();
  }

  sync(s: GameState): void {
    this.scene.sync(s);
  }
  play(events: GameEvent[], before: GameState): Promise<void> {
    return this.scene.play(events, before);
  }
  setHandlers(h: ViewHandlers): void {
    this.scene.handlers = h;
  }
  setHighlights(h: Highlights): void {
    this.scene.setHighlights(h);
  }
  showPreview(action: Action | null, events: GameEvent[] | null): void {
    this.scene.showPreview(action, events);
  }
  setSpeed(n: number): void {
    this.scene.speed = n;
  }
  cellToClient(c: Cell): { x: number; y: number } {
    const rect = this.game!.canvas.getBoundingClientRect();
    const p = cellCenter(c.r, c.c);
    return { x: rect.left + (p.x / WORLD) * rect.width, y: rect.top + (p.y / WORLD) * rect.height };
  }
  destroy(): void {
    this.game?.destroy(true);
    this.game = null;
  }
}
