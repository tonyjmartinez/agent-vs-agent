# Design notes

Running log of decisions, sim results and playtest notes. Newest decisions appended per phase.

## Defaults (human hasn't answered PLAN §11)

- Headline mode: **Duel** (2 players × 2 spies). Title: **Agent vs Agent**. Hosting: **Cloudflare Pages** (switched from GitHub Pages; see below).

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

## Mobile layout pass (requested mid-Phase 3)

- The layout sweep now covers 13 sizes: 320×568, 360×640, 375×667, 360×780, 390×844, 412×915, 430×932, landscape 667×375 / 844×390 / 932×430, tablet 768×1024 and 1024×768, and desktop 1440×900. Each one checks that the board is fully visible, no panel or **panel child** overlaps it, buttons are ≥44px, and there's no horizontal scroll. Screenshots: `artifacts/screens/layout-*.png`.
- HUD panels now have a **fixed height**: name and score on row 1, status and reserve tray on a 44px row 2. The portrait stack (top panel, board, bottom panel and buttons) is centred as a whole, and `--hud-h` reserves exactly that height. The board never jumps when a reserve spy appears.
- The Phaser world margin went from 72 → 36 logical px (cell 156 → 168). Every board gets about 8% bigger cells, and on a 320px phone cells are now about 45 CSS px, which clears the touch minimum. Burned spies still fly into the margin and fade.
- Tall phones (≥820px high, portrait) get a roomier HUD: bigger type and 52px buttons. On a 430×932 phone there's still spare height. That's inherent, because the square board is width-limited.

## Phase 3: bots (in progress, blocked on a design question)

- **Bots:** random; easy (1-ply greedy, ε=0.25, softmax T=40); medium (alpha-beta depth 2); hard (iterative deepening to depth 6 with a TT and tactical move ordering).
- **Deterministic budget:** hard's budget is a **node count** (40k default), not wall time, so sims reproduce exactly. `src/ai` never reads a clock. The app's Web Worker adds a 600ms safety cap through an injected `now()`. Main-thread fallback: 400ms.
- **Search bugs found and fixed:**
  1. Root tie-breaking picked among cut-off moves whose upper bound equalled the best score. Fixed with a root window just below alpha.
  2. A win-distance bonus that depended on search depth made TT values path-dependent. Removed it; `evaluate` already uses the absolute game ply.
  3. The root position was stored in the TT. Now it's tracked separately.

  A unit test now checks alpha-beta + TT against brute-force minimax at depth 3.

- **Repetition contempt:** search bots get the game's position hashes and score a revisited position at -60 for themselves. This was added after a medium-vs-medium trace looped forever: grab → bumped and dropped → re-grab and bump back → ...
- **AI worker:** `?worker&inline`, so it survives the single-file build. If the worker errors or stays silent for 4s, the client falls back to main-thread search. It does fail from `file://`, and before this fix the game hung.

### Skill gradient (Phase 3 gate), default rules

| matchup (`--swap`)                  | games | A win              | draws | median plies | drops/game |
| ----------------------------------- | ----- | ------------------ | ----- | ------------ | ---------- |
| easy vs random                      | 200   | **92.5%** ✅ (≥85) | 9     | 120          | 4.8        |
| medium vs easy                      | 200   | **99.5%** ✅ (≥70) | 1     | 44           | –          |
| hard vs medium (after search fixes) | 60    | **11.7%** ❌ (≥65) | 53    | 120          | 46.5       |

Hard is **not weaker**. It beats medium 7:1 in decisive games. But strong play draws: medium can't score against hard, and hard can't score either.

### Why strong play stalls (rules diagnosis)

A carrier in the middle needs 2–3 moves to get home. Any defender within reach can arrive next to it and knock the intel loose. The carrier is then adjacent to the dropped folder, so it re-grabs it next turn, and that arrival bumps the defender away. The defender returns and the cycle repeats with no progress. Weak bots don't defend this way, which is why weak games are decisive.

### Knob sweep: hard vs hard, 40 games, node budget 15k (before any rules change)

| rules              | draws | P0 win | median plies | burns | drops | extractions |
| ------------------ | ----- | ------ | ------------ | ----- | ----- | ----------- |
| baseline           | 34    | 12.5%  | 120          | 4.4   | 37.4  | 1.5         |
| firstMoveNoBump    | 34    | 12.5%  | 120          | 4.4   | 37.4  | 1.5         |
| intelToWin 2       | 31    | 15.0%  | 120          | 4.8   | 35.5  | 1.2         |
| intelOnBoard 3     | 36    | 7.5%   | 120          | 3.9   | 71.2  | 1.8         |
| orthogonal         | 38    | 0.0%   | 120          | 5.5   | 18.4  | 0.6         |
| bumpOwnSpies false | 35    | 2.5%   | 120          | 2.1   | 63.5  | 1.2         |

