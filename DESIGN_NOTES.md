# Design notes

Running log of decisions, sim results and playtest notes. Newest decisions appended per phase.

## Defaults (human hasn't answered PLAN §11)

- Headline mode: **Duel** (2 players × 2 spies). Title: **Agent vs Agent**. Hosting: **GitHub Pages**.

## Phase 0

- WebGL renders fine in headless Chromium 1194 with `--use-angle=swiftshader --enable-unsafe-swiftshader`; no Canvas fallback needed.
- Board sizing uses CSS container query units (`min(100cqw, 100cqh)`) on a `container-type: size` wrapper: the board is always the largest square that fits between the HUDs, in both orientations.
- Screenshots in `artifacts/screens/` are **committed** (not ignored) so they can be viewed on GitHub from a phone.
- Added a third e2e project, `iphone` (390×844 @3x, touch), alongside `desktop` and `mobile` (Pixel 7).

## Phase 1: rule decisions (each one is encoded in a test)

- **Intel never spawns on an extraction zone.** The spawn order is the 4 centre cells, then ring 2, then the non-zone cells of ring 3, walked clockwise and interleaved with each cell's 180° twin so neither side is favoured. Spawning on a zone would hand out free points. (`spawn order ... avoids extraction rows`)
- **A bumped carrier always drops first**, so a bump can never carry intel onto its owner's row. But an _empty-handed_ spy bumped onto dropped intel lying on its own row picks it up and extracts on the opponent's turn. If that's the winning point, **the opponent wins** even though it's your turn. "Current player wins ties" applies only when several players reach the target at once. (`a bumped spy can land on dropped intel ...`)
- **A carrier bumped onto intel** drops its own intel at the origin, lands empty-handed, and then picks up the intel it landed on (step 4). Net effect: it swaps folders.
- **maxPlies:** the game ends after exactly `maxPlies` actions (checked after the action that makes `ply + 1 == maxPlies`).
- **Deploy** may name any reserve spy of the mover; reserve spies are interchangeable. `legalActions` lists only the first reserve spy, to keep the branching factor honest.
- **Pass** emits a `passed` event (not in the plan's event list) so the UI can show it.
- **Event phases:** the actor's own pickup is phase 0 (it happens on arrival). `dropped`/`bumped`/`burned`/`bumpBlocked` are phase 1, bumped-spy pickups are phase 2, `extracted` is 3, `intelSpawned` is 4, `gameOver` is 5.
- **Compact state string** for `?state=`: `v1.<current>.<ply>.<s0>-<s1>.<spies in id order: rc | rc* | x>.<intel rc pairs>`. The start position is `v1.0.0.0-0.51,54,01,04.2233`.
- Coverage: 100% lines on `engine.ts`, `board.ts`, `rules.ts` and `serialize.ts`. A property test plays 2,000 random games and checks the invariants after every action.

## Phase 2: hotseat in the browser
- **The interaction state machine is pure** (`app/interaction.ts`, unit-tested), not inside the Phaser view. The view only reports `onTap(cell, viaTouch)` and `onHover(cell)` and draws highlights and previews. This is an adaptation of PLAN 4.5's `setInteraction`: it keeps Phaser thin and makes keyboard control trivial.
- **Confirm-on-touch is decided by the pointer that tapped**, not by `matchMedia('(pointer: coarse)')`. A touch tap previews and a second tap commits; a mouse click commits immediately, with hover giving the preview. Reason: Chromium's iPhone-size emulation (and some hybrid laptops) report `pointer: fine` even when touched. `?confirm=0` turns confirmation off.
- **Bug found by e2e:** Phaser caches the canvas bounds. When the HUD rendered after boot and pushed the board down, every touch landed one row too high. Fixed with a `ResizeObserver` and a `scale.refresh()` after each HUD render. This would have shipped broken on real phones.
- **Portrait layout:** HUD panels hug the board and spare height goes above and below the whole stack. Board height is `min(100vw - 32px, 100dvh - 290px)`.
- Undo pops back to the most recent earlier state where a human was to move. In hotseat that's one ply; vs a bot it's back to your previous turn. Undo also works from the game-over screen.
- A partial version of the motion spec (hop, squash, bump slide, burn spin, shake, pop text, confetti) went in now because it was cheap with the tween helper. Phase 6 polishes it.

## Later

(ideas not in the plan go here)
