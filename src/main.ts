import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import './ui/styles.css';
import { hintSelection } from './hint';
import { Solver, goalMet } from './ai/solve';
import { BotClient } from './app/botClient';
import { Controller } from './app/controller';
import { parseConfig, type Seat } from './app/config';
import { installHooks } from './app/testHooks';
import { duelRules } from './engine/rules';
import { decode } from './engine/serialize';
import { showGameOver } from './ui/gameOver';
import { Hud } from './ui/hud';
import { Sound } from './ui/sound';
import { showMenu, showPause } from './ui/menu';
import {
  completedMissions,
  markCompleted,
  bestMoves,
  recordBest,
  completedDays,
  markDayDone,
  missionPill,
  showBriefing,
  showMissionResult,
  showMissions,
} from './ui/missions';
import { dailyMissedText, dailyMission, dailyStreakText, dayKey, streak } from './daily';
import {
  MISSIONS,
  firstWinText,
  isNewBest,
  missionById,
  pillText,
  progressText,
  type Mission,
} from './missions';
import type { GameState } from './engine/types';
import { humanResult, recordLine, recordResult, resultShareText } from './ui/record';
import { load, save } from './ui/storage';
import { PhaserBoardView } from './view/PhaserBoardView';

const cfg = parseConfig(location.search);
// speed=0 (tests): no CSS animation either, so screenshots are deterministic.
if (cfg.speed === 0) document.documentElement.classList.add('no-motion');
let controller: Controller | null = null;
const view = new PhaserBoardView();
const overlayRoot = document.getElementById('overlay-root')!;
const bots = new BotClient();
const sound = new Sound();
// iOS: audio may only start inside a user gesture.
addEventListener('pointerup', () => sound.unlock(), { capture: true });

// ---------- first-game coach marks (shown once) ----------
const COACH_KEY = 'ava.coach.v1';
let coachDone = cfg.test || load(COACH_KEY, false);
let lastTouch = matchMedia('(pointer: coarse)').matches;
addEventListener('pointerdown', (e: PointerEvent) => (lastTouch = e.pointerType !== 'mouse'), {
  capture: true,
});

// ---------- missions (tactical puzzles; see src/missions.ts) ----------
interface MissionRun {
  m: Mission;
  start: GameState;
  solver: Solver;
  /** Replaying the forced line: both seats are automated and the mission is not credited. */
  demo: boolean;
}
let run: MissionRun | null = null;

/** Red moves played since the mission started. */
function redMovesMade(c: Controller): number {
  let n = 0;
  for (let i = 1; i < c.history.length; i++) if (c.history[i - 1]!.current === 0) n++;
  return n;
}

function startMission(m: Mission, demo = false): void {
  document.getElementById('game-over')?.remove();
  document.getElementById('mission-result')?.remove();
  document.getElementById('coach')?.remove();
  const start = decode(m.state, duelRules());
  run = { m, start, solver: new Solver(start, m.goal), demo };
  if (demo) {
    controller?.start(start, [
      { kind: 'bot', level: 'hard' },
      { kind: 'bot', level: 'hard' },
    ]);
    return;
  }
  controller?.start(start, [{ kind: 'human' }, { kind: 'bot', level: 'hard' }]);
  showBriefing(overlayRoot, m, () => controller?.refresh());
}

function endMission(): void {
  run = null;
  missionPill(null);
}

/** Judge the mission after every action: success right after a Red move, else out of moves. */
function judgeMission(c: Controller, s: GameState): void {
  if (!run) return;
  const r = run;
  const redJustMoved = c.history.length > 1 && c.history.at(-2)!.current === 0;
  const success = redJustMoved && goalMet(r.start, s, r.m.goal, 0);
  const failed = !success && (s.winner !== null || (redJustMoved && redMovesMade(c) >= r.m.moves));
  if (!success && !failed) return;
  c.stop();
  endMission();
  let prevBest: number | undefined;
  let extra = '';
  let finish = '';
  if (success && !r.demo) {
    if (r.m.daily) {
      const day = r.m.id.slice('daily-'.length);
      markDayDone(day);
      extra = dailyStreakText(streak(completedDays(), day));
    } else {
      const firstWin = completedMissions().size === 0;
      markCompleted(r.m.id);
      prevBest = bestMoves()[r.m.id];
      recordBest(r.m.id, redMovesMade(c));
      // The win that completes the whole set says so on the card, not only on the list.
      const done = completedMissions();
      const finished = MISSIONS.filter((m) => done.has(m.id)).length;
      if (finished >= MISSIONS.length) finish = progressText(finished, MISSIONS.length);
      else if (firstWin) finish = firstWinText;
    }
  } else if (failed && r.m.daily && !r.demo) extra = dailyMissedText();
  // The daily mission isn't part of the list, so it has no "next".
  const nextM = r.m.daily ? undefined : MISSIONS[MISSIONS.indexOf(r.m) + 1];
  showMissionResult(
    overlayRoot,
    r.m,
    success ? (r.demo ? 'solution' : 'complete') : 'failed',
    {
      next: nextM ? () => startMission(nextM) : undefined,
      retry: () => startMission(r.m),
      solution: () => startMission(r.m, true),
      list: () => openMissions(),
    },
    success ? redMovesMade(c) : undefined,
    success && !r.demo && !r.m.daily && isNewBest(redMovesMade(c), prevBest),
    r.m.daily ? (!r.demo ? extra : '') : finish,
  );
}

