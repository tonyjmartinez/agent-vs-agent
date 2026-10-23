import { bumpDiagram, burnDiagram, extractDiagram } from './diagrams';

/** Rules card (PLAN.md 2.1) with three small diagrams. Fits on a phone screen, scrolls if it must. */
export class RulesCard {
  private el: HTMLElement;
  constructor(host: HTMLElement) {
    this.el = host;
    host.hidden = true;
    host.innerHTML = `
      <div class="card rules" role="dialog" aria-modal="true" aria-labelledby="rules-title" data-testid="rules-card">
        <h2 id="rules-title">Agent vs Agent</h2>
        <p><b>Goal:</b> be the first to extract <b>3 intel</b>.</p>
        <p><b>Your turn:</b> move one spy <b>1 square in any direction</b> (diagonals too) to an empty square. Or, if you have a spy in reserve, <b>deploy</b> it onto an empty square of your extraction row.</p>
        <div class="rule"><figure>${bumpDiagram()}<figcaption>Bump</figcaption></figure>
          <p><b>Bump:</b> a spy that arrives bumps <b>every</b> adjacent spy (yours too!) one square straight away. Blocked if another spy is behind it; bumps don't chain.</p></div>
        <div class="rule"><figure>${burnDiagram()}<figcaption>Burned</figcaption></figure>
          <p><b>Burned:</b> a spy bumped off the board goes back to its owner's reserve.</p></div>
        <div class="rule"><figure>${extractDiagram()}<figcaption>Extract</figcaption></figure>
          <p><b>Intel:</b> step onto intel to grab it (one at a time). Get bumped while carrying it and you drop it. A carrier on <b>your extraction row</b> banks it instantly; new intel appears in the centre.</p></div>
        <button type="button" class="btn primary" data-testid="rules-close">Got it</button>
      </div>`;
    host
      .querySelector('[data-testid="rules-close"]')!
      .addEventListener('click', () => this.close());
    host.addEventListener('click', (e) => {
      if (e.target === host) this.close();
    });
  }
  open(): void {
    this.el.hidden = false;
    (this.el.querySelector('[data-testid="rules-close"]') as HTMLElement).focus({
      preventScroll: true,
    });
  }
  close(): void {
    this.el.hidden = true;
  }
  get isOpen(): boolean {
    return !this.el.hidden;
  }
}
