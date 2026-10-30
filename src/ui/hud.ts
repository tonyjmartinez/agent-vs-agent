import type { GameState, PlayerId } from '../engine/types';

export const PLAYER_NAMES = ['Red', 'Teal', 'Plum', 'Olive'];

export interface HudHandlers {
  onReserve(player: PlayerId): void;
  onUndo(): void;
  onMenu(): void;
}

export interface HudOptions {
  canUndo: boolean;
  /** Reserve token highlighted (a deploy is being picked). */
  reserveSelected: boolean;
  /** False while animating or while a bot is on move. */
  interactive: boolean;
  /** Which seats are bots (named "Agent <colour>"). */
  bots: boolean[];
}

/** Two docked panels (top = player 1, bottom = player 0): name, score, turn marker, reserve tray. */
export class Hud {
  private panels: HTMLElement[] = [];
  private undo: HTMLButtonElement;
  private menu: HTMLButtonElement;

  constructor(
    top: HTMLElement,
    bottom: HTMLElement,
    private handlers: HudHandlers,
  ) {
    [top, bottom].forEach((host, i) => {
      const player = i === 0 ? 1 : 0;
      host.innerHTML = '';
      const panel = document.createElement('div');
      panel.className = 'panel';
      panel.dataset.player = String(player);
      panel.innerHTML = `
        <span class="swatch p${player}" aria-hidden="true"></span>
        <span class="name"></span>
        <span class="score" data-testid="score-${player}"></span>
        <span class="tray" data-testid="tray-${player}"></span>
        <span class="turn" data-testid="turn-${player}"></span>`;
      host.appendChild(panel);
      this.panels[player] = panel;
    });
    this.undo = document.createElement('button');
    this.undo.className = 'btn';
    this.undo.type = 'button';
    this.undo.textContent = 'Undo';
    this.undo.dataset.testid = 'undo';
    this.undo.addEventListener('click', () => this.handlers.onUndo());
    this.menu = document.createElement('button');
    this.menu.className = 'btn';
    this.menu.type = 'button';
    this.menu.textContent = 'Menu';
    this.menu.dataset.testid = 'menu-btn';
    this.menu.addEventListener('click', () => this.handlers.onMenu());
    const controls = document.createElement('span');
    controls.className = 'controls';
    controls.append(this.undo, this.menu);
    bottom.appendChild(controls);
  }

  render(s: GameState, o: HudOptions): void {
    s.rules.players.forEach((_, p) => {
      const panel = this.panels[p];
      if (!panel) return;
      const active = s.winner === null && s.current === p;
      panel.classList.toggle('active', active);
      panel.querySelector('.name')!.textContent = o.bots[p]
        ? `Agent ${PLAYER_NAMES[p]}`
        : PLAYER_NAMES[p]!;
      panel.querySelector('.score')!.textContent = `Score ${s.scores[p]}/${s.rules.intelToWin}`;
      panel.querySelector('.turn')!.textContent =
        s.winner === p
          ? 'Winner!'
          : active
            ? o.bots[p]
              ? `Agent ${PLAYER_NAMES[p]} is thinking…`
              : 'Your turn'
            : '';
      const tray = panel.querySelector('.tray')!;
      tray.innerHTML = '';
      const reserve = s.spies.filter((x) => x.owner === p && !x.pos);
      reserve.forEach(() => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `reserve p${p}`;
        b.dataset.testid = `reserve-${p}`;
        b.setAttribute('aria-label', `Deploy ${PLAYER_NAMES[p]} spy from reserve`);
        b.disabled = !(active && o.interactive);
        b.setAttribute('aria-pressed', String(active && o.reserveSelected));
        b.addEventListener('click', () => this.handlers.onReserve(p));
        tray.appendChild(b);
      });
    });
    this.undo.disabled = !o.canUndo || !o.interactive;
  }
}
