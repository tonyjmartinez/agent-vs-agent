import type { GameState, PlayerId } from '../engine/types';
import type { Seat } from '../app/config';
import { headSvg, spySvg, svgUri } from './art';
import { playerNames } from './theme';

const heads = [0, 1].map((p) => `url("${svgUri(headSvg(p))}")`);
const bodies = [0, 1].map((p) => `url("${svgUri(spySvg(p))}")`);

export interface HudHandlers {
  onReserve(owner: PlayerId): void;
  onUndo(): void;
  onMenu(): void;
  onSound(): void;
  soundOn(): boolean;
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

const speaker = (on: boolean) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>${
    on
      ? '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
      : '<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
  }</svg>`;

export class Hud {
  private lastScores: number[] = [];
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
    const snd = el('button', 'btn icon');
    snd.id = 'btn-sound';
    const on = this.h.soundOn();
    snd.setAttribute('aria-label', on ? 'Mute sound' : 'Unmute sound');
    snd.setAttribute('aria-pressed', String(!on));
    snd.innerHTML = speaker(on);
    snd.addEventListener('click', () => this.h.onSound());
    controls.append(undo, menu, snd);
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
    const chip = el('span', `chip p${p}`);
    chip.style.backgroundImage = heads[p % 2]!;
    who.append(chip, el('span', 'name', seatLabel(seat, p, v.seats)));
    if (seat?.kind === 'bot') who.append(el('span', 'tag', levelName[seat.level] ?? ''));
    const score = el('div', 'score');
    score.setAttribute('aria-label', `${s.scores[p]} of ${s.rules.intelToWin} intel`);
    score.dataset.testid = `score-${p}`;
    score.dataset.score = String(s.scores[p]);
    const prev = this.lastScores[p] ?? 0;
    const now = s.scores[p] ?? 0;
    for (let i = 0; i < s.rules.intelToWin; i++) {
      // A pip filled since the last render pops (the "folder lands in the counter" beat).
      score.append(el('span', `pip${i < now ? ' full' : ''}${i < now && i >= prev ? ' new' : ''}`));
    }
    this.lastScores[p] = now;
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
      b.style.backgroundImage = bodies[p % 2]!;
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
