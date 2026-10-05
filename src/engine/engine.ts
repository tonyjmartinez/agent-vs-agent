import { KING_DIRS, ORTHO_DIRS, add, cmpCell, eq, inBounds } from './board';
import type {
  Action,
  Cell,
  EventPhase,
  GameEvent,
  GameEventBody,
  GameState,
  PlayerId,
  Rules,
  Spy,
} from './types';

const spyLetter = 'abcdefghijklmnop';

export function createGame(rules: Rules): GameState {
  const spies: Spy[] = [];
  rules.players.forEach((p, owner) => {
    for (let i = 0; i < rules.spiesPerPlayer; i++) {
      const start = p.start[i];
      spies.push({
        id: `p${owner}${spyLetter[i]}`,
        owner,
        pos: start ? { ...start } : null,
        carrying: false,
      });
    }
  });
  return {
    rules,
    ply: 0,
    current: 0,
    spies,
    intel: rules.intelStart.map((c) => ({ ...c })).sort(cmpCell),
    scores: rules.players.map(() => 0),
    winner: null,
  };
}

export const inZone = (rules: Rules, owner: PlayerId, p: Cell): boolean =>
  rules.players[owner]!.zone.some((z) => eq(z, p));

const spyAt = (spies: readonly Spy[], p: Cell): Spy | undefined => spies.find((s) => eq(s.pos, p));
const hasIntel = (intel: readonly Cell[], p: Cell): boolean => intel.some((i) => eq(i, p));

/** Every legal action for the current player in a deterministic order (moves by spy, then deploys). */
export function legalActions(s: GameState): Action[] {
  if (s.winner !== null) return [];
  const out: Action[] = [];
  const dirs = s.rules.movement === 'king' ? KING_DIRS : ORTHO_DIRS;
  const mine = s.spies.filter((x) => x.owner === s.current);
  for (const sp of mine) {
    if (!sp.pos) continue;
    for (const d of dirs) {
      const to = add(sp.pos, d);
      if (!inBounds(to, s.rules.size) || spyAt(s.spies, to)) continue;
      if (sp.carrying && hasIntel(s.intel, to)) continue;
      out.push({ kind: 'move', spyId: sp.id, to });
    }
  }
  const reserve = mine.find((x) => !x.pos);
  if (reserve) {
    const zone = [...s.rules.players[s.current]!.zone].sort(cmpCell);
    for (const to of zone) {
      if (!spyAt(s.spies, to)) out.push({ kind: 'deploy', spyId: reserve.id, to: { ...to } });
    }
  }
  return out.length ? out : [{ kind: 'pass' }];
}

function isLegal(s: GameState, a: Action): boolean {
  return legalActions(s).some(
    (b) =>
      b.kind === a.kind &&
      (b.kind === 'pass' || (a.kind !== 'pass' && b.spyId === a.spyId && eq(b.to, a.to))),
  );
}

function sameSpyGroupDeploy(s: GameState, a: Action): boolean {
  // Any reserve spy of the current player may be named in a deploy (they are interchangeable).
  if (a.kind !== 'deploy') return false;
  const sp = s.spies.find((x) => x.id === a.spyId);
  if (!sp || sp.owner !== s.current || sp.pos) return false;
  return legalActions(s).some((b) => b.kind === 'deploy' && eq(b.to, a.to));
}

/** Apply an action immutably. Throws on illegal actions. Events follow PLAN 2.2 order. */
export function applyAction(s: GameState, a: Action): { state: GameState; events: GameEvent[] } {
  if (s.winner !== null) throw new Error('game is over');
  if (!isLegal(s, a) && !sameSpyGroupDeploy(s, a))
    throw new Error(`illegal action ${JSON.stringify(a)}`);
  return applyTrusted(s, a);
}

