import { goalText, type Mission } from './missions';

/** Link that opens exactly this puzzle (the daily one is pinned to its date, so old links stay solvable). */
export function missionLink(m: Mission, base: string): string {
  const u = new URL(base);
  u.search = '';
  u.hash = '';
  if (m.daily) {
    u.searchParams.set('mission', 'daily');
    u.searchParams.set('day', m.id.replace(/^daily-/, ''));
  } else u.searchParams.set('mission', m.id);
  return u.toString();
}

/** Spoiler-free text to send a friend: the goal and the link, never the solution. */
export function shareText(m: Mission, base: string): string {
  const name = m.daily ? `Agent vs Agent ${m.title}` : `Agent vs Agent: ${m.title}`;
  return `${name} · ${goalText(m)}. Can you solve it?\n${missionLink(m, base)}`;
}

export type ShareResult = 'shared' | 'copied' | 'failed';

interface ShareNav {
  share?: (d: { text: string }) => Promise<void>;
  clipboard?: { writeText(t: string): Promise<void> };
}

/** Native share sheet when there is one, else the clipboard. A cancelled share sheet is not an error. */
export async function shareMission(m: Mission, base: string, nav: ShareNav): Promise<ShareResult> {
  const text = shareText(m, base);
  if (nav.share) {
    try {
      await nav.share({ text });
      return 'shared';
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return 'shared';
    }
  }
  try {
    if (nav.clipboard) {
      await nav.clipboard.writeText(text);
      return 'copied';
    }
  } catch {
    /* fall through */
  }
  return 'failed';
}
