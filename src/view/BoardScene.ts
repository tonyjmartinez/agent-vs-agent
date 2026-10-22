import Phaser from 'phaser';
import { hex, theme } from '../ui/theme';
import type { Cell, GameEvent, GameState, Spy } from '../engine/types';
import type { BoardHandlers, InteractionView } from './BoardView';

export const LOGICAL = 1080;
export const MARGIN = 72;
export const CELL = 156;
export const N = 6;

const PLAYER_COLORS = [theme.red, theme.teal, theme.plum, theme.olive];
const SELECT_LIFT = 10;

export const cellX = (c: number): number => MARGIN + CELL * c + CELL / 2;
export const cellY = (r: number): number => MARGIN + CELL * r + CELL / 2;

type G = Phaser.GameObjects.Graphics;

export class BoardScene extends Phaser.Scene {
  private pieces = new Map<string, Phaser.GameObjects.Container>();
  private tileLayer!: G;
  private intelLayer!: G;
  private hintLayer!: G;
  private previewLayer!: G;
  private state?: GameState;
  private inter: InteractionView = { selected: null, targets: [], preview: null, selectable: [] };
  private reduced = false;

  constructor(
    private handlers: BoardHandlers,
    private onReady: () => void,
  ) {
    super('board');
  }

  create(): void {
    this.reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bg = this.add.graphics();
    bg.fillStyle(hex(theme.board), 1);
    bg.fillRoundedRect(MARGIN - 18, MARGIN - 18, CELL * N + 36, CELL * N + 36, 36);
    bg.lineStyle(6, hex(theme.ink), 1);
    bg.strokeRoundedRect(MARGIN - 18, MARGIN - 18, CELL * N + 36, CELL * N + 36, 36);
    this.tileLayer = this.add.graphics();
    this.hintLayer = this.add.graphics().setDepth(1);
    this.intelLayer = this.add.graphics().setDepth(2);
    this.previewLayer = this.add.graphics().setDepth(50);
    this.drawTiles();
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cell = { r, c };
        this.add
          .zone(cellX(c), cellY(r), CELL, CELL)
          .setDepth(100)
          .setInteractive()
          .on('pointerup', () => this.handlers.onCell(cell))
          .on('pointerover', (p: Phaser.Input.Pointer) => {
            if (!p.wasTouch) this.handlers.onHover(cell);
          })
          .on('pointerout', (p: Phaser.Input.Pointer) => {
            if (!p.wasTouch) this.handlers.onHover(null);
          });
      }
    }
    this.onReady();
  }

  // ---- drawing -----------------------------------------------------------

  private drawTiles(): void {
    const g = this.tileLayer.clear();
    const gap = Math.round(CELL * 0.06);
    const zones = new Map<string, number>();
    this.state?.rules.players.forEach((p, owner) =>
      p.extraction.forEach((z) => zones.set(`${z.r},${z.c}`, owner)),
    );
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const base = hex((r + c) % 2 === 0 ? theme.tileA : theme.tileB);
        g.fillStyle(base, 1);
        g.fillRoundedRect(
          MARGIN + CELL * c + gap / 2,
          MARGIN + CELL * r + gap / 2,
          CELL - gap,
          CELL - gap,
          18,
        );
        const owner = zones.get(`${r},${c}`);
        if (owner !== undefined) {
          g.fillStyle(hex(PLAYER_COLORS[owner]!), 0.18);
          g.fillRoundedRect(
            MARGIN + CELL * c + gap / 2,
            MARGIN + CELL * r + gap / 2,
            CELL - gap,
            CELL - gap,
            18,
          );
        }
      }
    }
  }

  private drawPiece(g: G, spy: Spy): void {
    const color = hex(PLAYER_COLORS[spy.owner] ?? theme.ink);
    const ink = hex(theme.ink);
    g.clear();
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(0, 52, 84, 22);
    g.fillStyle(color, 1);
    g.fillCircle(0, 0, 50);
    g.lineStyle(5, ink, 1);
    g.strokeCircle(0, 0, 50);
    // Shape cue (colour-blind friendly): round brim for player 0, pointed hat for player 1.
    g.fillStyle(ink, 1);
    if (spy.owner === 0) g.fillEllipse(0, -44, 70, 16);
    else g.fillTriangle(-22, -38, 22, -38, 0, -74);
    // Sunglasses.
    g.fillRect(-26, -8, 52, 12);
    if (spy.carrying) {
      g.fillStyle(hex(theme.mustard), 1);
      g.fillRoundedRect(14, 12, 40, 30, 5);
      g.lineStyle(4, ink, 1);
      g.strokeRoundedRect(14, 12, 40, 30, 5);
    }
  }

  private ensurePiece(spy: Spy): Phaser.GameObjects.Container {
    let c = this.pieces.get(spy.id);
    if (!c) {
      const g = this.add.graphics();
      c = this.add.container(0, 0, [g]);
      this.pieces.set(spy.id, c);
    }
    this.drawPiece(c.list[0] as G, spy);
    return c;
  }

  sync(s: GameState): void {
    this.state = s;
    this.tweens.killAll();
    this.cameras.main.resetFX();
    this.drawTiles();
    for (const spy of s.spies) {
      if (!spy.pos) {
        this.pieces.get(spy.id)?.destroy();
        this.pieces.delete(spy.id);
        continue;
      }
      const c = this.ensurePiece(spy);
      c.setPosition(cellX(spy.pos.c), cellY(spy.pos.r))
        .setAlpha(1)
        .setScale(1)
        .setDepth(10 + spy.pos.r);
    }
    const g = this.intelLayer.clear();
    for (const i of s.intel) {
      g.fillStyle(hex(theme.mustard), 1);
      g.fillRoundedRect(cellX(i.c) - 28, cellY(i.r) - 22, 56, 44, 6);
      g.lineStyle(4, hex(theme.ink), 1);
      g.strokeRoundedRect(cellX(i.c) - 28, cellY(i.r) - 22, 56, 44, 6);
      g.fillStyle(hex(theme.ink), 1);
      g.fillRect(cellX(i.c) - 14, cellY(i.r) - 4, 28, 6);
    }
    this.applyInteraction();
  }

  setInteraction(i: InteractionView): void {
    this.inter = i;
    this.applyInteraction();
  }

  private applyInteraction(): void {
    const { selected, targets, preview, selectable } = this.inter;
    const hints = this.hintLayer.clear();
    const mustard = hex(theme.mustard);
    if (this.state) {
      for (const spy of this.state.spies) {
        const c = this.pieces.get(spy.id);
        if (!c || !spy.pos) continue;
        c.y = cellY(spy.pos.r) - (spy.id === selected ? SELECT_LIFT : 0);
        if (spy.id === selected) {
          hints.lineStyle(8, mustard, 1);
          hints.strokeCircle(cellX(spy.pos.c), cellY(spy.pos.r), 64);
        } else if (!selected && selectable.includes(spy.id)) {
          hints.lineStyle(5, mustard, 0.55);
          hints.strokeCircle(cellX(spy.pos.c), cellY(spy.pos.r), 62);
        }
      }
    }
    for (const t of targets) {
      hints.fillStyle(mustard, 0.35);
      hints.fillRoundedRect(
        MARGIN + CELL * t.c + 12,
        MARGIN + CELL * t.r + 12,
        CELL - 24,
        CELL - 24,
        16,
      );
      hints.fillStyle(mustard, 0.9);
      hints.fillCircle(cellX(t.c), cellY(t.r), 12);
    }
    this.drawPreview(preview);
  }

  private arrow(g: G, from: Cell, to: Cell, color: number): void {
    const x1 = cellX(from.c);
    const y1 = cellY(from.r);
    const x2 = cellX(to.c);
    const y2 = cellY(to.r);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const sx = x1 + Math.cos(ang) * 40;
    const sy = y1 + Math.sin(ang) * 40;
    const ex = x2 - Math.cos(ang) * 40;
    const ey = y2 - Math.sin(ang) * 40;
    g.lineStyle(10, color, 1);
    g.lineBetween(sx, sy, ex, ey);
    g.fillStyle(color, 1);
    const h = 26;
    g.fillTriangle(
      ex + Math.cos(ang) * h,
      ey + Math.sin(ang) * h,
      ex + Math.cos(ang + 2.3) * h,
      ey + Math.sin(ang + 2.3) * h,
      ex + Math.cos(ang - 2.3) * h,
      ey + Math.sin(ang - 2.3) * h,
    );
  }

  /** Ghost spy for the move, arrows on bumped spies, red tint + X on burns, folder icon on drops. */
  private drawPreview(events: GameEvent[] | null): void {
    const g = this.previewLayer.clear();
    if (!events || !this.state) return;
    const ink = hex(theme.ink);
    for (const e of events) {
      switch (e.t) {
        case 'moved':
        case 'deployed': {
          const spy = this.state.spies.find((p) => p.id === e.spyId);
          g.fillStyle(hex(PLAYER_COLORS[spy?.owner ?? 0]!), 0.45);
          g.fillCircle(cellX(e.to.c), cellY(e.to.r), 50);
          g.lineStyle(4, ink, 0.6);
          g.strokeCircle(cellX(e.to.c), cellY(e.to.r), 50);
          break;
        }
        case 'bumped':
          this.arrow(g, e.from, e.to, ink);
          break;
        case 'burned': {
          g.fillStyle(hex(theme.danger), 0.45);
          g.fillRoundedRect(
            MARGIN + CELL * e.from.c + 8,
            MARGIN + CELL * e.from.r + 8,
            CELL - 16,
            CELL - 16,
            18,
          );
          const x = cellX(e.from.c);
          const y = cellY(e.from.r);
          g.lineStyle(14, hex(theme.danger), 1);
          g.lineBetween(x - 34, y - 34, x + 34, y + 34);
          g.lineBetween(x + 34, y - 34, x - 34, y + 34);
          this.arrow(
            g,
            e.from,
            { r: e.from.r + e.dir.r, c: e.from.c + e.dir.c },
            hex(theme.danger),
          );
          break;
        }
        case 'dropped': {
          const x = cellX(e.at.c);
          const y = cellY(e.at.r);
          g.fillStyle(hex(theme.mustard), 0.9);
          g.fillRoundedRect(x - 26, y + 30, 52, 38, 6);
          g.lineStyle(4, ink, 1);
          g.strokeRoundedRect(x - 26, y + 30, 52, 38, 6);
          break;
        }
        case 'bumpBlocked': {
          const x = cellX(e.at.c);
          const y = cellY(e.at.r);
          g.lineStyle(8, ink, 0.7);
          g.lineBetween(x - 20, y - 4, x + 20, y - 4);
          g.lineBetween(x - 20, y + 8, x + 20, y + 8);
          break;
        }
        case 'extracted': {
          g.lineStyle(10, hex(theme.mustard), 1);
          g.strokeCircle(cellX(e.at.c), cellY(e.at.r), 62);
          break;
        }
        default:
          break;
      }
    }
  }

  // ---- animation ---------------------------------------------------------

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ ...config, onComplete: () => resolve() });
    });
  }

  async play(events: GameEvent[], speed: number): Promise<void> {
    if (speed <= 0 || !this.state) return;
    const groups = new Map<number, GameEvent[]>();
    for (const e of events) groups.set(e.phase, [...(groups.get(e.phase) ?? []), e]);
    this.previewLayer.clear();
    for (const phase of [...groups.keys()].sort((a, b) => a - b)) {
      await Promise.all(groups.get(phase)!.map((e) => this.animate(e, speed)));
    }
  }

  private dur(ms: number, speed: number): number {
    return this.reduced ? 60 : Math.max(1, ms * speed);
  }

  private animate(e: GameEvent, speed: number): Promise<void> {
    const piece = 'spyId' in e ? this.pieces.get(e.spyId) : undefined;
    switch (e.t) {
      case 'moved':
        return piece
          ? this.tween({
              targets: piece,
              x: cellX(e.to.c),
              y: cellY(e.to.r),
              duration: this.dur(220, speed),
              ease: 'Linear',
            })
          : Promise.resolve();
      case 'deployed': {
        const spy = this.state!.spies.find((p) => p.id === e.spyId);
        if (!spy) return Promise.resolve();
        const c = this.ensurePiece({ ...spy, pos: e.to });
        c.setPosition(cellX(e.to.c), cellY(e.to.r)).setScale(0);
        return this.tween({
          targets: c,
          scale: 1,
          duration: this.dur(200, speed),
          ease: 'Back.Out',
        });
      }
      case 'bumped':
        return piece
          ? this.tween({
              targets: piece,
              x: cellX(e.to.c),
              y: cellY(e.to.r),
              duration: this.dur(180, speed),
              ease: 'Linear',
            })
          : Promise.resolve();
      case 'bumpBlocked':
        return piece
          ? this.tween({
              targets: piece,
              x: piece.x + 4,
              duration: this.dur(60, speed),
              yoyo: true,
              repeat: 1,
            })
          : Promise.resolve();
      case 'burned':
        if (!this.reduced) this.cameras.main.shake(120 * speed, 0.004);
        return piece
          ? this.tween({
              targets: piece,
              x: piece.x + e.dir.c * CELL * 0.8,
              y: piece.y + e.dir.r * CELL * 0.8,
              alpha: 0,
              duration: this.dur(380, speed),
              ease: 'Linear',
            })
          : Promise.resolve();
      case 'extracted': {
        const pop = piece
          ? this.tween({ targets: piece, scale: 1.3, duration: this.dur(120, speed), yoyo: true })
          : Promise.resolve();
        if (this.reduced) return pop;
        const label = this.add
          .text(cellX(e.at.c), cellY(e.at.r) - 70, 'EXTRACTED!', {
            fontFamily: 'Fredoka, sans-serif',
            fontSize: '44px',
            color: theme.mustard,
            stroke: theme.ink,
            strokeThickness: 8,
          })
          .setOrigin(0.5)
          .setDepth(60)
          .setResolution(2);
        const rise = this.tween({
          targets: label,
          y: label.y - 50,
          alpha: 0,
          duration: this.dur(600, speed),
          onComplete: () => label.destroy(),
        });
        return Promise.all([pop, rise]).then(() => undefined);
      }
      default:
        return Promise.resolve();
    }
  }
}
