import './ui/styles.css';
import { parseConfig } from './app/config';
import { Controller } from './app/controller';
import { installTestHooks } from './app/testHooks';
import { PhaserBoardView } from './view/PhaserBoardView';
import { Hud } from './ui/hud';
import { GameOver } from './ui/gameOver';

const coarse = matchMedia('(pointer: coarse)').matches;
const config = parseConfig(location.search, coarse, import.meta.env.DEV);
const view = new PhaserBoardView();
const el = (id: string) => document.getElementById(id)!;

const hud = new Hud(el('hud-top'), el('hud-bottom'), {
  onReserve: () => controller.tapReserve(),
  onUndo: () => controller.undo(),
});
const gameOver = new GameOver(el('gameover'), () => controller.rematch());
const controller = new Controller({ view, hud, gameOver, config });

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