**None of the plan's knobs fix it.** Per instructions, this goes to the human.

### Candidate rule changes tested (experimental flags, default off, each with tests)

| rules                                 | matchup                    | draws | P0 / A win          | median plies | drops | notes                                                      |
| ------------------------------------- | -------------------------- | ----- | ------------------- | ------------ | ----- | ---------------------------------------------------------- |
| 2-row extraction zones                | hard vs medium (swap)      | 34/40 | A 15%               | 120          | 49.4  | still stalls                                               |
| `dropOnBump: false` (only burns drop) | hard vs hard               | 0/40  | **P0 85%**          | 21           | 0     | becomes a pure race; first player dominates; steals vanish |
| `dropOnBump: false`                   | hard vs medium (swap)      | 0/40  | A 52.5% (P0 82.5%)  | 25           | 0.15  | no skill gradient, big seat bias                           |
| 2-row zones + `dropOnBump: false`     | hard vs hard               | 0/40  | P0 100%             | 13           | 0     | trivial                                                    |
| `fumble`                              | medium vs easy (swap), 100 | 0     | A **100%**          | 37           | 2.7   | decisive                                                   |
| `fumble`                              | hard vs medium (swap), 40  | 13/40 | A **65%** (26–1) ✅ | 120          | 22.0  | meets the gradient gate; P0 45%                            |
| `fumble`                              | hard vs hard, 40           | 30/40 | P0 15% (6–4)        | 120          | 24.1  | still stalls between equals                                |

**Status:** resolved below. Sprint + fumble ship as the default.

## Rules decision: sprint + fumble ship as the Duel default

The human said "keep iterating", so I resolved the Phase 3 blocker myself. Two candidate fixes were tested and rejected.

- **Escort** (an escorted carrier keeps its intel when shoved): hard vs medium 32/40 draws, A 17.5%. No help.
- **Two-row zones**: no help (above).

A hard-vs-hard trace showed the real stall. Games aren't dead; both sides usually score, then deadlock at **match point**. A carrier moves at the same speed as its chasers, so one defender can always arrive next to it. The fix has to give the carrier **tempo**.

**Sprint** (new): a carrier may dash 2 squares in a straight line over an empty square, bumping only where it lands. **Fumble** (from before): your team can't re-grab intel it just dropped until after its next turn. Neither works alone. Together:

| matchup (`--swap` unless mirror) | rules                        | games | A win            | draws | median plies | burns | drops | extractions |
| -------------------------------- | ---------------------------- | ----- | ---------------- | ----- | ------------ | ----- | ----- | ----------- |
| hard vs medium                   | base                         | 60    | 11.7%            | 53    | 120          | –     | 46.5  | –           |
| hard vs medium                   | sprint                       | 40    | 30.0%            | 28    | 120          | 2.0   | 57.2  | 3.4         |
| hard vs medium                   | escort + fumble              | 40    | 65.0%            | 14    | 120          | 4.3   | 23.9  | 2.2         |
| hard vs medium                   | **sprint + fumble**          | 40    | **85.0%**        | 6     | 62           | 3.5   | 14.4  | 3.4         |
| hard vs medium                   | **sprint + fumble** (seed 2) | 80    | **88.8%** (71–1) | 8     | 70           | 3.7   | 15.0  | 3.6         |
| medium vs easy                   | **sprint + fumble**          | 200   | **100%**         | 0     | 27           | 0.9   | 1.0   | 3.2         |
| easy vs random                   | **sprint + fumble**          | 200   | **98.0%**        | 3     | 81           | 7.2   | 2.4   | 3.0         |
| hard vs hard                     | sprint                       | 40    | P0 0%            | 40    | 120          | 3.1   | 58.9  | 1.9         |
| hard vs hard                     | **sprint + fumble**          | 40    | P0 5%            | 37    | 120          | 5.6   | 23.8  | 1.5         |

**Seat balance.** The medium mirror is nearly deterministic: identical bots replay one opening, giving P0 84% on the new rules and 185/200 draws on the base. So it isn't a fair seat test. The noisy easy-vs-easy mirror is (400 games, seed 5):

