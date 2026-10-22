import { applyAction, createGame, legalActions, previewAction } from '../engine/engine';
import { fromCompact } from '../engine/serialize';
import type { Action, Cell, GameState } from '../engine/types';
import type { BoardView } from '../view/BoardView';
import type { Hud } from '../ui/hud';
import type { GameOver } from '../ui/gameOver';
import type { Config } from './config';
import { IDLE, reduce, selectable, targetsFor, type Input, type UiState } from './interaction';

export interface ControllerDeps {
  view: BoardView;
  hud: Hud;
  gameOver: GameOver;
  config: Config;
}

/** Single source of truth: owns the history and turns input into actions (PLAN.md 4.3). */
export class Controller {
  history: GameState[];
  speed: number;
  private ui: UiState = IDLE;
  private busy = false;
  private initial: GameState;

  constructor(private d: ControllerDeps) {
    this.initial = d.config.state ? fromCompact(d.config.state) : createGame();
    this.history = [this.initial];
    this.speed = d.config.speed;
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
      this.d.hud.render(state, { canUndo: false, reserveSelected: false, interactive: false });
      // Never let a stalled animation (hidden tab) freeze the game.
      await Promise.race([
        this.d.view.play(events, this.speed),
        new Promise<void>((res) => setTimeout(res, 4000)),
      ]);
      this.d.view.sync(state);
    } finally {
      this.busy = false;
      this.refresh();
    }
  }

  private input(i: Input): void {
    if (this.busy) return;
    const { ui, commit } = reduce(this.state, this.ui, i, this.confirm);
    this.ui = ui;
    if (commit) void this.act(commit);
    else this.refresh();
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

  undo(): void {
    if (this.busy || this.history.length < 2) return;
    this.history.pop();
    this.ui = IDLE;
    this.d.view.sync(this.state);
    this.refresh();
  }

  rematch(): void {
    if (this.busy) return;
    this.history = [createGame()];
    this.ui = IDLE;
    this.d.view.sync(this.state);
    this.refresh();
  }

  private refresh(): void {
    const s = this.state;
    const { selected, preview } = this.ui;
    const acts = selected ? targetsFor(s, selected) : [];
    this.d.view.setInteraction({
      selected,
      targets: acts.flatMap((a) => (a.kind === 'pass' ? [] : [a.to])),
      preview: preview ? previewAction(s, preview) : null,
      selectable: this.busy ? [] : selectable(s),
    });
    const reserveSelected = selected !== null && s.spies.some((p) => p.id === selected && !p.pos);
    this.d.hud.render(s, {
      canUndo: this.history.length > 1,
      reserveSelected,
      interactive: !this.busy,
    });
    this.d.gameOver.render(s);
  }

  /** For tests/hooks. */
  legal(): Action[] {
    return legalActions(this.state);
  }
}
