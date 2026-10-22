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
  /** Cells that bank intel for this player; also where this player deploys. */
  extraction: Cell[];
  /** Starting cells, one per spy, in spy order. */
  start: Cell[];
  color: string;
}

export interface Rules {
  size: 6;
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
}

export type Winner = PlayerId | 'draw' | null;

export interface GameState {
  rules: Rules;
  ply: number;
  current: PlayerId;
  spies: Spy[];
  intel: Cell[];
  scores: number[];
  winner: Winner;
}

export type Action =
  | { kind: 'move'; spyId: string; to: Cell }
  | { kind: 'deploy'; spyId: string; to: Cell }
  | { kind: 'pass' };

export type EventBody =
  | { t: 'moved'; spyId: string; from: Cell; to: Cell }
  | { t: 'deployed'; spyId: string; to: Cell }
  | { t: 'pickedUp'; spyId: string; at: Cell }
  | { t: 'bumped'; spyId: string; from: Cell; to: Cell; by: string }
  | { t: 'bumpBlocked'; spyId: string; at: Cell; dir: Cell }
  | { t: 'burned'; spyId: string; from: Cell; dir: Cell }
  | { t: 'dropped'; spyId: string; at: Cell }
  | { t: 'extracted'; spyId: string; owner: PlayerId; at: Cell; score: number }
  | { t: 'intelSpawned'; at: Cell }
  | { t: 'gameOver'; winner: PlayerId | 'draw' };

/** `phase`: arrive 0, bump 1, pickup 2, extract 3, spawn 4, over 5. Non-decreasing within one action. */
export type GameEvent = EventBody & { phase: number };

export const PHASE = { arrive: 0, bump: 1, pickup: 2, extract: 3, spawn: 4, over: 5 } as const;
