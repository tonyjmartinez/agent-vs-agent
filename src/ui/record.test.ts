import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Seat } from '../app/config';
import { decode } from '../engine/serialize';
import type { GameState } from '../engine/types';
import { humanResult, loadRecords, recordLine, recordResult } from './record';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const human: Seat = { kind: 'human' };
const bot = (level: 'random' | 'easy' | 'medium' | 'hard'): Seat => ({ kind: 'bot', level });
const ended = (winner: GameState['winner']): GameState => ({
  ...decode('v1.0.0.0-0.51,54,01,04.2233'),
  winner,
});

describe('records', () => {
  let store: ReturnType<typeof fakeStorage>;
  beforeEach(() => {
    store = fakeStorage();
    vi.stubGlobal('localStorage', store);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('starts empty and counts each level separately', () => {
    expect(loadRecords()).toEqual({});
    expect(recordResult('hard', 'win')).toEqual({ w: 1, l: 0, d: 0 });
    expect(recordResult('hard', 'loss')).toEqual({ w: 1, l: 1, d: 0 });
    expect(recordResult('hard', 'draw')).toEqual({ w: 1, l: 1, d: 1 });
    expect(recordResult('easy', 'win')).toEqual({ w: 1, l: 0, d: 0 });
    expect(loadRecords()).toEqual({ hard: { w: 1, l: 1, d: 1 }, easy: { w: 1, l: 0, d: 0 } });
  });

  it('survives junk in storage', () => {
    store.data.set('ava.record.v1', 'not json{');
    expect(loadRecords()).toEqual({});
    store.data.set('ava.record.v1', JSON.stringify([1, 2]));
    expect(loadRecords()).toEqual({});
    store.data.set(
      'ava.record.v1',
      JSON.stringify({ hard: { w: 3, l: -1, d: 'x' }, wizard: { w: 9, l: 9, d: 9 }, easy: null }),
    );
    expect(loadRecords()).toEqual({ hard: { w: 3, l: 0, d: 0 } });
    expect(recordResult('hard', 'win')).toEqual({ w: 4, l: 0, d: 0 });
  });

  it('never throws when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    });
    expect(loadRecords()).toEqual({});
    expect(recordResult('easy', 'win')).toEqual({ w: 1, l: 0, d: 0 });
  });
});

describe('humanResult', () => {
  it('is the human’s outcome in either seat', () => {
    expect(humanResult(ended(0), [human, bot('hard')])).toEqual({ level: 'hard', outcome: 'win' });
    expect(humanResult(ended(1), [human, bot('hard')])).toEqual({ level: 'hard', outcome: 'loss' });
    expect(humanResult(ended(1), [bot('easy'), human])).toEqual({ level: 'easy', outcome: 'win' });
    expect(humanResult(ended(0), [bot('easy'), human])).toEqual({ level: 'easy', outcome: 'loss' });
    expect(humanResult(ended('draw'), [human, bot('medium')])).toEqual({
      level: 'medium',
      outcome: 'draw',
    });
  });
  it('is null for hot-seat, bot-vs-bot, and games that have not ended', () => {
    expect(humanResult(ended(0), [human, human])).toBeNull();
    expect(humanResult(ended(0), [bot('easy'), bot('hard')])).toBeNull();
    expect(humanResult(ended(null), [human, bot('hard')])).toBeNull();
  });
});

describe('recordLine', () => {
  it('reads naturally with singular and plural forms', () => {
    expect(recordLine('hard', { w: 1, l: 1, d: 0 })).toBe('Record vs Hard: 1 win · 1 loss');
    expect(recordLine('easy', { w: 3, l: 0, d: 2 })).toBe(
      'Record vs Easy: 3 wins · 0 losses · 2 draws',
    );
    expect(recordLine('random', { w: 0, l: 1, d: 1 })).toBe(
      'Record vs Rookie: 0 wins · 1 loss · 1 draw',
    );
  });
});
