# Agent vs Agent

A small boop-like spy board game for desktop and mobile browsers. `PLAN.md` is the source of truth: rules spec,
stack, architecture, and a phased build plan with "Done when" checklists.

## How to work here

1. Read `PLAN.md` sections 1–5 before writing code, then work one phase of section 7 at a time.
2. Don't start a phase until the previous one's "Done when" list passes. Note progress in `DESIGN_NOTES.md`
   (decisions, sim results, which phase is done).
3. One phase (or a smaller slice of one) per PR. Put the phase's "Done when" checklist in the PR body, ticked.

## Commands

Phase 0 creates the scaffold. After that, run before every PR:

```sh
npm ci
npm run typecheck && npm test && npm run build   # names per PLAN.md section 4.1
```

## Gotchas (from PLAN.md)

- Phaser 4, not 3: read `node_modules/phaser/skills/*/SKILL.md` before writing Phaser code.
- The rules engine is pure TS with no Phaser imports; Vitest covers every clarification in section 2.2.
- Pin `@playwright/test@1.56.1` so it finds the preinstalled Chromium. Never run `playwright install`.
- Look at Playwright screenshots (desktop 1440px and phone 360px) before calling UI work done.

## Handoff (living memory: read this first, update it last)

Each run is a fresh agent. Before stopping, update this section and `DESIGN_NOTES.md` so the next run can continue.

- **Status:** Phases 0-4 are done and open for review, unmerged, as stacked PRs (#1 scaffold, #2 engine, #3 hotseat,
  #4 bots, then Phase 4 menus). Next: Phase 5 (balance: the sim shows long, drawish games, see DESIGN_NOTES.md; also
  move bots to a Web Worker), then Phase 6 (art/juice), Phase 7 (ship).
- **Menus:** a bare URL (or `?menu=1`) shows the start menu (`src/ui/menu.ts`); picking a mode reloads with
  `?play=1&p1=bot:<level>` (`app/navigation.ts`). Any of `test/state/p0/p1/play` skips the menu. Last mode and
  "coach marks done" live in localStorage (`app/storage.ts`, never throws). Coach marks are off under `?test=1` unless `?coach=1`.
  In-game Menu button opens the pause dialog (resume/restart/rules/quit). Rules card with SVG diagrams: `ui/rulesCard.ts`, `ui/diagrams.ts`.
- **Bots/sim** (`src/ai/`): `makeBot(level, seed, budget?)` for random/easy/medium/hard (`choose`, `reset`);
  `evaluate.ts` weights in `W`; `search.ts` alpha-beta + TT; medium/hard penalise repeated positions (`REPEAT_PENALTY`).
  `npm run sim -- --games N --p0 hard --p1 medium --swap [--nodes 5000] [--rules '{...}']` (use `--nodes` for quick,
  clock-independent tuning runs). URL seats: `?p0=human&p1=bot:medium`.
- **App layout:** `src/app/` (controller = single source of truth, `interaction.ts` pure select/target/commit
  reducer, config/URL params, test hooks `window.__AVA__`), `src/view/` (Phaser only: `BoardScene`, `BoardView`
  interface), `src/ui/` (DOM HUD, game-over overlay, styles). URL params: `?test=1&speed=0&state=<compact>&confirm=0|1`.
- **E2E conventions:** `tests/helpers.ts` (`load`, `commit`, `tapCell`) drives real taps/clicks; use `?state=` to set
  up positions (format in `engine/serialize.ts`); screenshots go to `artifacts/screens/ava-<project>-<name>.png`: open them.
- **Engine API** (`src/engine/`): `createGame`, `legalActions`, `applyAction` (immutable, throws on illegal),
  `previewAction`, `hash`, `toJSON/fromJSON`, `toCompact/fromCompact`. Test helper `board()`/`render()` in `testing.ts`.
- **Checks that must stay green:** `npm run typecheck && npm run lint && npm test && npm run build && npm run e2e`;
  `npm run coverage` should keep the engine at 100% lines.
- **Stacked PRs:** if the previous phase's PR is still open, branch from it and open the new PR against it. Never merge.
- **Tooling quirks:** Prettier ignores PLAN.md/DESIGN_NOTES.md/CLAUDE.md. Don't run `prettier -w .` over the plan.
  Playwright needs the swiftshader flags (already in `playwright.config.ts`).
