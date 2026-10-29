import type { Goal } from './ai/solve';

/**
 * Missions: tactical puzzles mined from seeded self-play by `scripts/missions.ts`, then curated.
 * You play Red (to move). The defender (Teal) answers with the reply that best refutes you.
 * Every entry is proven by `src/missions.test.ts`: forced within `moves`, impossible in fewer,
 * and at most a third of Red's first moves work.
 */
export interface Mission {
  id: string;
  title: string;
  /** One-line hint shown in the briefing; never gives the move away. */
  brief: string;
  goal: Goal;
  /** Red's moves allowed (1 to 3). */
  moves: number;
  /** Compact state string (`engine/serialize.ts`), Red to move. */
  state: string;
  /** The mission of the day (see `daily.ts`): not in the list, progress tracked as a streak. */
  daily?: boolean;
}

export const MISSIONS: readonly Mission[] = [
  {
    id: 'first-contact',
    title: 'First Contact',
    brief: 'An agent is loitering on the edge. Arrive next to it and shove it off the board.',
    goal: 'burn',
    moves: 1,
    state: 'v1.0.4.0-0.52,34,02,15.2233',
  },
  {
    id: 'backdoor',
    title: 'Backdoor',
    brief: 'Someone is snooping on your HQ row. Show them the exit.',
    goal: 'burn',
    moves: 1,
    state: 'v1.0.20.0-2.40,55,02,53.2231',
  },
  {
    id: 'high-ground',
    title: 'High Ground',
    brief: 'You are already deep in their territory. Push the right agent the wrong way.',
    goal: 'burn',
    moves: 1,
    state: 'v1.0.28.0-2.01,51,05,03.2233',
  },
  {
    id: 'dash-home',
    title: 'Dash Home',
    brief: 'Carriers can sprint two squares in a straight line. Get the folder home.',
    goal: 'extract',
    moves: 1,
    state: 'v1.0.6.0-0.51,33*,12,04.22',
  },
  {
    id: 'carrier-strike',
    title: 'Carrier Strike',
    brief: 'A sprinting carrier still bumps where it lands. Use that.',
    goal: 'burn',
    moves: 1,
    state: 'v1.0.6.0-0.50,33*,00,12.22',
  },
  {
    id: 'match-point',
    title: 'Match Point',
    brief: 'Two each. One folder in hand. Finish it.',
    goal: 'win',
    moves: 1,
    state: 'v1.0.34.2-2.51,33*,00,03.22',
  },
  {
    id: 'grab-and-go',
    title: 'Grab and Go',
    brief: 'Pick up intel, then get it home before Teal can react.',
    goal: 'extract',
    moves: 2,
    state: 'v1.0.4.0-0.41,44,01,04.2233',
  },
  {
    id: 'side-step',
    title: 'Side Step',
    brief: 'A defender blocks the straight road home. Take the long way round.',
    goal: 'extract',
    moves: 2,
    state: 'v1.0.14.0-0.22*,x,00,43.33',
  },
  {
    id: 'shoulder-charge',
    title: 'Shoulder Charge',
    brief: 'Their carrier is in your way. Knock the folder loose and keep running.',
    goal: 'extract',
    moves: 2,
    state: 'v1.0.26.0-1.20*,x,33*,03.',
  },
  {
    id: 'double-tap',
    title: 'Double Tap',
    brief: 'Both Teal agents are still at home. Visit them.',
    goal: 'burn',
    moves: 2,
    state: 'v1.0.4.0-0.50,44,00,02.2233',
  },
  {
    id: 'set-the-trap',
    title: 'Set the Trap',
    brief: 'An intruder is near your row. Make every escape route a dead end.',
    goal: 'burn',
    moves: 2,
    state: 'v1.0.22.0-2.43,45,02,41.2233',
  },
  {
    id: 'endgame',
    title: 'Endgame',
    brief: 'Two points down to one. A defender stands between you and home.',
    goal: 'win',
    moves: 2,
    state: 'v1.0.32.2-1.51,22*,00,43.33',
  },
  {
    id: 'last-stand',
    title: 'Last Stand',
    brief: 'Teal is carrying their winning folder. Take the game first.',
    goal: 'win',
    moves: 2,
    state: 'v1.0.42.2-2.50,44,22*,04.33',
  },
  {
    id: 'long-way-round',
    title: 'Long Way Round',
    brief:
      'Teal is carrying a folder across the board. Take it, and keep running until it is home.',
    goal: 'extract',
    moves: 3,
    state: 'v1.0.16.0-0.31,52,11,33*.22',
  },
  {
    id: 'cornered',
    title: 'Cornered',
    brief: 'Both Teal agents hug the edges. Three quiet moves, one splash.',
    goal: 'burn',
    moves: 3,
    state: 'v1.0.28.0-2.30,52,00,15.2233',
  },
  {
    id: 'reserve-play',
    title: 'Reserve Play',
    brief: 'One agent is still in reserve and the score is level. Bring it on at the right moment.',
    goal: 'burn',
    moves: 3,
    state: 'v1.0.20.1-1.41,x,00,43.2233',
  },
  {
    id: 'long-odds',
    title: 'Long Odds',
    brief: 'One point from victory, and it takes three moves to get it. Teal is carrying too.',
    goal: 'win',
    moves: 3,
    state: 'v1.0.34.2-1.12,55,33*,05.22',
  },
  {
    id: 'overtime',
    title: 'Overtime',
    brief: 'Level at two apiece, deep into the game. Whoever banks next takes it.',
    goal: 'win',
    moves: 3,
    state: 'v1.0.74.2-2.54,31,33*,11.22',
  },
];

export const missionById = (id: string): Mission | undefined => MISSIONS.find((m) => m.id === id);

const GOAL_TEXT: Record<Goal, string> = {
  win: 'Win the game',
  extract: 'Bank an intel',
  burn: 'Burn a Teal agent',
};

/** Result-card line for a won mission: Red moves used against the budget. */
export const solvedText = (used: number, budget: number): string =>
  `Solved in ${used} of ${budget} ${budget === 1 ? 'move' : 'moves'}.`;

/** A win that strictly beats the stored best is a "New best!". A first win is not (there is nothing to beat yet). */
export const isNewBest = (used: number, prevBest: number | undefined): boolean =>
  prevBest !== undefined && used < prevBest;

/** Mission-list line for a completed mission: the fewest Red moves it has been solved in. */
export const bestText = (best: number, budget: number): string =>
  `Best: ${best} of ${budget} ${budget === 1 ? 'move' : 'moves'}`;

/** In-play pill: goal and Red moves remaining. */
export const pillText = (m: Pick<Mission, 'goal'>, left: number): string =>
  `${GOAL_TEXT[m.goal]} · ${left} move${left === 1 ? '' : 's'} left`;

/** Fresh-profile hint pointing at the first mission; empty once any mission is complete (hidden). */
export function firstHintText(
  done: number,
  first: Pick<Mission, 'title' | 'goal' | 'moves'> | undefined,
): string {
  return done === 0 && first ? `Start with mission 1: ${first.title}. ${goalText(first)}.` : '';
}

/** Mission list progress line; the full set gets a clear finish note. */
export function progressText(done: number, total: number): string {
  return done >= total && total > 0
    ? `All ${total} missions complete. Nice work.`
    : `${done} of ${total} complete`;
}

export function goalText(m: Pick<Mission, 'goal' | 'moves'>): string {
  return `${GOAL_TEXT[m.goal]} in ${m.moves} move${m.moves > 1 ? 's' : ''}`;
}