| easy vs easy        | P0 win    | draws  | median plies | burns | drops | extractions | comebacks |
| ------------------- | --------- | ------ | ------------ | ----- | ----- | ----------- | --------- |
| base rules          | 40.5%     | 80     | 120          | 8.4   | 6.2   | 3.2         | 23.4%     |
| **sprint + fumble** | **48.8%** | **34** | **79**       | 6.4   | 2.9   | 4.0         | **33.3%** |

**Choice.** Sprint and fumble are now on in `duelRules()`. They clear every skill-gradient gate (85/70/65 → 98/100/89), seat balance is inside 45–55%, and games are far more decisive. Both rules are one sentence on the rules card and visible on the board: dash targets get rings, and a fumbled folder gets a dashed ring and slash in the fumbling team's colour.

**Still open:**

- **Hard vs hard still draws (37/40).** Two depth-6 bots defend perfectly at match point. This only affects bot-vs-bot mirrors; it's logged rather than chased.
- Easy-mirror burns (6.4) and median length (79 plies) sit a little above the PLAN §9 ranges.
- Engine fixtures still test the base mechanics, with flags off. A dedicated test pins the shipped defaults.

**Engine bug found by the property test once sprint was on:** a double extraction emitted extract, spawn, extract, spawn, which breaks phase grouping. Spawns are now emitted after all extractions (tested).

**URL switches for phone A/B:** `?rules=escort,fumble,firstMoveNoBump` (on-switches only) and `?win=N`.

## Phase 6 (art and juice), first pass

- **Art** lives in `src/ui/art.ts` as SVG strings: spies (bean body, cream face strip, shades, fedora), the intel folder, and spy heads. They're rasterised to canvases at 2× before Phaser boots and registered with `textures.addCanvas`, so there's no loader and no network.
  - The same strings feed the HUD chips, reserve buttons, menu logo and favicon.
  - SVGs contain no text, because an SVG drawn through `<img>` can't use page web fonts. The "TOP SECRET" stamp is a glyph.
- **Colour-blind cue:** Red wears a round-brim fedora; Teal wears a pointed trilby and a striped scarf. `*-greyscale.png` is regenerated by e2e.
- **Motion:**
  - The selected spy lifts 10px with a pulsing spotlight under its feet.
  - A carried folder bobs.
  - Dash targets use rings instead of dots.
  - A newly banked intel pip pops in the HUD.
- **Sound** (`src/ui/sound.ts`): synthesized WebAudio blips for move, bump, drop, burn and extract.
  - There's a mute button in the HUD, persisted with try/catch storage.
  - The AudioContext is created on the first pointerup (iOS rule).
- **Scale:** spies are drawn at 0.6 (about 72×84 logical px in a 168 cell). Hats overlap the row above slightly, and depth sorting by row keeps that tidy.
- `speed=0` also disables CSS animation, so overlay screenshots are deterministic.
- **Phase 6 still to do:** keyboard controls, extraction-row glyphs, the perf/long-task check, and more screenshot states (mid-game, extraction moment).

## Iteration: phone feel and clarity

- **Last-move trail:** a tinted tile where the last move landed and a dashed outline where it started, in the mover's colour. It matters most for following bot moves on a phone. The controller keeps an index-aligned `moves[]` beside `history[]`, so undo rewinds it too.
- **Home-row labels:** "RED HQ" / "TEAL HQ" are drawn faintly into each extraction row.
- **Haptics:** `navigator.vibrate` on extract, burn and drop (Android). It shares the sound mute and is a no-op on iOS Safari.
- **Add to Home Screen:** `public/manifest.webmanifest`, `apple-touch-icon.png`, and 192/512 icons rendered from the spy SVG by `scripts/icons.ts`. Display is standalone. The single-file artifact build strips these links because it has no sibling files.
- **Keyboard (PLAN 4.6):** arrows move a cursor and preview legal targets, Enter/Space select or commit, Tab/Shift+Tab cycle your spies, Esc cancels, U undoes. When a button has focus, Tab, Enter and Space keep their normal meaning, so keyboard navigation of the HUD still works.
- **Rejected: sprint-aware bot evaluation** (carrier distance counted as ⌈d/2⌉ when sprint is on). Hard vs medium, 80 games, seed 2: 83.8% (67–0, 13 draws, median 95 plies) against 88.8% (71–1, 8 draws, median 70) before. That's not better, and games got longer. Both bots share the evaluation, so it isn't a clean A/B. Reverted.

