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
- Deploys now go through `wrangler pages deploy` from GitHub Actions, after the checks pass. `main` is production and other branches are previews.
- The project is created on the first run if it's missing. Without the secrets, the upload is skipped and the workflow stays green.
- `public/_headers` gives hashed `/assets/*` an immutable cache. `.nvmrc` pins Node 22 in case Cloudflare's Git integration is used instead.
- The old `gh-pages` branch is no longer updated. It was left in place; deleting it is the owner's call.

## Later

(ideas not in the plan go here)

- A no-repeat rule (positional superko) if humans also fall into steal loops.
- Hot-reload snapshot for the artifact build, so an open game survives a republish.
