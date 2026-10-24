import { dailyMission, isDayKey, streak } from '../daily';
import { MISSIONS, goalText, type Mission } from '../missions';
import { shareMission, type ShareResult } from '../share';
import { load, save } from './storage';

const KEY = 'ava.missions.v1';

/** Ids of completed missions (localStorage, never throws). */
export function completedMissions(): Set<string> {
  const v = load<unknown>(KEY, []);
  return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
}

export function markCompleted(id: string): void {
  const done = completedMissions();
  done.add(id);
  save(KEY, [...done]);
}

const DAILY_KEY = 'ava.daily.v1';
const KEEP_DAYS = 120;

/** Dates (UTC `YYYY-MM-DD`) on which the daily mission was solved for real, oldest first. */
export function completedDays(): string[] {
  const v = load<unknown>(DAILY_KEY, []);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && isDayKey(x)) : [];
}

export function markDayDone(day: string): void {
  if (!isDayKey(day)) return;
  const days = [...new Set([...completedDays(), day])].sort().slice(-KEEP_DAYS);
  save(DAILY_KEY, days);
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Stamp text, with any date kept on one line (a date that wraps at its hyphens reads as two numbers). */
const stampTitle = (title: string): string =>
  esc(title.toUpperCase()).replace(/\d{4}-\d{2}-\d{2}/, (d) => `<span class="nowrap">${d}</span>`);

/** Mission list: one button per mission, completed ones ticked. */
export function showMissions(
  root: HTMLElement,
  on: { pick(m: Mission): void; back(): void },
  today: string,
): void {
  const done = completedMissions();
  const days = completedDays();
  const daily = dailyMission(today);
  const dailyDone = days.includes(today);
  const run = streak(days, today);
  const wrap = document.createElement('div');
  wrap.className = 'overlay menu-overlay';
  wrap.id = 'missions';
  wrap.innerHTML = `<div class="card menu missions" role="dialog" aria-modal="true" aria-labelledby="missions-title">
    <h2 id="missions-title" class="title">Missions</h2>
    <button class="btn daily-btn${dailyDone ? ' done' : ''}" data-testid="daily-btn">
      <span class="mission-text"><b>Daily mission</b><small>${today} · ${goalText(daily)}</small></span>
      <span class="mission-tick" aria-label="${dailyDone ? 'done today' : 'not done today'}">${dailyDone ? '✓' : ''}</span>
    </button>
    <p class="sub" data-testid="daily-streak">Streak: ${run} day${run === 1 ? '' : 's'}</p>
    <p class="sub" data-testid="missions-progress">${done.size} of ${MISSIONS.length} complete</p>
    <ol class="mission-list">
      ${MISSIONS.map(
        (
          m,
          i,
        ) => `<li><button class="btn mission-btn${done.has(m.id) ? ' done' : ''}" data-mission="${m.id}">
          <span class="mission-no">${i + 1}</span>
          <span class="mission-text"><b>${esc(m.title)}</b><small>${goalText(m)}</small></span>
          <span class="mission-tick" aria-label="${done.has(m.id) ? 'complete' : 'not done'}">${done.has(m.id) ? '✓' : ''}</span>
        </button></li>`,
      ).join('')}
    </ol>
    <button class="btn big" id="btn-missions-back">Back</button>
  </div>`;
  wrap.querySelectorAll<HTMLButtonElement>('[data-mission]').forEach((b) =>
    b.addEventListener('click', () => {
      const m = MISSIONS.find((x) => x.id === b.dataset.mission)!;
      wrap.remove();
      on.pick(m);
    }),
  );
  wrap.querySelector('[data-testid="daily-btn"]')!.addEventListener('click', () => {
    wrap.remove();
    on.pick(daily);
  });
  wrap.querySelector('#btn-missions-back')!.addEventListener('click', () => {
    wrap.remove();
    on.back();
  });
  root.append(wrap);
}

const SHARE_NOTE: Record<ShareResult, string> = {
  shared: 'Shared.',
  copied: 'Link copied.',
  failed: 'Could not share. Copy the page address instead.',
};

/** Wire the card's Share button: native sheet or clipboard, with a polite status line. */
function wireShare(wrap: HTMLElement, m: Mission): void {
  const note = wrap.querySelector<HTMLElement>('[data-testid="share-note"]')!;
  wrap.querySelector('[data-testid="share-btn"]')!.addEventListener('click', async () => {
    const r = await shareMission(m, location.href, navigator);
    note.textContent = SHARE_NOTE[r];
  });
}

const SHARE_HTML = `<button class="btn" data-testid="share-btn">Share</button>`;
const SHARE_NOTE_HTML = `<p class="sub share-note" data-testid="share-note" role="status"></p>`;

/** Briefing before a mission starts. */
export function showBriefing(root: HTMLElement, m: Mission, onGo: () => void): void {
  const n = MISSIONS.indexOf(m) + 1;
  const wrap = document.createElement('div');
  wrap.className = 'overlay';
  wrap.id = 'briefing';
  wrap.innerHTML = `<div class="card stamp-card" role="dialog" aria-modal="true" aria-labelledby="briefing-title">
    <div class="menu-label">${m.daily ? 'Daily mission' : `Mission ${n} of ${MISSIONS.length}`}</div>
    <div class="stamp" id="briefing-title">${stampTitle(m.title)}</div>
    <p class="goal" data-testid="briefing-goal">${goalText(m)}</p>
    <p class="sub">${esc(m.brief)}</p>
    <p class="sub hint-tip">Stuck? Tap the goal pill for a hint.</p>
    <div class="actions">${SHARE_HTML}<button class="btn primary" id="btn-briefing-go">Start</button></div>
    ${SHARE_NOTE_HTML}
  </div>`;
  wireShare(wrap, m);
  wrap.querySelector('#btn-briefing-go')!.addEventListener('click', () => {
    wrap.remove();
    onGo();
  });
  root.append(wrap);
}

/**
 * The goal pill shown while a mission is in play (or removed with `null`). With `onHint` it is a button:
 * tapping it asks for a hint. Its text is only ever the goal text.
 */
export function missionPill(text: string | null, onHint?: () => void): void {
  let el = document.getElementById('mission-pill') as HTMLButtonElement | null;
  if (text === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('button');
    el.type = 'button';
    el.id = 'mission-pill';
    el.className = 'coach mission-pill';
    document.body.append(el);
  }
  el.textContent = text;
  el.disabled = !onHint;
  el.title = onHint ? 'Tap for a hint' : '';
  el.classList.toggle('hintable', !!onHint);
  el.onclick = onHint ? () => onHint() : null;
}

export type MissionOutcome = 'complete' | 'failed' | 'solution';

/**
 * Result card. Complete → Next / Retry / Missions. Failed → Retry / Show solution / Missions.
 * Solution (after a replay) → Retry / Missions; it never counts as completing the mission.
 */
export function showMissionResult(
  root: HTMLElement,
  m: Mission,
  outcome: MissionOutcome,
  on: { next?(): void; retry(): void; solution?(): void; list(): void },
): void {
  const wrap = document.createElement('div');
  wrap.className = 'overlay';
  wrap.id = 'mission-result';
  const next = outcome === 'complete' && on.next;
  const solution = outcome === 'failed' && on.solution;
  const stamp = { complete: 'MISSION COMPLETE', failed: 'MISSION FAILED', solution: 'SOLUTION' }[
    outcome
  ];
  const sub = {
    complete: 'nicely done.',
    failed: 'Teal found the answer. Try another approach.',
    solution: 'that is the forced line. Now try it yourself.',
  }[outcome];
  wrap.innerHTML = `<div class="card stamp-card" role="dialog" aria-modal="true" aria-labelledby="result-title">
    <div class="stamp ${outcome === 'complete' ? 'p0' : outcome === 'failed' ? 'p1' : ''}" id="result-title">${stamp}</div>
    <p class="sub">${esc(m.title)}: ${sub}</p>
    <div class="actions">
      ${next ? '<button class="btn primary" id="btn-mission-next">Next</button>' : ''}
      <button class="btn${outcome === 'complete' ? '' : ' primary'}" id="btn-mission-retry">Retry</button>
      ${solution ? '<button class="btn" id="btn-mission-solution">Show solution</button>' : ''}
      <button class="btn" id="btn-mission-list">Missions</button>
      ${SHARE_HTML}
    </div>
    ${SHARE_NOTE_HTML}
  </div>`;
  wireShare(wrap, m);
  const bind = (id: string, f: () => void) =>
    wrap.querySelector(id)?.addEventListener('click', () => {
      wrap.remove();
      f();
    });
  if (next) bind('#btn-mission-next', next);
  if (solution) bind('#btn-mission-solution', solution);
  bind('#btn-mission-retry', on.retry);
  bind('#btn-mission-list', on.list);
  root.append(wrap);
}
