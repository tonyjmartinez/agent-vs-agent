import { describe, expect, it } from 'vitest';
import { parseConfig } from './config';
import { gameSearch, menuSearch, modeFromString, modeToString } from './navigation';
import { KEYS, load, save, type KV } from './storage';
import { bumpDiagram, burnDiagram, extractDiagram } from '../ui/diagrams';

describe('navigation', () => {
  it('round-trips modes and rejects junk', () => {
    for (const m of ['hotseat', 'bot:easy', 'bot:medium', 'bot:hard']) {
      expect(modeToString(modeFromString(m)!)).toBe(m);
    }
    expect(modeFromString('bot:godlike')).toBeNull();
    expect(modeFromString(null)).toBeNull();
  });

  it('builds game and menu URLs that keep only the carried params', () => {
    expect(gameSearch('', 'hotseat')).toBe('?play=1');
    expect(gameSearch('?menu=1&test=1&speed=0&junk=9', { bot: 'hard' })).toBe(
      '?test=1&speed=0&p1=bot%3Ahard&play=1',
    );
    expect(menuSearch('?play=1&p1=bot:easy&test=1&state=abc')).toBe('?test=1&menu=1');
  });

  it('a game URL never reopens the menu, a bare or menu URL does', () => {
    expect(parseConfig(gameSearch('', 'hotseat'), false).menu).toBe(false);
    expect(parseConfig(gameSearch('', { bot: 'easy' }), false).seats[1]).toEqual({
      kind: 'bot',
      level: 'easy',
    });
    expect(parseConfig('', false).menu).toBe(true);
    expect(parseConfig(menuSearch('?test=1'), false).menu).toBe(true);
    expect(parseConfig('?test=1', false).menu).toBe(false);
    expect(parseConfig('?state=1', false).menu).toBe(false);
  });

  it('coach marks are on for real play, off in tests unless asked', () => {
    expect(parseConfig('?play=1', false).coach).toBe(true);
    expect(parseConfig('?test=1', false).coach).toBe(false);
    expect(parseConfig('?test=1&coach=1', false).coach).toBe(true);
  });
});

describe('storage', () => {
  const mem = (): KV & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  };
  it('reads and writes', () => {
    const s = mem();
    expect(load(KEYS.lastMode, s)).toBeNull();
    save(KEYS.lastMode, 'bot:easy', s);
    expect(load(KEYS.lastMode, s)).toBe('bot:easy');
  });
  it('never throws when storage is missing or broken (private mode)', () => {
    const broken: KV = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(load('x', broken)).toBeNull();
    expect(() => save('x', '1', broken)).not.toThrow();
    expect(load('x', null)).toBeNull();
    expect(() => save('x', '1', null)).not.toThrow();
  });
});

describe('diagrams', () => {
  it.each([
    ['bump', bumpDiagram()],
    ['burn', burnDiagram()],
    ['extract', extractDiagram()],
  ])('%s diagram is a labelled, balanced SVG', (_n, svg) => {
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('role="img"');
    expect(svg).toMatch(/aria-label="[^"]+"/);
    expect(svg.match(/<svg/g)).toHaveLength(1);
    expect(svg).not.toContain('undefined');
    expect(svg).not.toContain('NaN');
  });
});
