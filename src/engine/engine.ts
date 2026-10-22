import { KING_DIRS, ORTHO_DIRS, add, cmpCell, inBounds, key, sameCell } from './board';
import { duelRules } from './rules';
import {
  PHASE,
  type Action,
  type Cell,
  type EventBody,
  type GameEvent,
  type GameState,
  type PlayerId,
  type Rules,
  type Spy,
  type Winner,
} from './types';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export function createGame(rules: Rules = duelRules()): GameState {
  const spies: Spy[] = [];
  rules.players.forEach((setup, owner) => {
    for (let i = 0; i < rules.spiesPerPlayer; i++) {
      const start = setup.start[i];
      spies.push({
        id: `p${owner}${LETTERS[i]}`,
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
    intel: rules.intelStart
      .slice(0, rules.intelOnBoard)
      .map((c) => ({ ...c }))
      .sort(cmpCell),
    scores: rules.players.map(() => 0),
    winner: null,
  };
}

export function cloneState(s: GameState): GameState {
  return {
    rules: s.rules,
    ply: s.ply,
    current: s.current,
    spies: s.spies.map((p) => ({ ...p, pos: p.pos ? { ...p.pos } : null })),
    intel: s.intel.map((c) => ({ ...c })),
    scores: [...s.scores],
    winner: s.winner,
  };
}

const spyAt = (s: GameState): Map<number, Spy> => {
  const m = new Map<number, Spy>();
  for (const p of s.spies) if (p.pos) m.set(key(p.pos), p);
  return m;
};
const hasIntel = (s: GameState, c: Cell): boolean => s.intel.some((i) => sameCell(i, c));
const inZone = (rules: Rules, owner: PlayerId, c: Cell): boolean =>
  rules.players[owner]!.extraction.some((z) => sameCell(z, c));

/** Legal actions for the current player in a deterministic order: moves (spy order, direction order), then deploys. */
export function legalActions(s: GameState): Action[] {
  if (s.winner !== null) return [];
  const occ = spyAt(s);
  const dirs = s.rules.movement === 'king' ? KING_DIRS : ORTHO_DIRS;
  const out: Action[] = [];
  for (const spy of s.spies) {
    if (spy.owner !== s.current || !spy.pos) continue;
    for (const d of dirs) {
      const to = add(spy.pos, d);
      if (!inBounds(to) || occ.has(key(to))) continue;
      if (spy.carrying && hasIntel(s, to)) continue;
      out.push({ kind: 'move', spyId: spy.id, to });
    }
  }
  // Reserve spies are interchangeable: list deploys for the first one only.
  const reserve = s.spies.find((p) => p.owner === s.current && !p.pos);
  if (reserve) {
    for (const to of s.rules.players[s.current]!.extraction) {
      if (!occ.has(key(to))) out.push({ kind: 'deploy', spyId: reserve.id, to: { ...to } });
    }
  }
  if (out.length === 0) out.push({ kind: 'pass' });
  return out;
}

function assertLegal(s: GameState, a: Action): void {
  if (s.winner !== null) throw new Error('illegal action: game is over');
  if (a.kind === 'pass') {
    if (legalActions(s)[0]?.kind !== 'pass')
      throw new Error('illegal action: pass with moves available');
    return;
  }
  const spy = s.spies.find((p) => p.id === a.spyId);
  if (!spy || spy.owner !== s.current) throw new Error(`illegal action: not your spy (${a.spyId})`);
  if (!inBounds(a.to)) throw new Error('illegal action: off board');
  if (spyAt(s).has(key(a.to))) throw new Error('illegal action: destination occupied');
  if (a.kind === 'move') {
    if (!spy.pos) throw new Error('illegal action: spy is in reserve');
    const dr = Math.abs(a.to.r - spy.pos.r);
    const dc = Math.abs(a.to.c - spy.pos.c);
    const ok = s.rules.movement === 'king' ? Math.max(dr, dc) === 1 : dr + dc === 1;
    if (!ok) throw new Error('illegal action: not adjacent');
    if (spy.carrying && hasIntel(s, a.to))
      throw new Error('illegal action: carrier cannot enter intel');
  } else {
    if (spy.pos) throw new Error('illegal action: spy is not in reserve');
    if (!inZone(s.rules, s.current, a.to))
      throw new Error('illegal action: not an extraction cell');
  }
}

export interface Applied {
  state: GameState;
  events: GameEvent[];
}

/** Resolve one action per PLAN.md 2.2. Pure: never mutates `s`. Throws on illegal actions. */
export function applyAction(s: GameState, a: Action): Applied {
  assertLegal(s, a);
  const st = cloneState(s);
  const { rules } = st;
  const events: GameEvent[] = [];
  const emit = (e: EventBody, phase: number) => events.push({ ...e, phase });
  const mover = st.current;
  let pendingSpawns = 0;

  const takeIntel = (c: Cell) => {
    st.intel = st.intel.filter((i) => !sameCell(i, c));
  };

  // 1. Arrive, 2. actor picks up.
  let actor: Spy | undefined;
  if (a.kind !== 'pass') {
    actor = st.spies.find((p) => p.id === a.spyId)!;
    if (a.kind === 'move') {
      emit({ t: 'moved', spyId: actor.id, from: { ...actor.pos! }, to: { ...a.to } }, PHASE.arrive);
    } else {
      emit({ t: 'deployed', spyId: actor.id, to: { ...a.to } }, PHASE.arrive);
    }
    actor.pos = { ...a.to };
    if (!actor.carrying && hasIntel(st, a.to)) {
      takeIntel(a.to);
      actor.carrying = true;
      emit({ t: 'pickedUp', spyId: actor.id, at: { ...a.to } }, PHASE.arrive);
    }
  }

  // 3. Bump: every neighbour judged against the pre-bump board.
  if (actor && !(rules.firstMoveNoBump && s.ply === 0)) {
    const dest = actor.pos!;
    const occ = spyAt(st);
    const planned: { spy: Spy; n: Cell; t: Cell; d: Cell }[] = [];
    for (const d of KING_DIRS) {
      const n = add(dest, d);
      const spy = occ.get(key(n));
      if (!spy || !inBounds(n)) continue;
      if (!rules.bumpOwnSpies && spy.owner === actor.owner) continue;
      const t = add(n, d);
      if (inBounds(t) && occ.has(key(t))) {
        emit({ t: 'bumpBlocked', spyId: spy.id, at: n, dir: d }, PHASE.bump);
        continue;
      }
      planned.push({ spy, n, t, d });
    }
    for (const { spy, n, t, d } of planned) {
      if (spy.carrying) {
        spy.carrying = false;
        // Keep "at most one intel per cell": a second intel on the same cell respawns in step 6.
        if (hasIntel(st, n)) pendingSpawns++;
        else st.intel.push({ ...n });
        emit({ t: 'dropped', spyId: spy.id, at: { ...n } }, PHASE.bump);
      }
      if (!inBounds(t)) {
        spy.pos = null;
        emit({ t: 'burned', spyId: spy.id, from: { ...n }, dir: d }, PHASE.bump);
      } else {
        spy.pos = { ...t };
        emit(
          { t: 'bumped', spyId: spy.id, from: { ...n }, to: { ...t }, by: actor.id },
          PHASE.bump,
        );
      }
    }
    // 4. Bumped spies pick up intel they landed on.
    for (const { spy } of planned) {
      if (spy.pos && !spy.carrying && hasIntel(st, spy.pos)) {
        takeIntel(spy.pos);
        spy.carrying = true;
        emit({ t: 'pickedUp', spyId: spy.id, at: { ...spy.pos } }, PHASE.pickup);
      }
    }
  }

  // 5. Extract: any owner's carrier standing in its own zone, in turn order from the mover, then spy id.
  const n = rules.players.length;
  for (let k = 0; k < n; k++) {
    const owner = (mover + k) % n;
    const carriers = st.spies
      .filter((p) => p.owner === owner && p.carrying && p.pos && inZone(rules, owner, p.pos))
      .sort((x, y) => (x.id < y.id ? -1 : 1));
    for (const spy of carriers) {
      spy.carrying = false;
      st.scores[owner]!++;
      pendingSpawns++;
      emit(
        { t: 'extracted', spyId: spy.id, owner, at: { ...spy.pos! }, score: st.scores[owner]! },
        PHASE.extract,
      );
    }
  }

  // 6. Respawn intel on the first free cell of the spawn order.
  for (let i = 0; i < pendingSpawns; i++) {
    const occ = spyAt(st);
    const cell = rules.intelSpawnOrder.find((c) => !occ.has(key(c)) && !hasIntel(st, c));
    if (!cell) break;
    st.intel.push({ ...cell });
    emit({ t: 'intelSpawned', at: { ...cell } }, PHASE.spawn);
  }
  st.intel.sort(cmpCell);

  // 7. Win check.
  st.winner = decideWinner(st, mover);
  if (st.winner !== null) emit({ t: 'gameOver', winner: st.winner }, PHASE.over);

  // 8. Advance.
  st.current = (mover + 1) % n;
  st.ply = s.ply + 1;
  return { state: st, events };
}

function decideWinner(st: GameState, mover: PlayerId): Winner {
  const n = st.scores.length;
  const { intelToWin, maxPlies } = st.rules;
  const reached = st.scores.map((v, i) => [v, i] as const).filter(([v]) => v >= intelToWin);
  if (reached.length > 0) {
    if (reached.some(([, i]) => i === mover)) return mover;
    // Several non-movers: highest score, then earliest in turn order after the mover.
    const best = Math.max(...reached.map(([v]) => v));
    for (let k = 1; k < n; k++) {
      const p = (mover + k) % n;
      if (st.scores[p] === best) return p;
    }
  }
  if (st.ply + 1 >= maxPlies) {
    const best = Math.max(...st.scores);
    const leaders = st.scores.flatMap((v, i) => (v === best ? [i] : []));
    return leaders.length === 1 ? leaders[0]! : 'draw';
  }
  return null;
}

export const isTerminal = (s: GameState): boolean => s.winner !== null;

export function previewAction(s: GameState, a: Action): GameEvent[] {
  return applyAction(s, a).events;
}

/** Canonical position string (ply excluded so equal positions collide, which transposition tables want). */
export function hash(s: GameState): string {
  const spies = [...s.spies]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((p) => `${p.id}${p.pos ? key(p.pos) : 'x'}${p.carrying ? '*' : ''}`)
    .join(',');
  const intel = [...s.intel].sort(cmpCell).map(key).join(',');
  return `${s.current}|${s.scores.join(',')}|${String(s.winner)}|${spies}|${intel}`;
}
