import { applyAction, createGame, legalActions, previewAction } from '../engine/engine';
import { duelRules } from '../engine/rules';
import type { Action, GameEvent, Cell, GameState, PlayerId, Rules } from '../engine/types';
import type { BoardView, Highlights } from '../view/BoardView';
import type { Hud } from '../ui/hud';
import type { BotLevel, Seat } from './config';
import {
  emptySelection,
  hoverCell,
  selectableSpies,
  tapCell,
  tapReserve,
  targetsFor,
  type Selection,
} from './interaction';

export type BotChooser = (
  s: GameState,
  level: BotLevel,
  seed: number,
  history: GameState[],
) => Promise<Action>;

export interface ControllerOpts {
  view: BoardView;
  hud: Hud;
  seats: Seat[];
  speed: number;
  /** Require a second tap to confirm moves made by touch (mouse always commits in one click). */
  confirmTouch: boolean;
  seed: number;
  /** Rule overrides applied to every new game. */
  rules?: Partial<Rules>;
  chooseBot?: BotChooser;
  onGameOver?(s: GameState): void;
  onAction?(s: GameState): void;
  onRefresh?(c: Controller): void;
  /** Fired with each action's events just before they animate (sound, haptics). */
  onEvents?(events: GameEvent[]): void;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Single source of truth: owns history, turns input and bots into actions (PLAN 4.3). */
export class Controller {
  history: GameState[] = [];
  /** Footprint of the action that produced each history entry (index-aligned; first is null). */
  moves: Highlights['lastMove'][] = [];
  sel: Selection = emptySelection;
  busy = false;
  thinking = false;
  cursor: Cell | null = null;
  private generation = 0;

  constructor(private o: ControllerOpts) {
    o.view.setHandlers({ onTap: (c, t) => this.onTap(c, t), onHover: (c) => this.onHover(c) });
  }

  get state(): GameState {
    return this.history.at(-1)!;
  }
  get seats(): Seat[] {
    return this.o.seats;
  }
  setSpeed(n: number): void {
    this.o.speed = n;
    this.o.view.setSpeed(n);
  }
  get confirmTouch(): boolean {
    return this.o.confirmTouch;
  }
  setConfirm(on: boolean): void {
    this.o.confirmTouch = on;
  }

  private isHumanTurn(s = this.state): boolean {
    return s.winner === null && this.o.seats[s.current]?.kind === 'human';
  }

  isHumanToMove(): boolean {
    return this.isHumanTurn() && !this.busy;
  }

  /** Which seat's panel sits at the bottom: the lone human, else player 0. */
  get bottomSeat(): PlayerId {
    const humans = this.o.seats.map((x, i) => (x.kind === 'human' ? i : -1)).filter((i) => i >= 0);
    return humans.length === 1 ? humans[0]! : 0;
  }

  start(state?: GameState, seats?: Seat[]): void {
    this.generation++;
    if (seats) this.o.seats = seats;
    this.history = [state ?? createGame(duelRules(this.o.rules))];
    this.moves = [null];
    this.sel = emptySelection;
    this.busy = false;
    this.thinking = false;
    this.o.view.sync(this.state);
    this.refresh();
    void this.maybeBot();
  }

  refresh(): void {
    const s = this.state;
    const human = this.isHumanTurn() && !this.busy;
    this.o.view.setHighlights({
      selected: human ? this.sel.selected : null,
      selectable: human && !this.sel.selected ? selectableSpies(s) : [],
      targets: human ? targetsFor(s, this.sel.selected) : [],
      cursor: human ? this.cursor : null,
      lastMove: this.busy ? null : (this.moves.at(-1) ?? null),
    });
    const p = this.sel.pending;
    this.o.view.showPreview(human ? p : null, human && p ? previewAction(s, p) : null);
    this.o.hud.render({
      state: s,
      seats: this.o.seats,
      reserveSelected: this.sel.selected === 'reserve',
      thinking: this.thinking,
      canUndo: this.canUndo(),
      bottom: this.bottomSeat,
    });
    this.o.view.relayout();
    this.o.onRefresh?.(this);
  }

  onTap(c: Cell, touch = false): void {
    if (this.busy || !this.isHumanTurn()) return;
    const res = tapCell(this.state, this.sel, c, touch && this.o.confirmTouch);
    this.sel = res.selection;
    if (res.kind === 'commit') void this.commit(res.action);
    else this.refresh();
  }

