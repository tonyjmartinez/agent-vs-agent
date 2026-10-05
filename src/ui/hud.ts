import type { GameState, PlayerId } from '../engine/types';
import type { Seat } from '../app/config';
import { playerNames } from './theme';

export interface HudHandlers {
  onReserve(owner: PlayerId): void;
  onUndo(): void;
  onMenu(): void;
}

export interface HudView {
  state: GameState;
  seats: Seat[];
  reserveSelected: boolean;
  thinking: boolean;
  canUndo: boolean;
  /** Seat index whose panel goes at the bottom (the local human in vs-bot games). */
  bottom: PlayerId;
}

const levelName: Record<string, string> = {
  random: 'Rookie',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export function seatLabel(seat: Seat | undefined, p: PlayerId, seats: Seat[]): string {
  const humans = seats.filter((s) => s.kind === 'human').length;
  if (!seat || seat.kind === 'human') return humans === 1 ? 'You' : `Agent ${playerNames[p]}`;
  return `Agent ${playerNames[p]}`;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export class Hud {
  constructor(
    private top: HTMLElement,
    private bottom: HTMLElement,
    private h: HudHandlers,
  ) {}

  render(v: HudView): void {
    const other = (v.bottom + 1) % 2;
    this.top.replaceChildren(this.panel(v, other));
    const controls = el('div', 'controls');
    const undo = el('button', 'btn', 'Undo');
    undo.id = 'btn-undo';
    undo.disabled = !v.canUndo;
    undo.addEventListener('click', () => this.h.onUndo());
    const menu = el('button', 'btn', 'Menu');
    menu.id = 'btn-menu';
    menu.addEventListener('click', () => this.h.onMenu());
    controls.append(undo, menu);
    this.bottom.replaceChildren(this.panel(v, v.bottom), controls);
  }

  private panel(v: HudView, p: PlayerId): HTMLElement {
    const s = v.state;
    const seat = v.seats[p];
    const active = s.winner === null && s.current === p;
    const box = el('section', `panel p${p}${active ? ' active' : ''}`);
    box.dataset.player = String(p);
    const row = el('div', 'row');
    const who = el('div', 'who');
    who.append(el('span', `chip p${p}`), el('span', 'name', seatLabel(seat, p, v.seats)));
    if (seat?.kind === 'bot') who.append(el('span', 'tag', levelName[seat.level] ?? ''));
    const score = el('div', 'score');
    score.setAttribute('aria-label', `${s.scores[p]} of ${s.rules.intelToWin} intel`);
    score.dataset.testid = `score-${p}`;
    score.dataset.score = String(s.scores[p]);
    for (let i = 0; i < s.rules.intelToWin; i++)
      score.append(el('span', `pip${i < (s.scores[p] ?? 0) ? ' full' : ''}`));
    row.append(who, score);
    const status = el('div', 'status');
    status.setAttribute('aria-live', 'polite');
    if (active) {
      const humans = v.seats.filter((x) => x.kind === 'human').length;
      status.textContent =
        seat?.kind === 'bot'
          ? v.thinking
            ? `Agent ${playerNames[p]} is thinking…`
            : `Agent ${playerNames[p]}'s move`
          : humans === 1
            ? 'Your move'
            : `${playerNames[p]}'s move`;
    }
    const tray = el('div', 'tray');
    const reserve = s.spies.filter((x) => x.owner === p && !x.pos);
    reserve.forEach((x, i) => {
      const b = el(
        'button',
        `reserve-spy p${p}${v.reserveSelected && active && i === 0 ? ' selected' : ''}`,
      );
      b.setAttribute('aria-label', `Deploy reserve spy ${x.id}`);
      b.dataset.testid = `reserve-${p}`;
      b.disabled = !(active && seat?.kind === 'human');
      b.addEventListener('click', () => this.h.onReserve(p));
      tray.append(b);
    });
    if (reserve.length) tray.prepend(el('span', 'tray-label', 'Reserve'));
    // Second row: turn status on the left, reserve tray on the right (fixed 44px height).
    const row2 = el('div', 'row row2');
    row2.append(status, tray);
    box.append(row, row2);
    return box;
  }
}
