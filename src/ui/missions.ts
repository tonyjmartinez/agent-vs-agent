import { MISSIONS, goalText, type Mission } from '../missions';
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

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Mission list: one button per mission, completed ones ticked. */
export function showMissions(
  root: HTMLElement,
  on: { pick(m: Mission): void; back(): void },
): void {
  const done = completedMissions();
  const wrap = document.createElement('div');
  wrap.className = 'overlay menu-overlay';
  wrap.id = 'missions';
  wrap.innerHTML = `<div class="card menu missions" role="dialog" aria-modal="true" aria-labelledby="missions-title">
    <h2 id="missions-title" class="title">Missions</h2>
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
  wrap.querySelector('#btn-missions-back')!.addEventListener('click', () => {
    wrap.remove();
    on.back();
  });
  root.append(wrap);
}

/** Briefing before a mission starts. */
export function showBriefing(root: HTMLElement, m: Mission, onGo: () => void): void {
  const n = MISSIONS.indexOf(m) + 1;
  const wrap = document.createElement('div');
  wrap.className = 'overlay';
  wrap.id = 'briefing';
  wrap.innerHTML = `<div class="card stamp-card" role="dialog" aria-modal="true" aria-labelledby="briefing-title">
    <div class="menu-label">Mission ${n} of ${MISSIONS.length}</div>
    <div class="stamp" id="briefing-title">${esc(m.title.toUpperCase())}</div>
    <p class="goal" data-testid="briefing-goal">${goalText(m)}</p>
    <p class="sub">${esc(m.brief)}</p>
    <div class="actions"><button class="btn primary" id="btn-briefing-go">Start</button></div>
  </div>`;
  wrap.querySelector('#btn-briefing-go')!.addEventListener('click', () => {
    wrap.remove();
    onGo();
  });
  root.append(wrap);
}

/** The goal pill shown while a mission is in play (or removed with `null`). */
export function missionPill(text: string | null): void {
  let el = document.getElementById('mission-pill');
  if (text === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'mission-pill';
    el.className = 'coach mission-pill';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = text;
}

/** Result card: complete (Next / Missions) or failed (Retry / Missions). */
export function showMissionResult(
  root: HTMLElement,
  m: Mission,
  success: boolean,
  on: { next?(): void; retry(): void; list(): void },
): void {
  const wrap = document.createElement('div');
  wrap.className = 'overlay';
  wrap.id = 'mission-result';
  const next = success && on.next;
  wrap.innerHTML = `<div class="card stamp-card" role="dialog" aria-modal="true" aria-labelledby="result-title">
    <div class="stamp ${success ? 'p0' : 'p1'}" id="result-title">${success ? 'MISSION COMPLETE' : 'MISSION FAILED'}</div>
    <p class="sub">${esc(m.title)}: ${success ? 'nicely done.' : 'Teal found the answer. Try another approach.'}</p>
    <div class="actions">
      ${next ? '<button class="btn primary" id="btn-mission-next">Next</button>' : ''}
      <button class="btn${success ? '' : ' primary'}" id="btn-mission-retry">Retry</button>
      <button class="btn" id="btn-mission-list">Missions</button>
    </div>
  </div>`;
  const bind = (id: string, f: () => void) =>
    wrap.querySelector(id)?.addEventListener('click', () => {
      wrap.remove();
      f();
    });
  if (next) bind('#btn-mission-next', next);
  bind('#btn-mission-retry', on.retry);
  bind('#btn-mission-list', on.list);
  root.append(wrap);
}
