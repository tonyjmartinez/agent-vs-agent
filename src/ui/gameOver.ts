import type { GameState } from '../engine/types';
import { PLAYER_NAMES } from './hud';

export class GameOver {
  private el: HTMLElement;
  private text: HTMLElement;

  constructor(host: HTMLElement, onRematch: () => void) {
    host.hidden = true;
    host.innerHTML = `
      <div class="card" role="dialog" aria-modal="true" aria-labelledby="go-title">
        <h2 id="go-title" data-testid="winner-text"></h2>
        <button type="button" class="btn primary" data-testid="rematch">Rematch</button>
      </div>`;
    this.el = host;
    this.text = host.querySelector('h2')!;
    host.querySelector('button')!.addEventListener('click', onRematch);
  }

  render(s: GameState): void {
    this.el.hidden = s.winner === null;
    if (s.winner === null) return;
    this.text.textContent =
      s.winner === 'draw' ? 'Draw!' : `Mission complete: ${PLAYER_NAMES[s.winner]} wins!`;
  }
}
