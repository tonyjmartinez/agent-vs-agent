import type { GameState } from '../engine/types';
import type { MatchStats } from '../engine/stats';
import type { Seat } from '../app/config';
import { playerNames } from './theme';

const STAT_ROWS = [
  ['turns', 'Turns'],
  ['burns', 'Burns'],
  ['steals', 'Steals'],
  ['shoves', 'Shoves'],
  ['extractions', 'Banked'],
] as const;

/** Per-player stats table; the strict leader of each row is bold. */
export function statsTable(stats: MatchStats): string {
  const head = stats.map((_, p) => `<th scope="col" class="p${p}">${playerNames[p]}</th>`).join('');
  const rows = STAT_ROWS.map(([key, label]) => {
    const vals = stats.map((p) => p[key]);
    const top = Math.max(...vals);
    const lead = vals.filter((v) => v === top).length === 1 && top > 0;
    const cells = vals
      .map(
        (v, p) =>
          `<td data-testid="stat-${key}-${p}"${lead && v === top ? ' class="lead"' : ''}>${v}</td>`,
      )
      .join('');
    return `<tr><th scope="row">${label}</th>${cells}</tr>`;
  }).join('');
  return `<table class="stats" data-testid="stats"><caption class="sr-only">Match stats</caption><thead><tr><td></td>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

export function showGameOver(
  root: HTMLElement,
  s: GameState,
  seats: Seat[],
  stats: MatchStats,
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
    ${statsTable(stats)}
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
