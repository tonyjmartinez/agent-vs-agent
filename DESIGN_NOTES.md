# Design notes

## Progress
- Phase 0 (scaffold and walking skeleton): done (PR #1).
- Phase 1 (rules engine): done (stacked on Phase 0).
- Phase 2 (playable hotseat, plain shapes): done (stacked on Phase 1).
- Phase 3 (bots + sim + bot seats): done (stacked on Phase 2).
- Phase 4 (menus and onboarding): done (stacked on Phase 3).

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

## Phase 2 decisions
- Interaction is a pure reducer (`app/interaction.ts`): desktop = hover previews, click commits; touch (`confirm`) = first tap
  previews, same target again commits. Undo pops one ply (both seats human).
- `controller.act` races `view.play` against a 4s timeout so a stalled animation (hidden tab) never freezes the game, then
  always `sync`s to the authoritative state.
- Previews: ghost spy, ink arrows on bumped spies, red tint + X + arrow on burns, folder icon on drops.
- E2E: scripted 40-ply game through real taps compared move-for-move with the engine; `?state=` sets up win, deploy and burn cases.
- Not done yet from the plan's polish: bump-wave ripple, confetti, win stamp, selected-spy pulse, reduced-motion beyond 60ms tweens.

## Phase 3 results (sim, seed 1, `--swap`, 2 random opening plies)
| Matchup | Games | A win rate (95% CI) | Draws | Notes |
|---|---|---|---|---|
| easy vs random | 400 | 88.8% [85.3, 91.5] | 8.5% | easy: eps 0.2, softmax T 25 |
| medium vs easy | 200 | 99.0% [96.4, 99.7] | 1.0% | medium: depth 2 |
| hard vs medium | 200 | 84.0% [78.3, 88.4] | 16.0% | 0 losses; hard: depth<=6, 30k nodes, 400ms |
| hard vs hard (5000 nodes) | 400 | seat 0: 26.0%, seat 1: 20.8% | 53.3% | median 120 plies (hits maxPlies) |

Hard move time (Node, 200-game run): mean 120ms, p95 230ms (max 459ms in one outlier while two sims shared the CPU).

Diagnosis log:
- First eval (PLAN 4.4 weights only) gave 82% draws for hard vs medium: bots had no incentive to approach intel and
  fell into a 2-move cycle (each steals the intel back). Fixes: `W.seek` (-15 per cell to nearest intel for empty-handed
  spies) and a **repetition penalty** (`REPEAT_PENALTY` 60 per earlier occurrence of the position a root move creates).
- Easy's softmax temperature must be small relative to eval deltas (T 150 was near-uniform and lost to random).
- `Bot.reset()` clears repetition memory and re-seeds (called on undo/rematch).

**Phase 5 flags (balance, not bot bugs):** at equal strength games are drawish and long: hard vs hard draws 53% and the
median game is the 120-ply cap (target: draws < 8%, median 24-60 plies); drops per game are ~36 (constant stealing).
Seat 0 beats seat 1 about 26% to 21%. Knobs to try first per PLAN 9: lower `intelToWin`, raise `intelOnBoard`,
`firstMoveNoBump`; also consider a rule that stops the immediate steal-back loop.

## Phase 4 decisions
- Menu choices navigate (`location.search = ...`) instead of re-mounting in place: a clean Phaser boot and no teardown bugs.
  Test/tuning params (`test, speed, seed, confirm, coach`) are carried across menu and game URLs.
- Coach marks rewrite their DOM only when the stage changes: hover-driven refreshes were swallowing clicks on the Dismiss button (found by e2e).
- Undo/Rematch while a bot is thinking bump a generation counter so the bot's stale move is discarded.
- Rules card is a scrolling dialog with a sticky "Got it"; diagrams are inline SVG generated in `ui/diagrams.ts`.
- Still plain (Phase 6): art, sound, "Quit to menu" confirmation, game-over "Menu" button.

## Later
