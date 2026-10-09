import type { BotLevel, Seat } from '../app/config';
import { spySvg, svgUri } from './art';
import { showRules } from './rulesCard';
import { load, save } from './storage';

export interface MenuChoice {
  seats: [Seat, Seat];
}

const KEY = 'ava.menu.v1';

/** Start menu: Play vs Agent (Easy/Medium/Hard), Pass & Play, How to play. */
export function showMenu(root: HTMLElement, onStart: (c: MenuChoice) => void): void {
  const last = load<{ level: BotLevel }>(KEY, { level: 'easy' });
  const wrap = document.createElement('div');
  wrap.className = 'overlay menu-overlay';
  wrap.id = 'menu';
  wrap.innerHTML = `<div class="card menu" role="dialog" aria-modal="true" aria-labelledby="menu-title">
    <div class="logo" aria-hidden="true">
      <img src="${svgUri(spySvg(0))}" alt="" width="72" height="84" />
      <img src="${svgUri(spySvg(1))}" alt="" width="72" height="84" class="flip" />
    </div>
    <h1 id="menu-title" class="stamp title-stamp">AGENT vs AGENT</h1>
    <p class="tag-line">Bump. Grab. Get home.</p>
    <div class="menu-section">
      <div class="menu-label">Play vs Agent</div>
      <div class="seg" role="radiogroup" aria-label="Difficulty">
        ${(['easy', 'medium', 'hard'] as BotLevel[])
          .map(
            (l) =>
              `<button class="btn seg-btn${l === last.level ? ' on' : ''}" role="radio" aria-checked="${l === last.level}" data-level="${l}">${l[0]!.toUpperCase() + l.slice(1)}</button>`,
          )
          .join('')}
      </div>
      <button class="btn primary big" id="btn-play-bot">Play vs Agent</button>
    </div>
    <button class="btn big" id="btn-hotseat">Pass &amp; Play</button>
    <button class="btn big" id="btn-howto">How to play</button>
  </div>`;
  let level = last.level;
  wrap.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach((b) =>
    b.addEventListener('click', () => {
      level = b.dataset.level as BotLevel;
      wrap.querySelectorAll('.seg-btn').forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-checked', String(x === b));
      });
    }),
  );
  const start = (seats: [Seat, Seat]) => {
    save(KEY, { level });
    wrap.remove();
    onStart({ seats });
  };
  wrap
    .querySelector('#btn-play-bot')!
    .addEventListener('click', () => start([{ kind: 'human' }, { kind: 'bot', level }]));
  wrap
    .querySelector('#btn-hotseat')!
    .addEventListener('click', () => start([{ kind: 'human' }, { kind: 'human' }]));
  wrap.querySelector('#btn-howto')!.addEventListener('click', () => showRules(root));
  root.append(wrap);
}

/** In-game pause menu: Resume, Restart, Rules, Quit to menu. */
export function showPause(root: HTMLElement, on: { restart(): void; quit(): void }): void {
  const wrap = document.createElement('div');
  wrap.className = 'overlay';
  wrap.id = 'pause';
  wrap.innerHTML = `<div class="card menu" role="dialog" aria-modal="true" aria-label="Paused">
    <h2 class="title">Paused</h2>
    <button class="btn primary big" id="btn-resume">Resume</button>
    <button class="btn big" id="btn-restart">Restart</button>
    <button class="btn big" id="btn-rules">Rules</button>
    <button class="btn big" id="btn-quit">Quit to menu</button>
  </div>`;
  const close = () => wrap.remove();
  wrap.querySelector('#btn-resume')!.addEventListener('click', close);
  wrap.querySelector('#btn-restart')!.addEventListener('click', () => {
    close();
    on.restart();
  });
  wrap.querySelector('#btn-rules')!.addEventListener('click', () => showRules(root));
  wrap.querySelector('#btn-quit')!.addEventListener('click', () => {
    close();
    on.quit();
  });
  root.append(wrap);
}
