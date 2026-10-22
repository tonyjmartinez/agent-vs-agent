# Design notes

## Progress
- Phase 0 (scaffold and walking skeleton): done (PR #1).
- Phase 1 (rules engine): done (stacked on Phase 0).

## Decisions
- Phaser 4.2.1 renders WebGL in headless Chromium once launched with `--use-angle=swiftshader --enable-unsafe-swiftshader`
  (set in `playwright.config.ts`). The canvas screenshot is not blank, so no Canvas fallback is needed.
- Phaser game is created after fonts load and one animation frame, so the parent has a size (PLAN risk 4).
- `window.__AVA__` currently exposes only `ready` and `clicks`; Phase 2 grows it to the full PLAN 4.8 API.
- Prettier ignores PLAN.md, DESIGN_NOTES.md, CLAUDE.md so the plan isn't reformatted.
- Mobile project uses a 360x740 viewport (Pixel 7 / iPhone 14 variants come later).
- Bundle: Phaser makes the JS chunk ~1.4 MB (358 KB gzip); the Vite size warning is expected (PLAN risk 8).

## Phase 1 decisions (rules the spec left open)
- Reserve spies are interchangeable: `legalActions` lists deploys for the lowest-id reserve spy only (smaller branching
  factor for the AI); `applyAction` accepts any reserve spy.
- A bumped carrier always drops (step 3) before it can land anywhere, so a spy can only bank via bump if it was
  empty-handed and landed on intel in its own zone (step 4 pickup, then step 5 extract).
- If a carrier standing on an intel cell (it was bumped onto one) is bumped again, the drop would put two intel on one cell.
  The dropped intel stays at that cell (one intel) and the extra one respawns in step 6 via the spawn order.
- Actor pickup events use phase 0 (with arrival), not 2, so phases are non-decreasing in the event array.
- `maxPlies`: the game ends after the action that makes `ply + 1 >= maxPlies` (120 actions total).
- Spawn order: centre four, then the other cells by distance ring from the centre, row-major within a ring (not a true spiral).
- `hash()` excludes `ply` so equal positions collide (for transposition tables).
- Coverage: engine at 100% lines (`npm run coverage`). Property test: 2000 seeded random games hold all invariants.
- Mechanics note for Phase 5: in Duel geometry, "bump an enemy carrier into its zone" can never bank (carriers drop on bump).

## Later
