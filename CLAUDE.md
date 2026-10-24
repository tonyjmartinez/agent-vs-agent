# Agent vs Agent — agent notes

Spec: `PLAN.md` (source of truth). Decisions + sim tables: `DESIGN_NOTES.md`.

## Commands

- `npm run typecheck` · `npm run lint` · `npm test` (Vitest, engine/ai)
- `npm run sim -- --games 400 --p0 hard --p1 hard --seed 1 [--swap] [--rules '{"intelToWin":2}']`
- `npm run e2e` (Playwright; builds + previews on :4173; screenshots → `artifacts/screens/`)
- `npm run build` · `npm run dev -- --host`

## Rules

- `src/engine` and `src/ai` are PURE: no Phaser, DOM, `Math.random`, `Date`. ESLint enforces it.
- Write rule tests before rule code. Ambiguity → decide, log in DESIGN_NOTES.md, encode in a test.
- Phaser 4 (not 3!). Read `node_modules/phaser/skills/<topic>/SKILL.md` before Phaser code; grep `node_modules/phaser/types/phaser.d.ts` when a type fails.
- Always `view.sync(state)` after `view.play(events)`; sprites are never the truth.
- After visual changes regenerate screenshots and look at them (desktop + phone).
- Container: `@playwright/test@1.56.1` matches preinstalled Chromium. Never run `playwright install` here.

## Handoff (living memory: read first, update last)

The hourly automation starts a fresh agent each run. Keep this section and `DESIGN_NOTES.md` current.

- **Work from `main`.** Branch `claude/night-<slug>` from `origin/main`, open a PR to `main`, and merge it yourself once
  every check is green (the owner asked for self-merging). Don't build on the old `claude/phase-*` branches or PRs #1-#5:
  they are a separate, superseded rebuild.
- **Checks before any merge:** `npm run typecheck && npm run lint && npm test && npm run build && npm run e2e`. Look at
  the new or changed screenshots in `artifacts/screens/` (phone and desktop). Commit only screenshots your change
  affects; restore the rest (`git checkout -- artifacts/screens/<file>`) so diffs stay focused.
- **Latest iterations:** Missions (tactical puzzles), then Show solution (mission replay). See "Iteration: Missions" and
  "Iteration: Show solution" in `DESIGN_NOTES.md`. Add new missions with `npx tsx scripts/missions.ts`;
  `src/missions.test.ts` must prove each one (and its replay).
- **E2E gotcha:** the Cloudflare check `Workers Builds: agent-vs-agent` fails on every branch (not caused by code); the GitHub
  Actions `checks` job is the real gate. Auto-playing e2e tests assert zero console errors, so any browser intervention
  warning (like the vibrate one) shows up there.
- **Next ideas (pick one per run):** daily mission, 3-move missions, a match stats debrief on the game-over card, the
  `DESIGN_NOTES.md` "Later" list.