## Hosting: GitHub Pages → Cloudflare Pages

- The GitHub user site `tonyjmartinez.github.io` still has `tonyjmartinez.com` as its custom domain, so any project Pages site redirects to `tonyjmartinez.com/<repo>/`. That domain is served by **Firebase Hosting**, where the portfolio SPA answers every path. A GitHub project site would have been unreachable.
- Deploys are configured in the repo through **`wrangler.jsonc`**: a static-assets Worker serving `dist/`. Cloudflare's "Import a repository" reads it and deploys on push; `npm run deploy` does the same locally. GitHub Actions is checks-only (`ci.yml`). A wrangler-from-Actions version with secrets was tried first, but the owner preferred the simpler setup. `public/_headers` also works with Workers static assets.
- `public/_headers` gives hashed `/assets/*` an immutable cache. `.nvmrc` pins Node 22 in case Cloudflare's Git integration is used instead.
- The old `gh-pages` branch is no longer updated. It was left in place; deleting it is the owner's call.

## Iteration: Missions (tactical puzzles)

- **What:** 13 hand-curated puzzles, opened from **Missions** on the start menu or `?mission=<id>`. You play Red against a
  defender. Each mission has a goal (`win`, `extract` = bank one intel, `burn` = put a Teal agent in reserve) and a budget
  of 1 or 2 Red moves. Progress is stored in `localStorage` (`ava.missions.v1`), and completed missions get a tick.
- **Solver** (`src/ai/solve.ts`, pure): AND-OR search over Red moves and all Teal replies, memoised on
  `hash + ply + moves left`. The goal is judged only right after a Red move. If Teal wins the game in between, that
  refutes the line. Depth ≤ 2 Red moves (3 plies) runs in milliseconds.
- **The defender is the solver, not a bot.** Teal plays a reply that leaves Red no forced win if one exists, so a
  wrong first move is always punished. A hard bot plays its own evaluation and could let a wrong line succeed.
- **Positions are mined, then curated:** `npx tsx scripts/missions.ts --games 400 --seed 2` plays seeded self-play
  (Red easy/medium, Teal medium) and prints Red-to-move positions where a goal is forced within N moves, impossible
  in N−1, and solved by at most a third of first moves. Positions with fumble locks are skipped, because the compact
  state string doesn't carry locks. Picks were made for variety: edge burns, sprint home, carrier strike, evading a
  defender, knocking a carrier loose, a double burn, wins in 2.
- **Proof in tests:** `src/missions.test.ts` checks every mission: round-trips and is legal; forced within budget; not
  forced in fewer; at most 1/3 of first moves work; and the defender refutes **every** wrong first move and **no**
  right one. `e2e/missions.spec.ts` plays all 13 to completion through real clicks against the in-browser defender
  (desktop). On touch it covers a 1-move and a 2-move mission, a refuted wrong move → Failed → Retry, pause → Restart,
  progress after reload, and a 7-size check that the goal pill never covers the board.
- **Controller:** new `stop()` freezes the board (no input, no bot move) once a mission is decided. `start()` clears it.
  Quit-to-menu also stops the game behind the menu.
- **Known compromise:** the goal pill is pinned to the top (portrait) or the right column (landscape). On a 320px phone
  it sits over Teal's score pips, and on a short landscape phone over the top of your panel. It never covers the
  board and ignores pointer events.
- **Ideas:** a daily mission (seeded by date), 3-move missions (needs a faster solver or a node cap), missions with
  `?rules=` variants.

## Iteration: Show solution (mission replay)

- **What:** the MISSION FAILED card has **Show solution**. It restarts the position (no briefing) and replays the forced
  line with both seats automated: Red plays `solutions(...)[0]`, Teal plays `defend(...)`. It ends on a **SOLUTION** card
  (Retry / Missions) and is **never credited**: only a real solve calls `markCompleted`. `?mission=<id>&solution=1` starts
  the replay directly (used by the e2e sweep and handy for sharing a link to a solution).