/** applyAction without the legality check, for search over actions from `legalActions`. */
export function applyTrusted(s: GameState, a: Action): { state: GameState; events: GameEvent[] } {
  const rules = s.rules;
  const spies: Spy[] = s.spies.map((x) => ({ ...x, pos: x.pos ? { ...x.pos } : null }));
  let intel: Cell[] = s.intel.map((c) => ({ ...c }));
  const scores = [...s.scores];
  const events: GameEvent[] = [];
  const emit = (phase: EventPhase, e: GameEventBody) => events.push({ ...e, phase } as GameEvent);
  const takeIntel = (p: Cell) => (intel = intel.filter((i) => !eq(i, p)));

  if (a.kind === 'pass') {
    emit(0, { t: 'passed', player: s.current });
  } else {
    const actor = spies.find((x) => x.id === a.spyId)!;
    const dest = { ...a.to };
    // 1. Arrive
    if (a.kind === 'move') emit(0, { t: 'moved', spyId: actor.id, from: actor.pos!, to: dest });
    else emit(0, { t: 'deployed', spyId: actor.id, to: dest });
    actor.pos = dest;
    // 2. Actor pickup
    if (!actor.carrying && hasIntel(intel, dest)) {
      takeIntel(dest);
      actor.carrying = true;
      emit(0, { t: 'pickedUp', spyId: actor.id, at: dest });
    }
    // 3. Bump (against the pre-bump board)
    const noBump = rules.firstMoveNoBump && s.ply === 0;
    const landed: Spy[] = [];
    if (!noBump) {
      const pre = spies.map((x) => ({ id: x.id, pos: x.pos }));
      const occupiedPre = (p: Cell) => pre.some((x) => eq(x.pos, p));
      for (const d of KING_DIRS) {
        const n = add(dest, d);
        const victim = spies.find((x) => x !== actor && eq(x.pos, n));
        if (!victim) continue;
        if (!rules.bumpOwnSpies && victim.owner === actor.owner) continue;
        const t = add(n, d);
        const onBoard = inBounds(t, rules.size);
        if (onBoard && occupiedPre(t)) {
          emit(1, { t: 'bumpBlocked', spyId: victim.id, at: n, dir: d });
          continue;
        }
        if (victim.carrying) {
          victim.carrying = false;
          intel.push({ ...n });
          emit(1, { t: 'dropped', spyId: victim.id, at: n });
        }
        if (!onBoard) {
          victim.pos = null;
          emit(1, { t: 'burned', spyId: victim.id, from: n, dir: d });
        } else {
          victim.pos = t;
          landed.push(victim);
          emit(1, { t: 'bumped', spyId: victim.id, from: n, to: t, by: actor.id });
        }
      }
    }
    // 4. Bumped spies pick up
    for (const v of landed) {
      if (!v.carrying && v.pos && hasIntel(intel, v.pos)) {
        takeIntel(v.pos);
        v.carrying = true;
        emit(2, { t: 'pickedUp', spyId: v.id, at: v.pos });
      }
    }
  }

  // 5. Extract (current player first, then by spy id) and 6. respawn
  const n = rules.players.length;
  const order = [...spies]
    .filter((x) => x.pos && x.carrying && inZone(rules, x.owner, x.pos))
    .sort(
      (x, y) =>
        ((x.owner - s.current + n) % n) - ((y.owner - s.current + n) % n) ||
        (x.id < y.id ? -1 : x.id > y.id ? 1 : 0),
    );
  for (const x of order) {
    x.carrying = false;
    scores[x.owner]! += 1;
    emit(3, {
      t: 'extracted',
      spyId: x.id,
      owner: x.owner,
      at: { ...x.pos! },
      score: scores[x.owner]!,
    });
    const spawn = rules.intelSpawnOrder.find((p) => !spyAt(spies, p) && !hasIntel(intel, p));
    if (spawn) {
      intel.push({ ...spawn });
      emit(4, { t: 'intelSpawned', at: { ...spawn } });
    }
  }

  // 7. Win check
  let winner: GameState['winner'] = null;
  const reached = scores.map((sc, i) => (sc >= rules.intelToWin ? i : -1)).filter((i) => i >= 0);
  if (reached.length) {
    // Ties go to the current player, then onward in turn order.
    for (let k = n - 1; k >= 0; k--)
      if (reached.includes((s.current + k) % n)) winner = (s.current + k) % n;
  } else if (s.ply + 1 >= rules.maxPlies) {
    const best = Math.max(...scores);
    const leaders = scores.map((sc, i) => (sc === best ? i : -1)).filter((i) => i >= 0);
    winner = leaders.length === 1 ? leaders[0]! : 'draw';
  }
  if (winner !== null) emit(5, { t: 'gameOver', winner });

  // 8. Advance
  const state: GameState = {
    rules,
    ply: s.ply + 1,
    current: (s.current + 1) % n,
    spies,
    intel: intel.sort(cmpCell),
    scores,
    winner,
  };
  return { state, events };
}

export const previewAction = (s: GameState, a: Action): GameEvent[] => applyAction(s, a).events;

export const isTerminal = (s: GameState): boolean => s.winner !== null;

/** Canonical position string (excludes rules and ply). */
export function hash(s: GameState): string {
  const c = (p: Cell | null) => (p ? `${p.r}${p.c}` : 'x');
  return [
    s.current,
    s.scores.join(','),
    s.spies.map((x) => c(x.pos) + (x.carrying ? '*' : '')).join(','),
    s.intel.map(c).join(''),
    s.winner ?? '',
  ].join('|');
}
