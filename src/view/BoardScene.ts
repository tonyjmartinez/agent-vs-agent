import Phaser from 'phaser';
import { key } from '../engine/board';
import type { Action, Cell, GameEvent, GameState } from '../engine/types';
import { hex, playerColors, theme } from '../ui/theme';
import type { Highlights, ViewHandlers } from './BoardView';
import { CELL, MARGIN, SIZE, cellCenter, pointToCell } from './geometry';

const INK = hex(theme.ink);
const MUSTARD = hex(theme.mustard);
const DANGER = hex(theme.danger);
const FONT = 'Fredoka, system-ui, sans-serif';

type SpyGO = Phaser.GameObjects.Container & {
  badge: Phaser.GameObjects.Container;
  figure: Phaser.GameObjects.Container;
};

export class BoardScene extends Phaser.Scene {
  onReady: () => void = () => {};
  handlers: ViewHandlers = { onTap: () => {}, onHover: () => {} };
  speed = 1;
  reducedMotion = false;

  private spies = new Map<string, SpyGO>();
  private intel = new Map<string, Phaser.GameObjects.Container>();
  private hl!: Phaser.GameObjects.Graphics;
  private pv!: Phaser.GameObjects.Graphics;
  private ghost: Phaser.GameObjects.Container | null = null;
  private hover: string | null = null;
  private state: GameState | null = null;

  constructor() {
    super('board');
  }

