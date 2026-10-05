import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import './ui/styles.css';
import { Controller } from './app/controller';
import { parseConfig } from './app/config';
import { installHooks } from './app/testHooks';
import { decode } from './engine/serialize';
import { showGameOver } from './ui/gameOver';
import { Hud } from './ui/hud';
import { PhaserBoardView } from './view/PhaserBoardView';

const cfg = parseConfig(location.search);
let controller: Controller | null = null;
const view = new PhaserBoardView();
const overlayRoot = document.getElementById('overlay-root')!;

async function boot(): Promise<void> {
  await Promise.all([
    document.fonts.load('700 48px Fredoka'),
    document.fonts.load('500 16px Fredoka'),
  ]);
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await view.mount(document.getElementById('board')!);
  view.setSpeed(cfg.speed);
  const hud = new Hud(document.getElementById('hud-top')!, document.getElementById('hud-bottom')!, {
    onReserve: (p) => controller?.onReserve(p),
    onUndo: () => {
      document.getElementById('game-over')?.remove();
      controller?.undo();
    },
    onMenu: () => newGame(),
  });
  controller = new Controller({
    view,
    hud,
    seats: cfg.seats,
    speed: cfg.speed,
    confirmTouch: cfg.confirmTouch ?? true,
    seed: cfg.seed,
    onGameOver: (s) =>
      showGameOver(overlayRoot, s, controller!.seats, {
        rematch: () => newGame(),
        menu: () => newGame(),
      }),
  });
  controller.start(cfg.state ? decode(cfg.state) : undefined);
}

function newGame(): void {
  document.getElementById('game-over')?.remove();
  controller?.start();
}

const ready = boot();
if (import.meta.env.DEV || cfg.test) installHooks(ready, () => ({ controller, view }));
