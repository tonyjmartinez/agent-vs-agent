import './ui/styles.css';
import { parseConfig } from './app/config';
import { Controller } from './app/controller';
import { installTestHooks } from './app/testHooks';
import { PhaserBoardView } from './view/PhaserBoardView';
import { Hud } from './ui/hud';
import { GameOver } from './ui/gameOver';
import { gameSearch, menuSearch } from './app/navigation';
import { Coach } from './ui/coach';
import { Menu } from './ui/menu';
import { PauseMenu } from './ui/pauseMenu';
import { RulesCard } from './ui/rulesCard';

const coarse = matchMedia('(pointer: coarse)').matches;
const config = parseConfig(location.search, coarse, import.meta.env.DEV);
const el = (id: string) => document.getElementById(id)!;
const rules = new RulesCard(el('rules'));

if (config.menu) {
  // Start menu: choosing a mode reloads with the game's URL params (a clean boot of Phaser and state).
  new Menu(el('menu'), {
    onStart: (mode) => {
      location.search = gameSearch(location.search, mode);
    },
    onRules: () => rules.open(),
  });
} else {
  startGame();
}

function startGame(): void {
  const view = new PhaserBoardView();
  const coach = new Coach(el('coach'), config.confirm, config.coach);
  const pause = new PauseMenu(el('pause'), {
    onRestart: () => controller.rematch(),
    onRules: () => rules.open(),
    onQuit: () => {
      location.search = menuSearch(location.search);
    },
  });
  const hud = new Hud(el('hud-top'), el('hud-bottom'), {
    onReserve: () => controller.tapReserve(),
    onUndo: () => controller.undo(),
    onMenu: () => pause.open(),
  });
  const gameOver = new GameOver(el('gameover'), () => controller.rematch());
  const controller = new Controller({ view, hud, gameOver, config, coach });

  const ready = view
    .mount(el('board'), {
      onCell: (cell) => controller.tapCell(cell),
      onHover: (cell) => controller.hover(cell),
    })
    .then(() => controller.start());

  installTestHooks(config.test, {
    ready,
    confirm: config.confirm,
    seats: config.seats.map((x) => (x.kind === 'bot' ? `bot:${x.level}` : 'human')),
    getState: () => controller.state,
    legal: () => controller.legal(),
    act: (a) => controller.act(a),
    cellClient: (r, c) => view.cellToClient({ r, c }),
    setSpeed: (n) => {
      controller.speed = n;
    },
  });
}