- **One pure entry point:** `Solver.demoStep(s, left)`, with `left` = budget minus Red moves already made (the same number
  on both sides' turns). The replay seats are bots whose chooser is that function, so pacing (450 ms thinking beat) and the
  animation path are the normal ones. `src/missions.test.ts` replays all 13 in Vitest against the defender.
- **Input is locked** during the replay for free: neither seat is human. The pill reads "Solution · watch the line".
- **Bug found by e2e:** an auto-playing game with no user gesture (this replay from a URL, or bot-vs-bot) made
  `navigator.vibrate` log a Chrome intervention error on every drop or burn. `mayVibrate()` in `ui/sound.ts` now skips
  haptics until `navigator.userActivation.hasBeenActive` (unit-tested). The e2e sweep asserts zero console errors.
- **HUD fix:** a frozen game (decided mission) now shows no active turn (`HudView.stopped`); it used to keep saying
  "Agent Teal's move" behind the result card.
- **Known wart:** during a replay both panels read "Agent Red / Hard" and "Agent Teal / Hard" (they really are bot seats).
- **Ideas left:** daily mission, 3-move missions, a post-game stats debrief.

## Iteration: Match stats debrief

- **What:** the game-over card shows a per-player table: **Turns** (actions taken), **Burns** (enemy spies you shoved off),
  **Steals** (enemy carriers you bumped into dropping their intel), **Banked** (intel extracted). The strict leader of a
  row is highlighted; tied rows (including 0 vs 0) aren't.
- **Pure core:** `src/engine/stats.ts`: `emptyStats(n)` and `addAction(stats, before, events)` (immutable). Spy owners come
  from the state *before* the action, because events carry spy ids only. Rules: bumping your own spy off is **not** a burn
  (it still counts as that player's *burned*); dropping your own carrier isn't a steal; an extraction is credited to the spy's
  **owner**, not the mover (a bumped spy can land on intel in its own zone and bank for its owner).
- **Controller:** `statsLog` is index-aligned with `history`, so Undo rewinds the stats and `start()` resets them.
  `controller.stats` is what `main.ts` hands to `showGameOver`.
- **Proof:** unit tests for each rule above, plus a property test over 300 seeded random games: Σturns = final ply,
  Σbanked = Σscores (and per player), Σburned = burned events, Σburns = burned events minus self-burns, Σsteals ≤ drops.
  E2E: a scripted burn → Teal move → winning bank checks the card cell by cell; undo returns the stats to exactly the
  earlier snapshot (one ply per undo in hotseat); a rematch starts at zero; a medium-vs-easy game's table matches
  `controller.stats` and the final score; the card fits 6 viewport sizes with the buttons on screen.
- **Test gotcha:** while the game-over card is up it covers the HUD Undo button, so e2e triggers the real handler with a
  programmatic click (`#btn-undo`.click()). Calling `controller.undo()` directly skips the handler that removes the card and
  leaves an overlay swallowing taps. Users can't undo from the card at all (Rematch / Menu only).
- **Ideas left:** a "turns" label next to the headline ("2 turns" there means rounds, the table counts actions);
  longest carry / sprints used / closest call; sharing the debrief as an image.

## Iteration: Daily mission

- **What:** Missions list → **Daily mission** card (date, goal, ✓ when done) plus a **Streak: N days** line. One puzzle per
  UTC date, the same for everyone, from a generated pool of 52 beyond the 13 curated missions.
  `?mission=daily` opens it directly; `&day=YYYY-MM-DD` pins the date (tests; ignored unless a real calendar date).
- **Pool:** `src/dailyPool.ts` is **generated**: `npx tsx scripts/dailyPool.ts` (700 games, seed 3, ~80 s). It mines with the
  shared `scripts/mine.ts` (also used by `scripts/missions.ts`), skips curated missions, keeps one entry per position,
  fills per goal/budget quotas (burn2 16, extract2 15, win2 7, burn1 6, extract1 4, win1 4) with the fewest working first
  moves first, and allows at most three entries per forcing move so the pool isn't one idea. Regenerating changes the file.
- **Day → puzzle (`src/daily.ts`):** `index = (dayNumber × step) mod N`, `step` = smallest integer ≥ 7 coprime with N. That is a
  bijection: any N consecutive days show every entry exactly once, consecutive days never repeat. (First attempt had the
  same *position* in the pool under two goals, so a 52-day window showed only 49 distinct boards; the test caught it and the
  generator now keeps one entry per position.)
- **Streak:** consecutive solved days counted back from today, or from yesterday if today isn't done, so it doesn't read 0
  the morning after. Stored as a day list in `ava.daily.v1` (last 120, validated on read), separate from `ava.missions.v1`
  so dailies never count toward "N of 13". Watching "Show solution" never credits a day.
- **UI notes:** a daily has no "Next" button and its briefing says "Daily mission". The date in the stamp is wrapped in a
  `nowrap` span (it used to break as "2026-05-" / "02" at 320 px; e2e asserts one client rect at 4 sizes).
- **Proof:** every pool entry gets the full treatment in `src/daily.test.ts` (round-trip, forced, tight, ≤ ⅓ first moves
  work, replay reaches the goal). Date and streak logic is tested across month, year and leap-day boundaries and for
  invalid dates. E2E on a pinned date: solve → credited; streak 1 → 2 → gap → 0 → 1 and back; fail → solution → not credited →
  real solve credited; different dates give different puzzles; 52 consecutive days of `?solution=1` all reach their goal.
- **Known limits:** the clock is UTC, so the puzzle changes at 00:00 UTC for everyone (not local midnight). Midnight passing
  while the list is open isn't noticed until it is reopened. The pool cycles every 52 days.
- **Ideas left:** more debrief stats, 3-move missions (needs a faster solver or a node cap), share-the-puzzle link text.

## Later

(ideas not in the plan go here)

- A no-repeat rule (positional superko) if humans also fall into steal loops.
- Hot-reload snapshot for the artifact build, so an open game survives a republish.

## Iteration: Share a puzzle

- `src/share.ts` (pure, unit-tested): `missionLink` (curated: `?mission=<id>`; daily: `?mission=daily&day=<date>` so an old link
  stays the same puzzle), `shareText` (goal + link, never the state or brief), `shareMission` (native share sheet, else
  clipboard; a dismissed sheet is success; nothing available → "Could not share").
- Share button on the briefing and every result card; status line `data-testid="share-note"` (role=status).
- E2E (`e2e/share.spec.ts`) stubs `navigator.share`/`clipboard`, checks the exact text, that the link reopens the same
  position, the daily date pin, and 320x568 / 667x375 fit.

## Iteration: Shoves stat

- `PlayerStats.shoves`: enemy spies bumped by the mover (`bumped` events; shoving your own spy does not count). A burn is
  its own event, so a pure burn is a burn, not a shove. Invariant-tested over random games (`stats.test.ts`).
- The extra debrief row overflowed 375px-high landscape screens, so `styles.css` tightens the stats table under
  `max-height: 460px`; the e2e viewport sweep now asserts the whole card (stamp to buttons) is on screen.

## Iteration: 3-move missions

- `scripts/mine.ts` takes a move-budget list (`--moves 3` in `scripts/missions.ts`). A 3-move search is fast per position but
  candidates are rare (17 in 120 games, mostly `extract`; no `win` yet).
- Added `long-way-round` (extract), `cornered` (burn), `reserve-play` (burn) at the end of `MISSIONS` (order is by move budget,
  enforced by a test). `src/missions.test.ts` proves each exactly like the others (forced in 3, not in 2, ≤ a third of first
  moves work, defender refutes every wrong first move, replay reaches the goal).
- The `?solution=1` replay can finish before the budget when the replayed defender doesn't fight at full strength
  (`cornered` ends after 2 Red moves), so the e2e ply check is "odd and ≤ 2·moves−1" (exactly 1 for 1-move missions).
- The daily pool stays 1-2 moves: 3-move entries would need re-proving the pool and a different day→puzzle cycle length.

## Iteration: Mission hints

- The goal pill is now a `<button>` (text unchanged, so goal text stays readable; a `?` badge is CSS-only). Tapping it selects the
  piece that starts a forcing line (`src/hint.ts`: `hintSelection`, spy id or `'reserve'`), never the destination. The player
  still has to find the target square from the highlighted dots.
- Out of reach (a wrong move was already refuted): the pill reads "Out of reach · Menu → Restart" until the next refresh.
- No hint during the `?solution=1` replay (the pill is disabled). Hints do not affect credit: a hinted solve still completes the
  mission (decision: hints teach; there is no scoring to protect).
- Tests: `src/hint.test.ts` (every mission: the selected piece has a forcing move among its legal moves, the line can be followed
  through the defender's replies, null after a refuted wrong move); `e2e/hint.spec.ts` solves all 16 missions by hints alone.

## Iteration: Mission pill layout

- Fixed the goal pill covering HUD panels. Portrait: `body.in-mission` (toggled by `missionPill`) reserves a 62px band above the
  HUD and a taller `--hud-h`, so the pill has its own row and the board only shrinks on short phones (320x568: 222px board).
  Landscape: the pill parks bottom-left under the Teal panel (the right column is full).
- `e2e/missions.spec.ts` now also asserts the pill never overlaps a `.panel` or a control button at 320x568 ... 1440x900.