  create(): void {
    this.drawBoard();
    this.hl = this.add.graphics().setDepth(1);
    this.pv = this.add.graphics().setDepth(60);
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const c = pointToCell(p.x, p.y);
      if (c) this.handlers.onTap(c, p.wasTouch);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) return;
      const c = pointToCell(p.x, p.y);
      const k = c ? key(c) : null;
      if (k === this.hover) return;
      this.hover = k;
      this.handlers.onHover(c);
    });
    this.input.on('gameout', () => {
      this.hover = null;
      this.handlers.onHover(null);
    });
    this.onReady();
  }

  // ---------- static board ----------

  private drawBoard(): void {
    const g = this.add.graphics().setDepth(0);
    const x0 = MARGIN - 18;
    const w = CELL * SIZE + 36;
    g.fillStyle(INK, 0.12).fillRoundedRect(x0 + 6, x0 + 12, w, w, 40);
    g.fillStyle(hex(theme.board), 1).fillRoundedRect(x0, x0, w, w, 40);
    g.lineStyle(6, INK, 1).strokeRoundedRect(x0, x0, w, w, 40);
    const gap = CELL * 0.06;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        g.fillStyle(hex((r + c) % 2 ? theme.tileB : theme.tileA), 1);
        g.fillRoundedRect(
          MARGIN + c * CELL + gap / 2,
          MARGIN + r * CELL + gap / 2,
          CELL - gap,
          CELL - gap,
          20,
        );
      }
    }
    // Extraction rows: P0 bottom (row 5), P1 top (row 0).
    const zones: [number, string][] = [
      [5, playerColors[0]],
      [0, playerColors[1]],
    ];
    for (const [r, col] of zones) {
      g.fillStyle(hex(col), 0.18);
      g.fillRoundedRect(
        MARGIN + gap / 2,
        MARGIN + r * CELL + gap / 2,
        CELL * SIZE - gap,
        CELL - gap,
        20,
      );
    }
    // Dashed stitch inset.
    g.lineStyle(3, INK, 0.25);
    const inset = x0 + 10;
    const len = w - 20;
    for (let i = 0; i < len; i += 22) {
      const a = inset + i;
      const b = Math.min(inset + i + 11, inset + len);
      g.lineBetween(a, inset, b, inset);
      g.lineBetween(a, inset + len, b, inset + len);
      g.lineBetween(inset, a, inset, b);
      g.lineBetween(inset + len, a, inset + len, b);
    }
  }

  // ---------- pieces ----------

  private makeFolder(scale = 1): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(INK, 1).fillRoundedRect(-30, -22, 60, 46, 8);
    g.fillStyle(MUSTARD, 1).fillRoundedRect(-27, -19, 54, 40, 6);
    g.fillStyle(MUSTARD, 1).fillRoundedRect(-27, -25, 24, 10, 4);
    g.lineStyle(3, INK, 1).strokeRoundedRect(-27, -25, 24, 10, 4);
    g.fillStyle(DANGER, 0.9).fillRoundedRect(-18, -4, 36, 12, 3);
    return this.add.container(0, 0, [g]).setScale(scale);
  }

  private makeSpy(owner: number): SpyGO {
    const color = hex(playerColors[owner] ?? theme.ink);
    const shadow = this.add.ellipse(0, 44, 92, 26, INK, 0.2);
    const g = this.add.graphics();
    g.fillStyle(INK, 1);
    if (owner % 2 === 0) g.fillCircle(0, 0, 50);
    else g.fillRoundedRect(-48, -48, 96, 96, 26);
    g.fillStyle(color, 1);
    if (owner % 2 === 0) g.fillCircle(0, 0, 44);
    else g.fillRoundedRect(-42, -42, 84, 84, 22);
    g.fillStyle(INK, 1).fillRoundedRect(-30, -12, 60, 14, 7); // shades
    const body = this.add.container(0, 0, [g]);
    const badge = this.makeFolder(0.62).setPosition(30, 26).setVisible(false);
    const c = this.add.container(0, 0, [shadow, body, badge]) as SpyGO;
    c.figure = body;
    c.badge = badge;
    return c;
  }

  private spyGO(id: string, owner: number): SpyGO {
    let s = this.spies.get(id);
    if (!s) {
      s = this.makeSpy(owner);
      this.spies.set(id, s);
    }
    return s;
  }

  private addIntel(c: Cell): Phaser.GameObjects.Container {
    const p = cellCenter(c.r, c.c);
    const f = this.makeFolder(1).setPosition(p.x, p.y).setDepth(2);
    this.intel.set(key(c), f);
    if (this.speed > 0 && !this.reducedMotion) {
      this.tweens.add({
        targets: f,
        y: p.y - 3,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
    return f;
  }

  private removeIntel(c: Cell): Phaser.GameObjects.Container | undefined {
    const f = this.intel.get(key(c));
    this.intel.delete(key(c));
    if (f) this.tweens.killTweensOf(f);
    return f;
  }

  // ---------- authoritative sync ----------

  sync(s: GameState): void {
    this.state = s;
    for (const sp of s.spies) {
      const go = this.spyGO(sp.id, sp.owner);
      this.tweens.killTweensOf(go);
      this.tweens.killTweensOf(go.figure);
      go.setAngle(0).setScale(1).setAlpha(1);
      go.figure.setScale(1).setPosition(0, 0);
      go.badge.setVisible(sp.carrying).setScale(0.62);
      if (sp.pos) {
        const p = cellCenter(sp.pos.r, sp.pos.c);
        go.setPosition(p.x, p.y)
          .setVisible(true)
          .setDepth(10 + sp.pos.r);
      } else go.setVisible(false);
    }
    for (const k of [...this.intel.keys()]) {
      const [r, c] = k.split(',').map(Number);
      this.removeIntel({ r: r!, c: c! })?.destroy();
    }
    for (const c of s.intel) this.addIntel(c);
  }

  // ---------- highlights & preview ----------

  setHighlights(h: Highlights): void {
    const g = this.hl.clear();
    const s = this.state;
    if (!s) return;
    for (const id of h.selectable) {
      const sp = s.spies.find((x) => x.id === id);
      if (!sp?.pos || id === h.selected) continue;
      const p = cellCenter(sp.pos.r, sp.pos.c);
      g.lineStyle(5, INK, 0.25).strokeCircle(p.x, p.y, 62);
    }
    if (h.selected && h.selected !== 'reserve') {
      const sp = s.spies.find((x) => x.id === h.selected);
      if (sp?.pos) {
        const p = cellCenter(sp.pos.r, sp.pos.c);
        g.fillStyle(MUSTARD, 0.45).fillCircle(p.x, p.y, 66);
        g.lineStyle(6, INK, 1).strokeCircle(p.x, p.y, 66);
      }
    }
    for (const t of h.targets) {
      const p = cellCenter(t.r, t.c);
      g.fillStyle(MUSTARD, 0.9).fillCircle(p.x, p.y, 17);
      g.lineStyle(4, INK, 0.9).strokeCircle(p.x, p.y, 17);
    }
    if (h.cursor) {
      const x = MARGIN + h.cursor.c * CELL;
      const y = MARGIN + h.cursor.r * CELL;
      g.lineStyle(6, INK, 0.9).strokeRoundedRect(x + 4, y + 4, CELL - 8, CELL - 8, 22);
    }
  }

  private arrow(
    g: Phaser.GameObjects.Graphics,
    from: Cell,
    to: { r: number; c: number },
    color: number,
  ): void {
    const a = cellCenter(from.r, from.c);
    const b = { x: MARGIN + CELL * to.c + CELL / 2, y: MARGIN + CELL * to.r + CELL / 2 };
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const sx = a.x + Math.cos(ang) * 40;
    const sy = a.y + Math.sin(ang) * 40;
    const ex = b.x - Math.cos(ang) * 46;
    const ey = b.y - Math.sin(ang) * 46;
    g.lineStyle(14, INK, 1).lineBetween(sx, sy, ex, ey);
    g.lineStyle(8, color, 1).lineBetween(sx, sy, ex, ey);
    const hx = (k: number, s: number) => ex + Math.cos(ang + k) * s;
    const hy = (k: number, s: number) => ey + Math.sin(ang + k) * s;
    g.fillStyle(INK, 1).fillTriangle(
      hx(0, 30),
      hy(0, 30),
      hx(2.4, 30),
      hy(2.4, 30),
      hx(-2.4, 30),
      hy(-2.4, 30),
    );
    g.fillStyle(color, 1).fillTriangle(
      hx(0, 20),
      hy(0, 20),
      hx(2.4, 18),
      hy(2.4, 18),
      hx(-2.4, 18),
      hy(-2.4, 18),
    );
  }

  showPreview(action: Action | null, events: GameEvent[] | null): void {
    const g = this.pv.clear();
    this.ghost?.destroy();
    this.ghost = null;
    const s = this.state;
    if (!s || !action || action.kind === 'pass' || !events) return;
    const actor = s.spies.find((x) => x.id === action.spyId)!;
    const dest = cellCenter(action.to.r, action.to.c);
    this.ghost = this.makeSpy(actor.owner).setPosition(dest.x, dest.y).setAlpha(0.55).setDepth(55);
    g.lineStyle(6, INK, 0.8).strokeCircle(dest.x, dest.y, 62);
    for (const e of events) {
      if (e.t === 'bumped') this.arrow(g, e.from, e.to, 0xffffff);
      else if (e.t === 'burned') {
        const p = cellCenter(e.from.r, e.from.c);
        g.fillStyle(DANGER, 0.35).fillRoundedRect(
          p.x - CELL / 2 + 6,
          p.y - CELL / 2 + 6,
          CELL - 12,
          CELL - 12,
          20,
        );
        this.arrow(
          g,
          e.from,
          { r: e.from.r + e.dir.r * 0.85, c: e.from.c + e.dir.c * 0.85 },
          DANGER,
        );
        // skull-ish X
        g.lineStyle(10, DANGER, 1);
        g.lineBetween(p.x - 22, p.y - 22, p.x + 22, p.y + 22).lineBetween(
          p.x + 22,
          p.y - 22,
          p.x - 22,
          p.y + 22,
        );
      } else if (e.t === 'bumpBlocked') {
        const p = cellCenter(e.at.r, e.at.c);
        g.lineStyle(6, INK, 0.7);
        g.lineBetween(
          p.x + e.dir.c * 56 - e.dir.r * 20,
          p.y + e.dir.r * 56 - e.dir.c * 20,
          p.x + e.dir.c * 56 + e.dir.r * 20,
          p.y + e.dir.r * 56 + e.dir.c * 20,
        );
      } else if (e.t === 'dropped') {
        const p = cellCenter(e.at.r, e.at.c);
        g.fillStyle(MUSTARD, 1).fillCircle(p.x - 44, p.y - 44, 20);
        g.lineStyle(4, INK, 1).strokeCircle(p.x - 44, p.y - 44, 20);
      } else if (e.t === 'extracted' || (e.t === 'pickedUp' && e.spyId === action.spyId)) {
        const p = cellCenter(e.at.r, e.at.c);
        g.lineStyle(8, MUSTARD, 1).strokeCircle(p.x, p.y, 70);
      }
    }
  }

  // ---------- animation ----------

  private dur(ms: number): number {
    return this.reducedMotion ? Math.min(ms, 60) : ms * this.speed;
  }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((res) => this.tweens.add({ ...cfg, onComplete: () => res() }));
  }

  popText(text: string, x: number, y: number, color: string): Promise<void> {
    const t = this.add
      .text(x, y, text, {
        fontFamily: FONT,
        fontStyle: '700',
        fontSize: '64px',
        color,
        stroke: theme.ink,
        strokeThickness: 10,
        resolution: 2,
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setScale(0.4);
    return this.tween({
      targets: t,
      scale: 1,
      y: y - 40,
      duration: this.dur(260),
      ease: 'Back.Out',
    })
      .then(() =>
        this.tween({ targets: t, alpha: 0, duration: this.dur(500), delay: this.dur(350) }),
      )
      .then(() => t.destroy());
  }

  async play(events: GameEvent[], before: GameState): Promise<void> {
    if (this.speed <= 0 || !events.length) return;
    this.showPreview(null, null);
    this.hl.clear();
    const phases = [...new Set(events.map((e) => e.phase))].sort();
    for (const ph of phases) {
      await Promise.all(events.filter((e) => e.phase === ph).map((e) => this.animate(e, before)));
    }
  }

  private animate(e: GameEvent, before: GameState): Promise<unknown> {
    const owner = (id: string) => before.spies.find((x) => x.id === id)!.owner;
    switch (e.t) {
      case 'moved': {
        const go = this.spyGO(e.spyId, owner(e.spyId));
        const p = cellCenter(e.to.r, e.to.c);
        go.setDepth(40);
        return Promise.all([
          this.tween({ targets: go, x: p.x, y: p.y, duration: this.dur(220), ease: 'Sine.InOut' }),
          this.tween({
            targets: go.figure,
            y: -36,
            duration: this.dur(110),
            yoyo: true,
            ease: 'Sine.Out',
          }),
        ]).then(() =>
          this.tween({ targets: go.figure, scaleY: { from: 0.8, to: 1 }, duration: this.dur(140) }),
        );
      }
      case 'deployed': {
        const go = this.spyGO(e.spyId, owner(e.spyId));
        const p = cellCenter(e.to.r, e.to.c);
        go.setPosition(p.x, p.y).setVisible(true).setDepth(40).setScale(0).setAlpha(1);
        return this.tween({ targets: go, scale: 1, duration: this.dur(260), ease: 'Back.Out' });
      }
      case 'pickedUp': {
        const go = this.spyGO(e.spyId, owner(e.spyId));
        this.removeIntel(e.at)?.destroy();
        go.badge.setVisible(true).setScale(0.62 * 1.3);
        return this.tween({
          targets: go.badge,
          scale: 0.62,
          duration: this.dur(180),
          ease: 'Back.Out',
        });
      }
      case 'bumped': {
        const go = this.spyGO(e.spyId, owner(e.spyId));
        const p = cellCenter(e.to.r, e.to.c);
        return Promise.all([
          this.ring(e.from),
          this.tween({ targets: go, x: p.x, y: p.y, duration: this.dur(180), ease: 'Back.Out' }),
        ]);
      }
      case 'bumpBlocked': {
        const go = this.spyGO(e.spyId, owner(e.spyId));
        return this.tween({
          targets: go.figure,
          x: e.dir.c * 8,
          y: e.dir.r * 8,
          duration: this.dur(60),
          yoyo: true,
        });
      }
      case 'burned': {
        const go = this.spyGO(e.spyId, owner(e.spyId));
        if (!this.reducedMotion) this.cameras.main.shake(120, 0.004);
        void this.popText('BURNED!', go.x, go.y - 40, theme.danger);
        return this.tween({
          targets: go,
          x: go.x + e.dir.c * CELL,
          y: go.y + e.dir.r * CELL,
          angle: 360,
          scale: 0.6,
          alpha: 0,
          duration: this.dur(380),
          ease: 'Sine.In',
        });
      }
      case 'dropped': {
        const go = this.spyGO(e.spyId, owner(e.spyId));
        go.badge.setVisible(false);
        const f = this.addIntel(e.at).setScale(0.5);
        return this.tween({ targets: f, scale: 1, duration: this.dur(200), ease: 'Back.Out' });
      }
      case 'extracted': {
        const go = this.spyGO(e.spyId, owner(e.spyId));
        go.badge.setVisible(false);
        const col = playerColors[e.owner] ?? theme.mustard;
        return Promise.all([
          this.popText('EXTRACTED!', go.x, go.y - 50, theme.mustard),
          this.tween({ targets: go.figure, y: -30, duration: this.dur(140), yoyo: true }),
          this.confetti(go.x, go.y, col),
        ]);
      }
      case 'intelSpawned': {
        const f = this.addIntel(e.at).setScale(0);
        return this.tween({ targets: f, scale: 1, duration: this.dur(260), ease: 'Back.Out' });
      }
      default:
        return Promise.resolve();
    }
  }

  private ring(c: Cell): Promise<void> {
    const p = cellCenter(c.r, c.c);
    const g = this.add.circle(p.x, p.y, 40).setStrokeStyle(8, INK, 0.5).setDepth(5);
    return this.tween({ targets: g, scale: 1.8, alpha: 0, duration: this.dur(260) }).then(() =>
      g.destroy(),
    );
  }

  private confetti(x: number, y: number, color: string): Promise<void> {
    if (this.reducedMotion) return Promise.resolve();
    const bits: Promise<void>[] = [];
    for (let i = 0; i < 24; i++) {
      const col = hex(i % 2 ? color : theme.mustard);
      const r = this.add
        .rectangle(x, y, 14, 20, col)
        .setDepth(90)
        .setAngle(i * 15);
      const a = (i / 24) * Math.PI * 2;
      const d = 120 + (i % 5) * 30;
      bits.push(
        this.tween({
          targets: r,
          x: x + Math.cos(a) * d,
          y: y + Math.sin(a) * d + 60,
          angle: i * 15 + 360,
          alpha: 0,
          duration: this.dur(700),
          ease: 'Cubic.Out',
        }).then(() => r.destroy()),
      );
    }
    return Promise.all(bits).then(() => undefined);
  }
}
