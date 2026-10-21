import './ui/styles.css';
import { PhaserBoardView } from './view/PhaserBoardView';
import { installTestHooks } from './app/testHooks';

const clicks: { r: number; c: number }[] = [];
const view = new PhaserBoardView();
const ready = view.mount(document.getElementById('board')!, (r, c) => {
  console.log({ r, c });
  clicks.push({ r, c });
});
installTestHooks(ready, clicks);
