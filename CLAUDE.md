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
