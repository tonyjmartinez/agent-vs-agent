import { describe, expect, it, vi } from 'vitest';
import { dailyMission } from './daily';
import { MISSIONS } from './missions';
import { missionLink, shareMission, shareText } from './share';

const base = 'https://example.dev/play/?test=1&speed=0#x';

describe('share links', () => {
  it('curated links name the mission and drop other params and the hash', () => {
    expect(missionLink(MISSIONS[0]!, base)).toBe('https://example.dev/play/?mission=first-contact');
  });
  it('daily links are pinned to their date', () => {
    expect(missionLink(dailyMission('2026-10-24'), base)).toBe(
      'https://example.dev/play/?mission=daily&day=2026-10-24',
    );
  });
  it('every mission link points at the same puzzle', () => {
    for (const m of MISSIONS) {
      expect(new URL(missionLink(m, base)).searchParams.get('mission')).toBe(m.id);
    }
  });
  it('text has the goal and link but no solution hint', () => {
    const t = shareText(MISSIONS[6]!, base);
    expect(t).toContain('Grab and Go');
    expect(t).toContain('Bank an intel in 2 moves');
    expect(t).not.toContain(MISSIONS[6]!.state);
    expect(t).not.toContain(MISSIONS[6]!.brief);
  });
});

describe('shareMission', () => {
  const m = MISSIONS[0]!;
  it('prefers the share sheet', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    expect(await shareMission(m, base, { share, clipboard: { writeText } })).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: shareText(m, base) });
    expect(writeText).not.toHaveBeenCalled();
  });
  it('treats a dismissed share sheet as done, not as a failure', async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }));
    const writeText = vi.fn();
    expect(await shareMission(m, base, { share, clipboard: { writeText } })).toBe('shared');
    expect(writeText).not.toHaveBeenCalled();
  });
  it('falls back to the clipboard when sharing breaks or is missing', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const share = vi.fn().mockRejectedValue(new Error('NotAllowed'));
    expect(await shareMission(m, base, { share, clipboard: { writeText } })).toBe('copied');
    expect(await shareMission(m, base, { clipboard: { writeText } })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(shareText(m, base));
  });
  it('reports failure when nothing works', async () => {
    expect(await shareMission(m, base, {})).toBe('failed');
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    expect(await shareMission(m, base, { clipboard: { writeText } })).toBe('failed');
  });
});
