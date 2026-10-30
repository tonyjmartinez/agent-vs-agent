import { KEYS, load, save } from '../app/storage';

export type CoachStage = 'select' | 'target' | 'confirm';

/** First-game coach marks: "Tap a spy" → "Tap a square to preview" → "Tap again to move". Shown once. */
export class Coach {
  private done: boolean;
  private stage: CoachStage | null = null;

  constructor(
    private el: HTMLElement,
    private touch: boolean,
    enabled: boolean,
  ) {
    this.done = !enabled || load(KEYS.coachDone) === '1';
    this.el.hidden = true;
  }

  private text(stage: CoachStage): string {
    if (this.touch) {
      return {
        select: 'Tap one of your spies',
        target: 'Tap a glowing square to preview',
        confirm: 'Tap it again to move',
      }[stage];
    }
    return {
      select: 'Click one of your spies',
      target: 'Click a glowing square to move',
      confirm: 'Click it again to move',
    }[stage];
  }

  update(stage: CoachStage): void {
    if (this.done) return;
    if (this.stage === stage && !this.el.hidden) return; // keep the DOM stable so clicks on it land
    this.stage = stage;
    this.el.hidden = false;
    this.el.innerHTML = `<span data-testid="coach-text">${this.text(stage)}</span><button type="button" class="btn" data-testid="coach-dismiss">Got it</button>`;
    this.el.dataset.stage = stage;
    this.el.querySelector('button')!.addEventListener('click', () => this.finish());
  }

  /** Hide for now (bot's turn, animation, game over) without marking the coaching as done. */
  hide(): void {
    this.stage = null;
    this.el.hidden = true;
  }

  /** Dismissed or the first move was made: never show again. */
  finish(): void {
    if (this.done) return;
    this.done = true;
    this.stage = null;
    this.el.hidden = true;
    save(KEYS.coachDone, '1');
  }

  get active(): CoachStage | null {
    return this.stage;
  }
}
