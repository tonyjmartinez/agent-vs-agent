import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import './ui/styles.css';
import Phaser from 'phaser';
import { BoardScene } from './view/BoardScene';
import { WORLD, cellCenter } from './view/geometry';

async function boot(): Promise<void> {
  await Promise.all([
    document.fonts.load('700 48px Fredoka'),
    document.fonts.load('500 16px Fredoka'),
  ]);
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  document.getElementById('hud-top')!.textContent = 'Agent Teal';
  document.getElementById('hud-bottom')!.textContent = 'Agent Red';
  const scene = new BoardScene();
  const ready = new Promise<void>((res) => (scene.onReady = res));
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'board',
    transparent: true,
    banner: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: WORLD,
      height: WORLD,
    },
    scene: [scene],
  });
  const w = window as unknown as Record<string, unknown>;
  w.__AVA__ = {
    ready,
    cellClient(r: number, c: number) {
      const rect = game.canvas.getBoundingClientRect();
      const p = cellCenter(r, c);
      return {
        x: rect.left + (p.x / WORLD) * rect.width,
        y: rect.top + (p.y / WORLD) * rect.height,
      };
    },
  };
}

void boot();
