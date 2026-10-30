import { makeBot, type Bot } from '../ai/bots';
import { applyAction, createGame, legalActions, previewAction } from '../engine/engine';
import { fromCompact } from '../engine/serialize';
import type { Action, Cell, GameState } from '../engine/types';
import type { BoardView } from '../view/BoardView';
import type { Hud } from '../ui/hud';
import type { GameOver } from '../ui/gameOver';
import type { Coach } from '../ui/coach';
import type { Config } from './config';
import { IDLE, reduce, selectable, targetsFor, type Input, type UiState } from './interaction';

export interface ControllerDeps {
  view: BoardView;
  hud: Hud;
  gameOver: GameOver;
  config: Config;
  coach?: Coach;
}

/** Single source of truth: owns the history and turns input into actions (PLAN.md 4.3). */
export class Controller {
  history: GameState[];
  speed: number;
  private ui: UiState = IDLE;
  private busy = false;
  private thinking = false;
  /** Bumped on undo/rematch so a bot that was mid-think discards its stale move. */
  private gen = 0;
  private initial: GameState;
  private bots: (Bot | null)[];

  constructor(private d: ControllerDeps) {
    this.initial = d.config.state ? fromCompact(d.config.state) : createGame();
    this.history = [this.initial];
    this.speed = d.config.speed;
    this.bots = d.config.seats.map((seat, i) =>
      seat.kind === 'bot' ? makeBot(seat.level, d.config.seed * 31 + i) : null,
    );
  }

  get state(): GameState {
    return this.history[this.history.length - 1]!;
  }
  get confirm(): boolean {
    return this.d.config.confirm;
  }

  start(): void {
    this.d.view.sync(this.state);
    this.refresh();
    void this.maybeBot();
  }

  private get humanToMove(): boolean {
    return this.bots[this.state.current] === null;
  }

  /** If a bot is on move, wait a beat (so humans can follow), let it choose, and play its action. */
  private async maybeBot(): Promise<void> {
    const bot = this.bots[this.state.current];
    if (!bot || this.state.winner !== null || this.busy || this.thinking) return;
    const gen = this.gen;
    this.thinking = true;
    this.refresh();
    try {
      await new Promise<void>((res) => setTimeout(res, this.speed > 0 ? 450 * this.speed : 0));
      if (gen !== this.gen) return; // undo/rematch happened while thinking
      const action = bot.choose(this.state);
      this.thinking = false;
      await this.act(action);
    } finally {
      if (gen === this.gen) this.thinking = false;
    }
  }

  /** Play an action through the same path as a human commit (also used by tests). */
  async act(a: Action): Promise<void> {
    if (this.busy) throw new Error('controller is busy');
    this.busy = true;
    try {
      const { state, events } = applyAction(this.state, a);
      this.history.push(state);
      this.ui = IDLE;
      this.d.view.setInteraction({ selected: null, targets: [], preview: null, selectable: [] });
      this.d.hud.render(state, {
        canUndo: false,
        reserveSelected: false,
        interactive: false,
        bots: this.bots.map((b) => b !== null),
      });
      // Never let a stalled animation (hidden tab) freeze the game.
      await Promise.race([
        this.d.view.play(events, this.speed),
        new Promise<void>((res) => setTimeout(res, 4000)),
      ]);
      this.d.view.sync(state);
    } finally {
      this.busy = false;
      this.refresh();
      void this.maybeBot();
    }
  }

  private input(i: Input): void {
    if (this.busy || this.thinking || !this.humanToMove) return;
    const { ui, commit } = reduce(this.state, this.ui, i, this.confirm);
    this.ui = ui;
    if (commit) {
      this.d.coach?.finish();
      void this.act(commit);
    } else this.refresh();
  }

  tapCell(cell: Cell): void {
    this.input({ kind: 'cell', cell });
  }
  hover(cell: Cell | null): void {
    this.input({ kind: 'hover', cell });
  }
  tapReserve(): void {
    this.input({ kind: 'reserve' });
  }

  /** Pop back to the last position where a human was to move (one ply in hotseat). */
  undo(): void {
    if (this.busy || !this.canUndo) return;
    this.gen++;
    this.thinking = false;
    do this.history.pop();
    while (this.history.length > 1 && !this.humanToMove);
    this.bots.forEach((b) => b?.reset());
    this.ui = IDLE;
    this.d.view.sync(this.state);
    this.refresh();
    void this.maybeBot();
  }

  private get canUndo(): boolean {
    return this.history.slice(0, -1).some((st) => this.bots[st.current] === null);
  }

  rematch(): void {
    if (this.busy) return;
    this.gen++;
    this.thinking = false;
    this.history = [createGame()];
    this.bots.forEach((b) => b?.reset());
    this.ui = IDLE;
    this.d.view.sync(this.state);
    this.refresh();
    void this.maybeBot();
  }

  private refresh(): void {
    const s = this.state;
    const { selected, preview } = this.ui;
    const acts = selected ? targetsFor(s, selected) : [];
    this.d.view.setInteraction({
      selected,
      targets: acts.flatMap((a) => (a.kind === 'pass' ? [] : [a.to])),
      preview: preview ? previewAction(s, preview) : null,
      selectable: this.busy || this.thinking || !this.humanToMove ? [] : selectable(s),
    });
    const reserveSelected = selected !== null && s.spies.some((p) => p.id === selected && !p.pos);
    this.d.hud.render(s, {
      canUndo: this.canUndo,
      reserveSelected,
      interactive: !this.busy && !this.thinking && this.humanToMove,
      bots: this.bots.map((b) => b !== null),
    });
    this.d.gameOver.render(s);
    if (this.d.coach) {
      if (s.winner !== null || !this.humanToMove || this.busy) this.d.coach.hide();
      else if (!selected) this.d.coach.update('select');
      else if (preview && this.confirm) this.d.coach.update('confirm');
      else this.d.coach.update('target');
    }
  }

  /** For tests/hooks. */
  legal(): Action[] {
    return legalActions(this.state);
  }
}
