export type PlayerId = number;

export interface Cell {
  r: number;
  c: number;
}

export interface Spy {
  id: string;
  owner: PlayerId;
  pos: Cell | null;
  carrying: boolean;
}

export interface PlayerSetup {
  /** Cells where this player's carriers extract and reserve spies deploy. */
  zone: Cell[];
  start: Cell[];
  color: string;
}

export interface Rules {
  size: number;
  players: PlayerSetup[];
  spiesPerPlayer: number;
  movement: 'king' | 'orthogonal';
  bumpOwnSpies: boolean;
  intelOnBoard: number;
  intelStart: Cell[];
  intelSpawnOrder: Cell[];
  intelToWin: number;
  maxPlies: number;
  carrierCanEnterIntel: false;
  firstMoveNoBump: boolean;
  veterans: boolean;
  /** Experimental: false → a shoved carrier keeps its intel (only burning drops it). Default true. */
  dropOnBump: boolean;
  /** Experimental: a team cannot re-grab intel it just dropped until after its next turn. */
  fumble: boolean;
}

export interface GameState {
  rules: Rules;
  ply: number;
  current: PlayerId;
  spies: Spy[];
  intel: Cell[];
  scores: number[];
  winner: PlayerId | 'draw' | null;
  /** Fumble locks: `player` may not pick up intel at `at` (only with rules.fumble). */
  locks?: { at: Cell; player: PlayerId }[];
}

export type Action =
  | { kind: 'move'; spyId: string; to: Cell }
  | { kind: 'deploy'; spyId: string; to: Cell }
  | { kind: 'pass' };

/** Animation grouping: arrive=0, bump=1, pickup=2, extract=3, spawn=4, over=5. */
export type EventPhase = 0 | 1 | 2 | 3 | 4 | 5;

export type GameEventBody =
  | { t: 'moved'; spyId: string; from: Cell; to: Cell }
  | { t: 'deployed'; spyId: string; to: Cell }
  | { t: 'passed'; player: PlayerId }
  | { t: 'pickedUp'; spyId: string; at: Cell }
  | { t: 'bumped'; spyId: string; from: Cell; to: Cell; by: string }
  | { t: 'bumpBlocked'; spyId: string; at: Cell; dir: Cell }
  | { t: 'burned'; spyId: string; from: Cell; dir: Cell }
  | { t: 'dropped'; spyId: string; at: Cell }
  | { t: 'extracted'; spyId: string; owner: PlayerId; at: Cell; score: number }
  | { t: 'intelSpawned'; at: Cell }
  | { t: 'gameOver'; winner: PlayerId | 'draw' };

export type GameEvent = GameEventBody & { phase: EventPhase };
