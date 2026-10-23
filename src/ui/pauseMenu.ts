export interface PauseHandlers {
  onRestart(): void;
  onRules(): void;
  onQuit(): void;
}

export class PauseMenu {
  constructor(
    private el: HTMLElement,
    h: PauseHandlers,
  ) {
    el.hidden = true;
    el.innerHTML = `
      <div class="card" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <h2 id="pause-title">Paused</h2>
        <button type="button" class="btn primary wide" data-testid="pause-resume">Resume</button>
        <button type="button" class="btn wide" data-testid="pause-restart">Restart</button>
        <button type="button" class="btn wide" data-testid="pause-rules">Rules</button>
        <button type="button" class="btn wide" data-testid="pause-quit">Quit to menu</button>
      </div>`;
    const on = (id: string, f: () => void) =>
      el.querySelector(`[data-testid="${id}"]`)!.addEventListener('click', f);
    on('pause-resume', () => this.close());
    on('pause-restart', () => {
      this.close();
      h.onRestart();
    });
    on('pause-rules', () => h.onRules());
    on('pause-quit', () => h.onQuit());
  }
  open(): void {
    this.el.hidden = false;
  }
  close(): void {
    this.el.hidden = true;
  }
}