/** The date the daily mission is for: the clock (UTC), or `?day=` in tests. */
const today = (): string => cfg.day ?? dayKey(new Date());

function openMissions(): void {
  endMission();
  document.getElementById('game-over')?.remove();
  showMissions(overlayRoot, { pick: (m) => startMission(m), back: () => toMenu() }, today());
}

/** Select the piece that starts a forcing line (never the destination). Nothing to point at → say so. */
function hint(c: Controller): void {
  if (!run || run.demo || !c.isHumanToMove()) return;
  // Keyboard play ignores Enter/Tab/Space while a button has focus, so hand focus back to the board.
  const pill = document.getElementById('mission-pill');
  if (document.activeElement === pill) pill?.blur();
  const left = run.m.moves - redMovesMade(c);
  const sel = hintSelection(run.solver, c.state, left);
  if (sel === null) {
    missionPill('Out of reach · Menu → Restart', () => hint(c));
    return;
  }
  c.select({ selected: sel, pending: null });
}

function coach(c: Controller): void {
  if (run) {
    missionPill(
      run.demo ? 'Solution · watch the line' : pillText(run.m, run.m.moves - redMovesMade(c)),
      run.demo ? undefined : () => hint(c),
    );
  }
  let el = document.getElementById('coach');
  if (run) {
    el?.remove();
    return;
  }
  if (coachDone || !c.isHumanToMove() || document.querySelector('.overlay')) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'coach';
    el.className = 'coach';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = !c.sel.selected
    ? lastTouch
      ? 'Tap one of your spies'
      : 'Click one of your spies'
    : !c.sel.pending
      ? lastTouch
        ? 'Tap a dot to preview the move'
        : 'Hover a dot to preview, click to move'
      : 'Tap again to move';
}

async function boot(): Promise<void> {
  await Promise.all([
    document.fonts.load('700 48px Fredoka'),
    document.fonts.load('500 16px Fredoka'),
  ]);
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await view.mount(document.getElementById('board')!);
  view.setSpeed(cfg.speed);
  const hud = new Hud(document.getElementById('hud-top')!, document.getElementById('hud-bottom')!, {
    onReserve: (p) => controller?.onReserve(p),
    onUndo: () => {
      document.getElementById('game-over')?.remove();
      controller?.undo();
    },
    onSound: () => {
      sound.toggle();
      controller?.refresh();
    },
    soundOn: () => !sound.muted,
    onMenu: () =>
      showPause(overlayRoot, {
        restart: () => (run ? startMission(run.m) : newGame()),
        quit: () => toMenu(),
      }),
  });
  controller = new Controller({
    view,
    hud,
    seats: cfg.seats,
    speed: cfg.speed,
    confirmTouch: cfg.confirmTouch ?? true,
    seed: cfg.seed || Math.floor(Math.random() * 1e9),
    rules: cfg.rules,
    chooseBot: (s, level, seed, history) =>
      run && controller
        ? Promise.resolve(run.solver.demoStep(s, run.m.moves - redMovesMade(controller)))
        : bots.choose(s, level, seed, history),
    onGameOver: (s) => {
      document.getElementById('coach')?.remove();
      // Only real games count toward the record: not missions, not hot-seat, not bot-vs-bot.
      const res = run ? null : humanResult(s, controller!.seats);
      const record = res ? recordLine(res.level, recordResult(res.level, res.outcome)) : undefined;
      showGameOver(
        overlayRoot,
        s,
        controller!.seats,
        controller!.stats,
        { rematch: () => newGame(), menu: () => toMenu() },
        record,
        run ? undefined : (resultShareText(s, controller!.seats, location.href) ?? undefined),
      );
    },
    onAction: (s) => {
      if (controller) judgeMission(controller, s);
      if (!coachDone && controller && controller.history.length > 1) {
        coachDone = true;
        save(COACH_KEY, true);
      }
    },
    onRefresh: coach,
    onEvents: (ev) => sound.play(ev),
  });
  const direct = cfg.mission
    ? cfg.mission === 'daily'
      ? dailyMission(today())
      : missionById(cfg.mission)
    : undefined;
  if (direct) startMission(direct, cfg.solution);
  else if (cfg.direct)
    controller.start(cfg.state ? decode(cfg.state, duelRules(cfg.rules)) : undefined);
  else {
    controller.start();
    toMenu();
  }
}

function newGame(seats?: Seat[]): void {
  endMission();
  document.getElementById('game-over')?.remove();
  controller?.start(undefined, seats);
}

function toMenu(): void {
  endMission();
  controller?.stop();
  document.getElementById('game-over')?.remove();
  document.getElementById('coach')?.remove();
  showMenu(overlayRoot, ({ seats }) => newGame(seats), openMissions);
}

// Desktop keyboard play; ignored while a menu or dialog is open.
addEventListener('keydown', (e: KeyboardEvent) => {
  if (!controller || document.querySelector('.overlay') || e.metaKey || e.ctrlKey || e.altKey)
    return;
  // Let Tab/Enter/Space keep their normal meaning while a button has focus.
  const onButton = document.activeElement instanceof HTMLButtonElement;
  if (onButton && (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ')) return;
  if (controller.onKey(e.key, e.shiftKey)) e.preventDefault();
});

const ready = boot();
if (import.meta.env.DEV || cfg.test) installHooks(ready, () => ({ controller, view }));
