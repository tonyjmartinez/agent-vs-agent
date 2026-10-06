import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import './ui/styles.css';
import { BotClient } from './app/botClient';
import { Controller } from './app/controller';
import { parseConfig, type Seat } from './app/config';
import { installHooks } from './app/testHooks';
import { duelRules } from './engine/rules';
import { decode } from './engine/serialize';
import { showGameOver } from './ui/gameOver';
import { Hud } from './ui/hud';
import { showMenu, showPause } from './ui/menu';
import { load, save } from './ui/storage';
import { PhaserBoardView } from './view/PhaserBoardView';

const cfg = parseConfig(location.search);
// speed=0 (tests): no CSS animation either, so screenshots are deterministic.
if (cfg.speed === 0) document.documentElement.classList.add('no-motion');
let controller: Controller | null = null;
const view = new PhaserBoardView();
const overlayRoot = document.getElementById('overlay-root')!;
const bots = new BotClient();

// ---------- first-game coach marks (shown once) ----------
const COACH_KEY = 'ava.coach.v1';
let coachDone = cfg.test || load(COACH_KEY, false);
let lastTouch = matchMedia('(pointer: coarse)').matches;
addEventListener('pointerdown', (e: PointerEvent) => (lastTouch = e.pointerType !== 'mouse'), {
  capture: true,
});

function coach(c: Controller): void {
  let el = document.getElementById('coach');
  if (coachDone || !c.isHumanToMove() || document.querySelector('.overlay')) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'coach';
    el.className = 'coach';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = !c.sel.selected
    ? lastTouch
      ? 'Tap one of your spies'
      : 'Click one of your spies'
    : !c.sel.pending
      ? lastTouch
        ? 'Tap a dot to preview the move'
        : 'Hover a dot to preview, click to move'
      : 'Tap again to move';
}

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
    onMenu: () =>
      showPause(overlayRoot, {
        restart: () => newGame(),
        quit: () => toMenu(),
      }),
  });
  controller = new Controller({
    view,
    hud,
    seats: cfg.seats,
    speed: cfg.speed,
    confirmTouch: cfg.confirmTouch ?? true,
    seed: cfg.seed || Math.floor(Math.random() * 1e9),
    rules: cfg.rules,
    chooseBot: (s, level, seed, history) => bots.choose(s, level, seed, history),
    onGameOver: (s) => {
      document.getElementById('coach')?.remove();
      showGameOver(overlayRoot, s, controller!.seats, {
        rematch: () => newGame(),
        menu: () => toMenu(),
      });
    },
    onAction: () => {
      if (!coachDone && controller && controller.history.length > 1) {
        coachDone = true;
        save(COACH_KEY, true);
      }
    },
    onRefresh: coach,
  });
  if (cfg.direct) controller.start(cfg.state ? decode(cfg.state, duelRules(cfg.rules)) : undefined);
  else {
    controller.start();
    toMenu();
  }
}

function newGame(seats?: Seat[]): void {
  document.getElementById('game-over')?.remove();
  controller?.start(undefined, seats);
}

function toMenu(): void {
  document.getElementById('game-over')?.remove();
  document.getElementById('coach')?.remove();
  showMenu(overlayRoot, ({ seats }) => newGame(seats));
}

const ready = boot();
if (import.meta.env.DEV || cfg.test) installHooks(ready, () => ({ controller, view }));
