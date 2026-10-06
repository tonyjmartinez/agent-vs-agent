import { theme } from './theme';

/** Tiny inline-SVG diagrams for the rules card. 3×3 mini boards, 30px cells. */
const C = 30;
const tile = (r: number, c: number, tint?: string) =>
  `<rect x="${c * C + 2}" y="${r * C + 2}" width="${C - 4}" height="${C - 4}" rx="6" fill="${tint ?? ((r + c) % 2 ? theme.tileB : theme.tileA)}"/>`;
const red = (r: number, c: number, ghost = false) =>
  `<circle cx="${c * C + C / 2}" cy="${r * C + C / 2}" r="10" fill="${theme.red}" stroke="${theme.ink}" stroke-width="2.5" ${ghost ? 'opacity=".45"' : ''}/>`;
const teal = (r: number, c: number, ghost = false) =>
  `<rect x="${c * C + 5}" y="${r * C + 5}" width="${C - 10}" height="${C - 10}" rx="5" fill="${theme.teal}" stroke="${theme.ink}" stroke-width="2.5" ${ghost ? 'opacity=".45"' : ''}/>`;
const folder = (r: number, c: number) =>
  `<rect x="${c * C + 8}" y="${r * C + 10}" width="${C - 16}" height="${C - 19}" rx="2" fill="${theme.mustard}" stroke="${theme.ink}" stroke-width="2"/>`;
const arrow = (x1: number, y1: number, x2: number, y2: number, col: string = theme.ink) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="3" marker-end="url(#ah)"/>`;
const svg = (cols: number, body: string, label: string) =>
  `<figure class="diagram"><svg viewBox="0 0 ${cols * C} ${3 * C}" width="${cols * C}" height="${3 * C}" aria-hidden="true">
  <defs><marker id="ah" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="${theme.ink}"/></marker></defs>${body}</svg><figcaption>${label}</figcaption></figure>`;

const grid = (cols: number, tint?: (r: number, c: number) => string | undefined) => {
  let s = '';
  for (let r = 0; r < 3; r++) for (let c = 0; c < cols; c++) s += tile(r, c, tint?.(r, c));
  return s;
};

export function diagrams(): string {
  const bump = svg(
    4,
    grid(4) + red(1, 0, true) + red(1, 1) + teal(1, 2, true) + teal(1, 3) + arrow(68, 45, 92, 45),
    'Bump',
  );
  const burn = svg(
    3,
    grid(3) +
      red(2, 1) +
      teal(1, 1, true) +
      arrow(45, 38, 45, 10, theme.danger) +
      `<text x="45" y="12" text-anchor="middle" font-size="0">x</text>`,
    'Burn off the edge',
  );
  const extract = svg(
    3,
    grid(3, (r) => (r === 2 ? '#F2C9B5' : undefined)) +
      red(1, 1, true) +
      red(2, 1) +
      folder(2, 1) +
      arrow(45, 38, 45, 52),
    'Carry home',
  );
  return `<div class="diagrams">${bump}${burn}${extract}</div>`;
}

export function rulesHtml(): string {
  return `
  <h2 class="title">How to play</h2>
  <p><b>Goal:</b> be the first to extract <b>3 intel</b>.</p>
  <p><b>Your turn:</b> move one spy <b>1 square in any direction</b> (diagonals too) to an empty square. Or deploy a reserve spy onto an empty square of your <b>home row</b>.</p>
  <p><b>Bump:</b> wherever a spy lands, it shoves <b>every</b> neighbour (yours too!) one square straight away. A spy with another spy behind it can't be shoved. No chain reactions.</p>
  <p><b>Burned:</b> shoved off the board → back to its owner's reserve.</p>
  <p><b>Intel:</b> step on a folder to grab it. Get bumped while carrying and you drop it where you stood.</p>
  <p><b>Sprint:</b> carrying intel? You may dash <b>2 squares in a straight line</b> instead, over an empty square (ringed targets).</p>
  <p><b>Fumble:</b> if your carrier drops the intel, your team can't grab that folder on your next turn (it's marked).</p>
  <p><b>Extract:</b> carry it onto your home row to bank it. New intel appears in the middle.</p>
  ${diagrams()}`;
}

export function showRules(root: HTMLElement, onClose: () => void = () => {}): void {
  const wrap = document.createElement('div');
  wrap.className = 'overlay';
  wrap.id = 'rules';
  wrap.innerHTML = `<div class="card rules" role="dialog" aria-modal="true" aria-label="How to play">${rulesHtml()}
    <div class="actions"><button class="btn primary" id="btn-rules-close">Got it</button></div></div>`;
  wrap.querySelector('#btn-rules-close')!.addEventListener('click', () => {
    wrap.remove();
    onClose();
  });
  root.append(wrap);
}