  /**
   * Keyboard (PLAN 4.6): arrows move a cursor (previewing legal targets), Enter/Space select or
   * commit, Tab cycles your spies, Esc cancels, U undoes. Returns true if the key was handled.
   */
  onKey(key: string, shift = false): boolean {
    if (key === 'u' || key === 'U') {
      this.undo();
      return true;
    }
    if (this.busy || !this.isHumanTurn()) return false;
    const s = this.state;
    const size = s.rules.size;
    const mine = selectableSpies(s);
    const posOf = (id: string) => s.spies.find((x) => x.id === id)?.pos ?? null;
    const arrows: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    if (key in arrows) {
      const [dr, dc] = arrows[key]!;
      const from = this.cursor ?? (mine[0] ? posOf(mine[0]) : null) ?? { r: size - 1, c: 0 };
      const next = this.cursor
        ? {
            r: Math.min(size - 1, Math.max(0, from.r + dr)),
            c: Math.min(size - 1, Math.max(0, from.c + dc)),
          }
        : from;
      this.cursor = next;
      if (this.sel.selected) this.sel = hoverCell(s, this.sel, next);
      this.refresh();
      return true;
    }
    if (key === 'Enter' || key === ' ') {
      if (!this.cursor) return false;
      this.onTap(this.cursor, false);
      return true;
    }
    if (key === 'Tab') {
      if (!mine.length) return false;
      const i = this.sel.selected ? mine.indexOf(this.sel.selected) : -1;
      const n = mine.length;
      const id = mine[(((shift ? i - 1 : i + 1) % n) + n) % n]!;
      this.sel = { selected: id, pending: null };
      this.cursor = posOf(id);
      this.refresh();
      return true;
    }
    if (key === 'Escape') {
      this.sel = emptySelection;
      this.refresh();
      return true;
    }
    return false;
  }

  onHover(c: Cell | null): void {
    if (this.busy || !this.isHumanTurn() || !this.sel.selected) return;
    this.sel = hoverCell(this.state, this.sel, c);
    this.refresh();
  }

  onReserve(owner: PlayerId): void {
    if (this.busy || !this.isHumanTurn() || this.state.current !== owner) return;
    this.sel = tapReserve(this.state, this.sel);
    this.refresh();
  }

  /** Select a spy or reserve directly (keyboard / tests). */
  select(sel: Selection): void {
    this.sel = sel;
    this.refresh();
  }

  async commit(a: Action): Promise<void> {
    if (this.busy) return;
    const before = this.state;
    const gen = this.generation;
    const { state, events } = applyAction(before, a);
    this.busy = true;
    this.sel = emptySelection;
    this.history.push(state);
    const arrive = events.find((e) => e.t === 'moved' || e.t === 'deployed');
    this.moves.push(
      arrive && (arrive.t === 'moved' || arrive.t === 'deployed')
        ? { from: arrive.t === 'moved' ? arrive.from : null, to: arrive.to, owner: before.current }
        : null,
    );
    this.refresh();
    this.o.onEvents?.(events);
    await this.o.view.play(events, before);
    if (gen !== this.generation) return;
    this.o.view.sync(state);
    this.busy = false;
    this.refresh();
    this.o.onAction?.(state);
    if (state.winner !== null) {
      this.o.onGameOver?.(state);
      return;
    }
    await this.maybeBot();
  }

  private async maybeBot(): Promise<void> {
    const s = this.state;
    const seat = this.o.seats[s.current];
    if (s.winner !== null || seat?.kind !== 'bot') return;
    const gen = this.generation;
    this.thinking = true;
    this.refresh();
    const started = performance.now();
    const choose = this.o.chooseBot ?? (async (st: GameState) => legalActions(st)[0]!);
    const action = await choose(s, seat.level, this.o.seed + s.ply, this.history);
    if (this.o.speed > 0) {
      const left = 450 - (performance.now() - started);
      if (left > 0) await wait(left);
    }
    if (gen !== this.generation) return;
    this.thinking = false;
    await this.commit(action);
  }

  canUndo(): boolean {
    if (this.busy || this.thinking) return false;
    return this.undoTarget() !== null;
  }

  /** Index of the most recent earlier state where a human was to move. */
  private undoTarget(): number | null {
    for (let i = this.history.length - 2; i >= 0; i--) {
      if (this.isHumanTurn(this.history[i])) return i;
    }
    return null;
  }

  undo(): void {
    const t = this.undoTarget();
    if (t === null || this.busy || this.thinking) return;
    this.generation++;
    this.history = this.history.slice(0, t + 1);
    this.moves = this.moves.slice(0, t + 1);
    this.sel = emptySelection;
    this.o.view.sync(this.state);
    this.refresh();
  }
}
