import type { BotLevel } from '../ai/bots';
import { modeFromString, modeToString, type Mode } from '../app/navigation';
import { KEYS, load, save } from '../app/storage';

const LEVELS: BotLevel[] = ['easy', 'medium', 'hard'];

export interface MenuHandlers {
  onStart(mode: Mode): void;
  onRules(): void;
}

/** Start menu: Play vs Agent (Easy/Medium/Hard), Pass & Play, How to play. Remembers the last mode. */
export class Menu {
  private level: BotLevel = 'medium';

  constructor(
    private el: HTMLElement,
    private h: MenuHandlers,
  ) {
    const last = modeFromString(load(KEYS.lastMode));
    if (last && last !== 'hotseat') this.level = last.bot;
    this.render(last);
  }

  private render(last: Mode | null): void {
    this.el.hidden = false;
    this.el.innerHTML = `
      <div class="card menu" role="dialog" aria-modal="true" aria-labelledby="menu-title">
        <h1 id="menu-title">Agent vs Agent</h1>
        <p class="tagline">Bump. Burn. Extract.</p>
        <div class="levels" role="group" aria-label="Difficulty">
          ${LEVELS.map(
            (l) =>
              `<button type="button" class="btn chip" data-testid="diff-${l}" aria-pressed="${l === this.level}">${l[0]!.toUpperCase()}${l.slice(1)}</button>`,
          ).join('')}
        </div>
        <button type="button" class="btn primary wide" data-testid="play-bot">Play vs Agent</button>
        <button type="button" class="btn wide" data-testid="play-hotseat">Pass &amp; Play</button>
        <button type="button" class="btn wide" data-testid="menu-rules">How to play</button>
        ${last ? `<p class="last" data-testid="last-mode">Last game: ${last === 'hotseat' ? 'Pass &amp; Play' : `vs Agent (${last.bot})`}</p>` : ''}
      </div>`;
    const q = (id: string) => this.el.querySelector(`[data-testid="${id}"]`)!;
    for (const l of LEVELS) {
      q(`diff-${l}`).addEventListener('click', () => {
        this.level = l;
        for (const o of LEVELS) q(`diff-${o}`).setAttribute('aria-pressed', String(o === l));
      });
    }
    q('play-bot').addEventListener('click', () => this.start({ bot: this.level }));
    q('play-hotseat').addEventListener('click', () => this.start('hotseat'));
    q('menu-rules').addEventListener('click', () => this.h.onRules());
  }

  private start(mode: Mode): void {
    save(KEYS.lastMode, modeToString(mode));
    this.h.onStart(mode);
  }
}
