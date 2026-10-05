import type { GameState } from '../engine/types';
import type { Seat } from '../app/config';
import { playerNames } from './theme';

export function showGameOver(
  root: HTMLElement,
  s: GameState,
  seats: Seat[],
  on: { rematch(): void; menu(): void },
): void {
  const humans = seats.map((x, i) => (x.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  const w = s.winner;
  let title = 'STALEMATE';
  let sub = 'Out of time. The intel stays in the field.';
  if (w !== null && w !== 'draw') {
    const solo = humans.length === 1;
    title = solo
      ? humans[0] === w
        ? 'MISSION COMPLETE'
        : 'MISSION FAILED'
      : `AGENT ${playerNames[w]!.toUpperCase()} WINS`;
    sub = `${s.scores.join(' – ')} · ${Math.ceil(s.ply / 2)} turns`;
  }
  const wrap = document.createElement('div');
  wrap.className = 'overlay';
  wrap.id = 'game-over';
  wrap.innerHTML = `<div class="card stamp-card" role="dialog" aria-modal="true" aria-labelledby="go-title">
    <div class="stamp ${w === null || w === 'draw' ? '' : 'p' + w}" id="go-title">${title}</div>
    <p class="sub">${sub}</p>
    <div class="actions"><button class="btn primary" id="btn-rematch">Rematch</button><button class="btn" id="btn-go-menu">Menu</button></div>
  </div>`;
  wrap.querySelector('#btn-rematch')!.addEventListener('click', () => {
    wrap.remove();
    on.rematch();
  });
  wrap.querySelector('#btn-go-menu')!.addEventListener('click', () => {
    wrap.remove();
    on.menu();
  });
  root.append(wrap);
}
