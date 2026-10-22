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

- **Status:** Phase 0 done (PR #1, open). Phase 1 (rules engine) done on `claude/phase-1-rules-engine`
  (stacked PR on the Phase 0 branch). Next: Phase 2 (playable hotseat: controller, BoardView, sprites, input).
- **Engine API** (`src/engine/`): `createGame`, `legalActions`, `applyAction` (immutable, throws on illegal),
  `previewAction`, `hash`, `toJSON/fromJSON`, `toCompact/fromCompact`. Test helper `board()`/`render()` in `testing.ts`.
- **Checks that must stay green:** `npm run typecheck && npm run lint && npm test && npm run build && npm run e2e`;
  `npm run coverage` should keep the engine at 100% lines.
- **Stacked PRs:** if the previous phase's PR is still open, branch from it and open the new PR against it. Never merge.
- **Tooling quirks:** Prettier ignores PLAN.md/DESIGN_NOTES.md/CLAUDE.md. Don't run `prettier -w .` over the plan.
  Playwright needs the swiftshader flags (already in `playwright.config.ts`).
