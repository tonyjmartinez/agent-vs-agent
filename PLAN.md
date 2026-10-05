# Agent vs Agent: v1 Build Plan

> **Who this is for:** an autonomous coding agent building v1 of a small, boop-like spy board game for desktop and mobile browsers.
> **How to use it:** read sections 1–5 once. Then work through section 7 phase by phase. Each phase has a "Done when" checklist and the commands that prove it. Don't start a phase until the previous one passes. Write down decisions and sim results in `DESIGN_NOTES.md` as you go.

---

## 0. TL;DR

- **Game (working title "Agent vs Agent"):** a 6×6 board with **4 spies**. In the default **Duel** mode, 2 players control 2 spies each. On your turn you move one spy one square in any direction. Wherever it lands, it **bumps** every adjacent spy (yours too) one square directly away. A spy bumped off the board is **burned** and goes to its owner's reserve. Pick up **intel** from the middle of the board and carry it back to your **extraction row**. First to bank **3 intel** wins. Bumping a carrier makes it drop the intel.
- **Why it works like boop:** the whole game is one verb: move, then everything around you gets pushed. Depth comes from geometry. You set up bumps that can't be returned, you use your own spies as walls, and you get pulled toward the dangerous edge because that's where you score.
- **Stack:** **Phaser 4.2.1** (WebGL) draws only the board. **Plain TypeScript and a DOM/CSS overlay** handle the HUD and menus. A **pure, deterministic TS rules engine** has no Phaser imports. **Vite** builds, **Vitest** runs the engine tests, **Playwright** runs desktop and mobile e2e checks and takes screenshots, and a **headless self-play simulator** handles balance.
- **The iteration loop the agent relies on:**
  1. Unit tests prove the rules.
  2. The self-play sim proves the game is balanced and rewards skill.
  3. Playwright screenshots at desktop and phone sizes prove it looks and works right. The agent opens the PNGs and looks at them.
- **Definition of v1:** a deployed static site where one human can play Duel against a bot (3 difficulties) or a friend on the same device (hotseat). It needs to work by mouse and by touch at 360px wide and on a 1440px desktop, include a one-screen rules card, undo, and juicy-but-simple animations.

---

## 1. Research summary and key decisions

### 1.1 Facts checked (Oct 2026)

| Thing                          | Finding                                                                                                                                                                                                                                                                                                    | Implication                                                                                                                                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phaser                         | `npm view phaser dist-tags` shows **latest = 4.2.1** (v4.0.0 shipped Apr 2026, 4.2.1 "Giedi" in Jul 2026 was a stability/ESM patch). Ships its own `.d.ts` (`types/phaser.d.ts`).                                                                                                                          | Use Phaser 4. No `@types` package is needed.                                                                                                                                                                  |
| Phaser docs for agents         | The npm package ships **`node_modules/phaser/skills/*/SKILL.md`** with 28 topic guides: `scale-and-responsive`, `input-keyboard-mouse-touch`, `tweens`, `particles`, `text-and-bitmaptext`, `loading-assets`, `scenes`, `v3-to-v4-migration`, `v4-new-features`, and more.                                 | **Read the relevant SKILL.md before writing Phaser code.** Most online examples are Phaser 3 and will be subtly wrong in v4.                                                                                  |
| Phaser 4 breaking changes vs 3 | Canvas renderer is deprecated (use WebGL / `Phaser.AUTO`). FX and masks became **Filters** (`obj.filters.internal.addMask(...)`). `setTintFill` was removed (use `setTint(c).setTintMode(Phaser.TintModes.FILL)`). `Geom.Point` became `Vector2`. The pipeline API was replaced by RenderNodes.            | Don't copy v3 snippets blindly. Our needs (shapes, images, text, tweens, particles, camera shake) are all standard API.                                                                                       |
| Phaser scaling                 | `Scale.FIT` + `autoCenter: CENTER_BOTH` keeps a fixed logical size and scales via CSS. The parent element **must have a size and no padding**. Don't style the canvas yourself.                                                                                                                            | The canvas lives in a CSS-sized **square** container with fixed logical size **1080×1080**. FIT on a square container never letterboxes. 1080 logical px looks crisp on a ~360 CSS-px board at DPR 3.         |
| Other versions                 | vite 8.3.x, vitest 5.0.x, tsx 4.23.x, prettier 3.9.x, eslint 10.x, `@fontsource/fredoka` 5.3.0. TypeScript `latest` is 7.0.2 (the native port). Phaser itself builds with TS ^6.                                                                                                                           | Pin `typescript@~6` unless 7 works cleanly with the scaffold. Typecheck is a separate `tsc --noEmit` step either way.                                                                                         |
| This cloud environment         | Node 22, npm 10. Chromium is preinstalled at `/opt/pw-browsers` (build 1194), matching **global playwright@1.56.1**. `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`.                                                                                                                                                 | Pin **`@playwright/test@1.56.1`** so it finds the preinstalled browser. If you use a newer one, set `launchOptions.executablePath: '/opt/pw-browsers/chromium'`. **Never run `playwright install`.**          |
| Phaser's official scaffolder   | `npm create @phaserjs/game@latest` is **interactive**.                                                                                                                                                                                                                                                     | Don't use it. Hand-write the small Vite setup (section 4.1), which is deterministic and agent-friendly.                                                                                                       |
| boop. (reference game)         | 2 players on a 6×6 bed. Placing a piece pushes all 8 neighbours one square away. Pushes don't chain, and a push is blocked if the target square is occupied. Pieces pushed off the board go back to the owner's pool. 3 kittens in a row graduate to cats, which kittens can't push. 3 cats in a row wins. | We borrow the **adjacent push without chain reactions** and the "off-board goes back to the pool" idea. We do **not** copy its name, art, or 3-in-a-row goal. The theme, objective, and movement are our own. |

### 1.2 Stack decision and why

**Chosen:** Phaser 4 for the board, DOM/CSS for the HUD and menus, a pure TS engine, and Vite.

- **Phaser** gives tweens, easing, particles, camera shake, and pointer and touch input for free. That's the "juice" that makes a simple board game feel good. The user suggested it, and its bundled agent skills lower the risk of v3/v4 mix-ups.
- **The DOM HUD** (score, turn banner, reserve tray, buttons, menus, rules card) gets crisp text at any DPR, CSS flex/grid responsive layout, `env(safe-area-inset-*)`, real `<button>`s for accessibility, and easy Playwright locators. Doing responsive UI inside a canvas is the most common time sink in browser games, so avoid it.
- **The pure engine** runs in Vitest, the CLI simulator, AI search, and a Web Worker without changes. It also keeps a later move to online play or LLM-agent players cheap, because state and actions are plain JSON.
- **Alternatives considered:**
  - Pure DOM/SVG with no Phaser: perfectly viable for a 6×6 board, but you'd rebuild tweens and particles by hand.
  - PixiJS: lower-level, so you'd assemble more yourself.
  - React plus a canvas: unneeded weight for v1.

  Keep the `BoardView` interface (section 4.5) narrow so the renderer could be swapped later if Phaser gets in the way.

---

## 2. Game design: v1 rules

### 2.1 Rules card (player-facing, must fit on one phone screen)

> **AGENT vs AGENT**
> **Goal:** Be the first to extract **3 intel**.
> **Your turn:** Move one of your spies **1 square in any direction** (including diagonally) to an empty square. _Or_, if you have a spy in reserve, **deploy** it onto any empty square of your extraction row.
> **Bump:** When a spy arrives, it bumps **every** adjacent spy (yours too!) one square straight away from it. A bump is blocked if another spy is in the way, and bumps don't chain.
> **Burned:** A spy bumped off the board goes to its owner's reserve.
> **Intel:** Step onto intel to grab it (one at a time). Get bumped while carrying it and you drop it where you stood.
> **Extract:** A carrier that reaches **your extraction row** banks the intel instantly. New intel appears in the centre.

### 2.2 Precise rules spec (the engine implements exactly this)

**Board:** 6×6 cells addressed `{r, c}` with `r, c ∈ [0, 5]`. Row 0 is at the top.

**Modes:** v1 ships **Duel**. The engine must stay generic over N players with k spies each so that FFA (section 2.6) is just a config.

**Duel setup:**

|                | Player 0 (Red, "you" by default) | Player 1 (Teal)  |
| -------------- | -------------------------------- | ---------------- |
| Extraction row | row 5 (bottom)                   | row 0 (top)      |
| Starting spies | `{5,1}`, `{5,4}`                 | `{0,1}`, `{0,4}` |

- Initial intel: `{2,2}` and `{3,3}`. That's symmetric under a 180° rotation, so both players face the same position.
- Player 0 moves first. First-player advantage gets measured in Phase 5. See the mitigation knobs in 2.4.

**State:**

- Every spy has `owner`, `pos` (a cell or `null` when in reserve), and `carrying: boolean`.
- Intel is a set of cells, with at most one intel per cell.
- Each player has a score.

**Legal actions for the current player:**

1. **Move:** choose an own spy with `pos != null`. Choose a cell at Chebyshev distance 1 (8 directions) that is on the board, has **no spy**, and does **not** contain intel if the spy is already carrying.
2. **Deploy:** choose an own spy in reserve and an empty (no spy) cell in the player's extraction zone. The same intel restriction doesn't apply because reserve spies never carry.
3. **Pass:** only legal if there are no other legal actions. This should be essentially unreachable. Test it anyway.

**Resolution order of one action.** This order is normative. Emit events in this order.

1. **Arrive.** Place the acting spy on the destination. Emit `moved` or `deployed`.
2. **Pick up (actor).** If the actor isn't carrying and the destination has intel, remove the intel and set `carrying`. Emit `pickedUp`.
3. **Bump.** For each of the 8 neighbours `n` of the destination that holds a spy `S`, compute the direction `d = n − dest` and the target `t = n + d`.
   - If `t` is on the board and holds a spy, **blocked** (`bumpBlocked` event; the renderer shows a little wobble).
   - Otherwise, if `S.carrying`, place intel on `n`, set `S.carrying = false`, and emit `dropped`.
   - If `t` is off the board, `S.pos = null` (reserve). Emit `burned`.
   - Otherwise, `S.pos = t`. Emit `bumped`.

   Evaluate every neighbour against the **pre-bump** board. This is safe because pushes go radially outward, so every origin is in ring 1, every target is in ring 2, and no two bumps share a target. No chains.

4. **Pick up (bumped spies).** Any spy that was bumped into a cell with intel and isn't carrying picks it up. Emit `pickedUp`.
5. **Extract.** For **every** spy on the board (any owner) that is carrying and standing in **its own** extraction zone, take these steps in a fixed order: by player index starting from the current player, then by spy id.
   1. Clear `carrying`.
   2. Add 1 to its owner's score. Emit `extracted`.
   3. Spawn one new intel (step 6).
6. **Respawn intel.** Put one intel on the first cell in `rules.intelSpawnOrder` that has neither a spy nor intel. The default order is the 4 centre cells `{2,2},{3,3},{2,3},{3,2}`, followed by the rest of rings 2 and 3, spiralling outward. Emit `intelSpawned`. This is deterministic, so there's no RNG in the rules.
7. **Win check.**
   - Any player with `score ≥ intelToWin` wins.
   - If several do (only possible through the "any owner" extraction in step 5), the **current player wins ties**.
   - If `ply ≥ maxPlies`, the higher score wins, and equal scores are a `draw`.
8. Advance `current` to the next player and increment `ply`.

**Deliberate clarifications.** Write a test for each of these.

- Bumps hit your **own** spies too.
- Intel doesn't block movement for empty-handed spies. Picking it up is automatic.
- Intel doesn't block bumps. A bumped spy landing on intel picks it up if it's empty-handed.
- A carrier can't voluntarily step onto intel. This keeps the "≤1 intel per cell" invariant.
- Deploying also bumps.
- An enemy carrier can be bumped while standing on **your** extraction row, which drops the intel there. If you then step on it, you pick it up **on your own row** and extract immediately (step 5). Intended: it's a "steal at the door".
- A spy with nowhere legal to move is simply skipped when listing actions.

### 2.3 Where the depth comes from (design intent, for playtest judgement)

- **The edge is where you score, and the edge is where you get burned.** Your extraction row is also the board edge. This tension carries the game.
- **Own-team bumps** make positioning puzzles. Your partner spy is both a wall that blocks bumps against you and a liability you might bump off the board.
- **Blocking.** A spy with a body behind it can't be bumped. Players learn "brace" formations.
- **Tempo from burning.** Burning an enemy costs them a turn to redeploy, but the redeploy happens on their extraction row and bumps on arrival. So burning an enemy next to their own row is risky.
- **Steal play.** Bumping a carrier drops the intel next to your bumper. Counter-play is fun.
- A skill gradient should show up in the sim: greedy beats random, and search beats greedy (section 9).

### 2.4 Tunable rules knobs (`Rules` config; all have defaults, and the sim can flip them)

```ts
interface Rules {
  size: 6;
  players: PlayerSetup[]; // extraction zone cells, start cells, colour key
  spiesPerPlayer: number; // Duel: 2
  movement: 'king' | 'orthogonal'; // default 'king'
  bumpOwnSpies: boolean; // default true
  intelOnBoard: number; // initial intel count (default 2)
  intelStart: Cell[]; // default [{2,2},{3,3}]
  intelSpawnOrder: Cell[]; // default centre-out spiral
  intelToWin: number; // default 3
  maxPlies: number; // default 120 (60 turns each), draw safety
  carrierCanEnterIntel: false; // invariant; keep false
  firstMoveNoBump: boolean; // balance knob, default false
  veterans: boolean; // depth knob for v1.1, default false (2.5)
}
```

### 2.5 Depth ladder (after v1; each one is a rules flag that the sim can measure)

Add **none** of these in v1 unless Phase 5 shows the base game is solved or flat. They're listed so the architecture leaves room for them.

1. **Veterans (boop's kitten→cat analogue):** a spy that extracts becomes a Veteran with a bigger sprite and a star. Rookies can't bump Veterans, but Veterans bump everyone.
2. **Cover tiles:** 2 fixed crates that block bumps (a bumped spy stays put if a crate is behind it) and can't be entered.
3. **Decoy (spy theme, hidden information):** one of your spies is secretly a decoy, and intel it carries is worth 0. It's revealed when bumped. This needs the hotseat "pass device" screen or online play.
4. **Gadgets:** each player gets one single-use gadget, for example Smoke (your arrival doesn't bump this turn) or Grapple (move 2 in a straight line).
5. **FFA mode:** see 2.6.
6. **Online play or LLM agents as players:** the engine already uses JSON state and actions.

### 2.6 FFA variant (stretch, Phase 8)

- 4 players with 1 spy each. Extraction zone = the 4 non-corner cells of that player's edge.
- Starts: `{5,2}`, `{0,3}`, `{2,0}`, `{3,5}`. Intel `{2,2}`, `{3,3}`. Win at 3 (tune it).
- Bots use paranoid search (everyone else minimises you).
- Ship it only if the sim shows seat balance within ±7% and games aren't dominated by kingmaking.

### 2.7 Open design question for the human (default chosen; override if wanted)

"4 agents" was read as **2 players × 2 spies (Duel)** for v1. That makes the best abstract-strategy game (boop is 2-player), the AI is tractable, and 4-player FFA (1 spy each) stays available as a config. If the human wants 4-player FFA as the main mode, swap Phase 8 ahead of Phase 6. The engine doesn't change.

---

## 3. Look and feel

### 3.1 Direction: "cozy spy"

boop. is soft, plushy, and chunky. Our take is **mid-century spy-movie poster meets toy box**: cream paper, bold flat colours, rounded everything, chunky bean-shaped agents in fedoras and sunglasses. Playful rather than gritty. No external art assets in v1. All art is **inline SVG strings** turned into textures at boot (section 4.6), so the agent can author and adjust it in code.

### 3.2 Palette tokens (define once in `src/ui/theme.ts`, mirror as CSS variables)

| Token             | Hex                   | Use                       |
| ----------------- | --------------------- | ------------------------- |
| `paper`           | `#F6EEDC`             | page background           |
| `board`           | `#EADBC0`             | board base                |
| `tileA` / `tileB` | `#F3E6CC` / `#E6D3B1` | checker tiles (subtle)    |
| `ink`             | `#2B2A33`             | outlines, text            |
| `red`             | `#E4572E`             | Player 0                  |
| `teal`            | `#17A6A3`             | Player 1                  |
| `mustard`         | `#F2B84B`             | intel folder, highlights  |
| `plum`            | `#6C4E8C`             | FFA P3 / accents          |
| `olive`           | `#7A8B3C`             | FFA P4                    |
| `danger`          | `#C0392B` @ 35%       | "would be burned" preview |

- Colours must stay distinguishable for colour-blind players. Each player also gets a **shape cue**: Red has a round hat brim, Teal has a pointed hat and a scarf. Intel carries a stamp glyph, not just a colour.
- Dark mode is **not** in v1. One good theme beats two average ones.

### 3.3 Components

- **Board:** a rounded-rect "dossier" with a 4–6px ink outline and a dashed "stitch" inset line (a nod to boop's quilt). Tiles are rounded squares with a 6% gap.
- **Extraction rows:** tinted 18% with the owner's colour, plus a small door/helicopter glyph at each end.
- **Spy piece:** a bean body in the team colour with a cream face strip, black sunglasses, a fedora, a 3px ink outline, and a soft drop shadow (an ellipse at 20% alpha).
  - **Carrying:** a mustard folder with a "TOP SECRET" stamp tucked under one arm, plus a small bounce idle.
  - **Selected:** a lift of 6px, a bigger shadow, and a slow pulse ring.
- **Intel on the board:** a mustard folder with a stamp, gently bobbing (±3px, 1.6s yoyo).
- **Font:** **Fredoka** via `@fontsource/fredoka` (self-hosted, so no CDN). Use it for both the HUD and Phaser text. `await document.fonts.load('700 48px Fredoka')` before booting Phaser so canvas text never renders in a fallback font.

### 3.4 Motion spec (all durations in ms; multiply by `speed`, which is 0 in tests)

| Event         | Animation                                                                                                                                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| select        | lift 6px + shadow grow, 120, `Back.Out`                                                                                                                                                                                                        |
| move / deploy | arc hop to the target 220 `Sine.InOut`, then squash on landing (scaleY 0.8 → 1, 140)                                                                                                                                                           |
| bump wave     | a ring ripple from the destination (graphics circle, alpha 0.5 → 0, 260). Bumped spies slide 180 `Back.Out` at the same moment.                                                                                                                |
| bump blocked  | the neighbour wobbles ±4px, 120                                                                                                                                                                                                                |
| burned        | the spy slides off the edge, spins 360°, scales to 0.6, and fades over 380. Camera shake 120ms at 0.004 intensity. A **"BURNED!"** pop text.                                                                                                   |
| pickUp        | the folder pops (scale 1.3 → 1) and attaches to the spy                                                                                                                                                                                        |
| dropped       | the folder flips out to the origin cell, 200                                                                                                                                                                                                   |
| extracted     | the spy hops, the folder flies to the HUD score counter (DOM; animate a ghost in canvas to the board edge, then pulse the DOM counter), confetti burst (Phaser particles, 24 particles, team colour plus mustard), **"EXTRACTED!"** stamp text |
| intelSpawned  | scale 0 → 1 with `Back.Out`, 260                                                                                                                                                                                                               |
| win           | a big stamp over the board ("MISSION COMPLETE" / "MISSION FAILED"), then the DOM overlay with Rematch                                                                                                                                          |

- Respect `prefers-reduced-motion`: no shake, no confetti, and tweens become 60ms fades.
- Text pops use Phaser Text with `resolution: 2` (see `skills/text-and-bitmaptext`).

### 3.5 Sound (Phase 6, optional for v1)

- Tiny synthesized WebAudio blips with no asset files: boop (sine 440 → 660, 80ms), burn (noise sweep down), extract (two-note chime).
- There's a mute toggle in the HUD, persisted in `localStorage` with try/catch.
- Audio starts only after the first user gesture (an iOS requirement).

---

## 4. Architecture

### 4.1 Project layout

```
/
├─ index.html                 # viewport meta, #app shell, loads src/main.ts
├─ package.json
├─ tsconfig.json              # strict: true, noUncheckedIndexedAccess: true
├─ vite.config.ts             # base: './' (works for GH Pages subpath + local)
├─ vitest.config.ts           # environment: 'node', include src/**/*.test.ts
├─ playwright.config.ts
├─ CLAUDE.md                  # commands + conventions for future agents (Phase 0)
├─ DESIGN_NOTES.md            # running log: decisions, sim tables, playtest notes
├─ scripts/
│  └─ sim.ts                  # headless self-play CLI (tsx)
├─ src/
│  ├─ main.ts                 # bootstraps DOM shell, fonts, Phaser, controller
│  ├─ engine/                 # PURE. No DOM, no Phaser, no Math.random, no Date.
│  │  ├─ types.ts
│  │  ├─ rules.ts             # default Rules, DUEL + FFA presets
│  │  ├─ board.ts             # cell helpers, directions, inBounds, key()
│  │  ├─ engine.ts            # createGame, legalActions, applyAction, isTerminal
│  │  ├─ preview.ts           # previewAction → events without committing (for hover UI)
│  │  ├─ serialize.ts         # toJSON/fromJSON, compact string for URLs/tests
│  │  └─ *.test.ts
│  ├─ ai/
│  │  ├─ rng.ts               # seeded PRNG (mulberry32)
│  │  ├─ evaluate.ts          # heuristic
│  │  ├─ bots.ts              # random, greedy, minimax(depth|timeMs)
│  │  ├─ ai.worker.ts         # Web Worker wrapper (Phase 5)
│  │  └─ *.test.ts
│  ├─ app/
│  │  ├─ controller.ts        # owns GameState + history; turns input/bots into actions
│  │  ├─ config.ts            # parse URL params (?seed, ?p0, ?p1, ?speed, ?mode, ?test)
│  │  └─ testHooks.ts         # window.__AVA__ (dev or ?test=1 only)
│  ├─ view/                   # Phaser only lives here
│  │  ├─ BoardView.ts         # interface the controller talks to
│  │  ├─ PhaserBoardView.ts   # implements BoardView, creates Phaser.Game
│  │  ├─ BoardScene.ts
│  │  ├─ art.ts               # SVG strings → textures
│  │  └─ animator.ts          # GameEvent[] → sequenced tweens
│  └─ ui/                     # DOM HUD + menus (no framework)
│     ├─ theme.ts
│     ├─ styles.css
│     ├─ hud.ts               # scores, turn banner, reserve trays, undo, menu btn
│     ├─ menu.ts              # mode/opponent/difficulty picker
│     ├─ rulesCard.ts
│     └─ gameOver.ts
└─ .github/workflows/ci.yml   # typecheck, lint, unit, build, e2e (Phase 7)
```

**Hard rule:** `src/engine` and `src/ai` must not import from `view/`, `ui/`, `app/`, or `phaser`. Enforce it with an ESLint `no-restricted-imports` rule or a tiny Vitest test that greps the imports.

### 4.2 Core types (starting point)

```ts
export type PlayerId = number; // 0..N-1
export interface Cell {
  r: number;
  c: number;
}
export interface Spy {
  id: string;
  owner: PlayerId;
  pos: Cell | null;
  carrying: boolean;
}
export interface GameState {
  rules: Rules;
  ply: number;
  current: PlayerId;
  spies: Spy[]; // stable order, ids like "p0a", "p0b"
  intel: Cell[]; // sorted for canonical equality
  scores: number[];
  winner: PlayerId | 'draw' | null;
}
export type Action =
  | { kind: 'move'; spyId: string; to: Cell }
  | { kind: 'deploy'; spyId: string; to: Cell }
  | { kind: 'pass' };
export type GameEvent =
  | { t: 'moved'; spyId: string; from: Cell; to: Cell }
  | { t: 'deployed'; spyId: string; to: Cell }
  | { t: 'pickedUp'; spyId: string; at: Cell }
  | { t: 'bumped'; spyId: string; from: Cell; to: Cell; by: string }
  | { t: 'bumpBlocked'; spyId: string; at: Cell; dir: Cell }
  | { t: 'burned'; spyId: string; from: Cell; dir: Cell }
  | { t: 'dropped'; spyId: string; at: Cell }
  | { t: 'extracted'; spyId: string; owner: PlayerId; at: Cell; score: number }
  | { t: 'intelSpawned'; at: Cell }
  | { t: 'gameOver'; winner: PlayerId | 'draw' };
```

**Engine API:**

- `createGame(rules) → GameState`
- `legalActions(s) → Action[]`, in a deterministic order.
- `applyAction(s, a) → { state, events }`. It is **immutable** (returns a new state), throws on illegal actions, and attaches a `phase` index to each event (arrive = 0, bump = 1, pickup = 2, extract = 3, spawn = 4, over = 5) so the animator can group them.
- `previewAction(s, a) → events` (just `applyAction(...).events`).
- `hash(s)` gives a canonical string for tests and transposition tables.

### 4.3 Controller (single source of truth)

- Holds `history: GameState[]`.
- The current state is `history.at(-1)`.
- **Undo** pops back to the last state where a human was to move.
- Flow on every action:
  1. `applyAction`
  2. Push the new state.
  3. `await view.play(events)`
  4. `view.sync(state)`: snap every sprite to the authoritative state. This prevents tween drift bugs.
  5. `hud.render(state)`
  6. If the next player is a bot, `await bot.choose(state)`.
- Input is locked while animations or bots are running.
- Seats are configured as `{ kind: 'human' } | { kind: 'bot', level: 'easy'|'medium'|'hard' }`.

### 4.4 AI

- **random:** a uniform legal action (seeded).
- **easy:** greedy one-ply on `evaluate`, with an ε of 0.25 random and softmax noise. It should feel beatable.
- **medium:** alpha-beta minimax, depth 2.
- **hard:** iterative deepening alpha-beta, depth up to 6, with a **time budget of 400ms** and a transposition table keyed by `hash(s)`.
  - Move ordering: extract, then burn-enemy, then pick-up, then the rest.
- **Evaluation (from the mover's perspective; tune it in Phase 5):**
  - `+1000` per score point difference. Terminal = ±∞.
  - `+120` for carrying. Subtract `25 × distance-to-own-extraction-zone` for each carrier.
  - `−90` for each own spy in reserve, `+90` for each enemy spy in reserve.
  - `−40` for each own spy on an edge cell that an enemy can bump off next ply (cheap check: an enemy spy can move to the inward neighbour cell, and the outward push isn't blocked).
  - `+5` per legal move (mobility).
  - Small symmetric terms for the opponent's carriers.
- Branching factor is at most about 16–22, so depth 4 is around 200k nodes. That's fine in a worker, and fine on the main thread at depth ≤ 2.
- Bots must be deterministic given a seed, so sims and tests reproduce.
- **UI pacing:** a bot's move waits at least 450ms ("thinking") so humans can follow, except when `speed=0`.

### 4.5 View boundary

```ts
interface BoardView {
  mount(el: HTMLElement): Promise<void>;
  sync(s: GameState): void; // no animation
  play(events: GameEvent[]): Promise<void>; // resolves when anims done
  setInteraction(opts: {
    selectable: string[]; // spy ids that can act
    targets: Map<string, Action[]>; // spyId|'reserve' → actions
    onPreview(a: Action | null): void;
    onCommit(a: Action): void;
  }): void;
  showPreview(events: GameEvent[] | null): void; // ghost arrows, danger tint
  cellToClient(c: Cell): { x: number; y: number }; // for tests
  destroy(): void;
}
```

### 4.6 Phaser specifics

- **Config:**
  ```ts
  {
    type: Phaser.AUTO,
    parent: 'board',
    backgroundColor: 'transparent',
    transparent: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1080,
      height: 1080,
    },
    scene: [BoardScene],
  }
  ```
  Read `node_modules/phaser/skills/game-setup-and-config/SKILL.md` and `scale-and-responsive/SKILL.md` first.
- **Board geometry:** the board occupies the central 6 × 156 = 936px, with a 72px margin on each side. The margin is where burned spies fly off and where the reserve "ghost" deploy hint sits. `cell(r, c)` centre = `72 + 156c + 78`.
- **Art:** in `BootScene` (or at the start of `BoardScene`), build textures from SVG strings. Use a `data:image/svg+xml;utf8,` URL via `this.load.svg(key, url, { width: 2×, height: 2× })`, or `this.textures.addBase64`. Rasterise at about 2× the display size for crispness. The SVG strings live in `art.ts` and are parameterised by colour.
- **Input:** each tile is a `Zone` (or a single interactive rect with maths to find the cell). Use `pointerup` to commit, and `pointerover`/`pointerout` for hover previews on desktop. Use pointer events only, never separate mouse and touch handlers. Read `skills/input-keyboard-mouse-touch/SKILL.md`.
- **Keyboard (desktop nicety, Phase 6):**
  - Arrows move a cursor over cells.
  - Enter or Space selects or commits.
  - Tab cycles your spies.
  - Esc cancels.
  - U undoes.
- **Depth sorting:** `setDepth(r)` (plus a lift for the selected spy) so lower rows overlap upper ones.

### 4.7 Mobile and responsive layout (DOM shell)

- **`index.html`:**
  - `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
  - `theme-color`
  - `body { margin:0; height:100dvh; overscroll-behavior:none; touch-action:manipulation; -webkit-user-select:none; }`
- **Shell:** CSS grid.
  - **Portrait (`max-aspect-ratio: 1/1`):** stack `top HUD (opponent tray + score)`, then `board`, then `bottom HUD (your tray + buttons)`.
  - **Landscape:** `side HUD | board | side HUD`.
- **Board container:** `#board { aspect-ratio: 1; width: min(100vw - 32px, 100dvh - <huds>); }`. No padding on `#board` itself, because Phaser needs a sized, unpadded parent.
- Pad the outer shell with `env(safe-area-inset-*)`.
- **Touch target check:** at 360px wide the board is about 328px, so cells are about 55px. That's above the 44px minimum. HUD buttons must be at least 44×44.
- **Touch interaction model:**
  1. Tap a spy to select it. Its legal targets glow.
  2. Tap a target to see a **preview**: ghost spy, arrows on everything that would be bumped, red tint and a skull on spies that would be burned, and a folder icon on drops.
  3. Tap the same target again to commit.
  4. Tapping elsewhere cancels.

  On desktop, hover gives the preview and one click commits. Add a setting "Confirm moves on touch" (default **on** for coarse pointers). Detect coarse pointers with `matchMedia('(pointer: coarse)')`.

- The board must never scroll or zoom on double-tap. Set `touch-action: none` on `#board`.
- Handle orientation changes through CSS. Phaser FIT re-fits automatically, because the container size changes and the ScaleManager watches the parent.

### 4.8 Test hooks (enabled when `import.meta.env.DEV` or `?test=1`)

```ts
window.__AVA__ = {
  ready: Promise<void>,
  getState(): GameState,
  legal(): Action[],
  act(a: Action): Promise<void>,            // goes through controller (anims at current speed)
  cellClient(r: number, c: number): {x,y},  // viewport coords for page.mouse / tap
  setSpeed(n: number): void,
}
```

URL params:

- `?seed=42`
- `?p0=human&p1=bot:hard`
- `?mode=duel|ffa`
- `?speed=0|1`
- `?test=1`
- `?state=<serialized>`, which starts from a given position. It's great for screenshotting specific situations such as "a burn is about to happen".

---

## 5. How the agent iterates (feedback loops)

| Loop              | Command                                                                                                                        | What it proves                                                                         | Speed   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------- |
| Typecheck         | `npm run typecheck` (`tsc --noEmit`)                                                                                           | types are consistent                                                                   | seconds |
| Lint/format       | `npm run lint`, `npm run format`                                                                                               | conventions, engine import boundary                                                    | seconds |
| Rules             | `npm test` (Vitest)                                                                                                            | every rule and edge case in 2.2                                                        | seconds |
| Balance and depth | `npm run sim -- --games 400 --p0 hard --p1 hard --seed 1`                                                                      | seat balance, game length, draw rate, skill gradient                                   | <1 min  |
| Visual and E2E    | `npm run e2e` (Playwright: `desktop` 1280×800 and `mobile` Pixel 7 plus an iPhone 14-sized viewport in Chromium, `hasTouch`)   | it boots, it's playable by click and tap, the layout fits, there are no console errors | ~1 min  |
| Eyeballing        | Screenshots go to `artifacts/screens/{project}-{name}.png`. **Open them with the Read tool and judge them against section 3.** | aesthetics, cropping, overlap, legibility                                              | —       |
| Manual            | `npm run dev -- --host`                                                                                                        | (for humans)                                                                           | —       |

**Rules for the loop:**

1. Write the **test first** for any rule. If a rule is ambiguous, decide it, record it in `DESIGN_NOTES.md`, and make the test encode it.
2. Any rules change has to be checked against the sim before and after. Paste both tables into `DESIGN_NOTES.md`.
3. After any visual change, regenerate screenshots and actually look at them at both sizes.
4. Commit at the end of each green phase, with messages like `phase-2: engine bump resolution + tests`. Push to the working branch.
5. Don't widen scope. If an idea is good but not in this plan, append it to the "Later" list in `DESIGN_NOTES.md`.
6. Never use `Math.random()` or `Date.now()` in `engine/` or `ai/`. Use the seeded RNG that's passed in.

**`scripts/sim.ts` output (JSON plus a pretty table):**

```
games, p0Wins, p1Wins, draws, p0WinRate (95% CI), medianPlies, p90Plies,
avgBurnsPerGame, avgDropsPerGame, avgExtractionsPerGame, gamesWithComeback(%),
firstExtractionPly(median), avgBranchingFactor, msPerMove(bot)
```

Flags: `--p0/--p1 random|easy|medium|hard`, `--games`, `--seed`, `--rules '{"firstMoveNoBump":true}'` (JSON merge over the defaults), `--swap` (alternate seats to cancel out first-move bias in matchups).

---

## 6. Risks and gotchas (read before coding)

1. **Phaser v3 examples on the web.** Prefer `node_modules/phaser/skills/*` and `node_modules/phaser/types/phaser.d.ts`. When an API fails to typecheck, grep the `.d.ts`.
2. **WebGL in headless Chromium.** Phaser 4 is WebGL-first.
   - Phase 0 must prove that a Playwright screenshot of the canvas is **not blank**.
   - If it is blank, add `launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }`.
   - As a last resort, use `type: Phaser.CANVAS` **only under `?test=1`**, and record that in the notes.
3. **Fonts in canvas.** Wait for `document.fonts.load(...)` before creating Phaser text, or the text renders in a fallback font and keeps the wrong metrics.
4. **Parent sizing.** If the board container has 0 height at boot, FIT breaks. Create the Phaser game after the shell has been laid out (`requestAnimationFrame` after mount).
5. **Animation and state drift.** Always `sync(state)` after `play(events)`. Never let sprite positions be the truth.
6. **Double input on touch.** Use only Phaser pointer events on the canvas and only `click` on DOM buttons. Never also bind `touchstart`.
7. **iOS Safari.**
   - Use `100dvh`, not `100vh`.
   - Audio unlock needs a gesture.
   - `localStorage` can throw in private mode, so wrap it in try/catch.
8. **Bundle size.** Phaser is the bulk (~1MB minified, roughly 300KB gzipped). Acceptable. Don't add other libraries.
9. **Infinite games.** `maxPlies` must exist from day one, and the sim reports draw rate.
10. **Playwright version mismatch** in this container: pin 1.56.1, or use `executablePath`. Never run `playwright install`.
11. **Trademark.** boop. is a published game. Don't use its name, art, or "boop" wording in the UI. Our verb is **bump**.

---

## 7. Phased plan

Each phase ends with every earlier check still green, plus a commit.

### Phase 0: Scaffold and walking skeleton (target: ½ day)

**Tasks**

1. `npm init -y`, then install:
   - `npm i phaser@4.2.1 @fontsource/fredoka`
   - `npm i -D vite typescript@~6 vitest tsx @playwright/test@1.56.1 eslint typescript-eslint prettier`
2. Add scripts:
   ```json
   "dev": "vite",
   "build": "tsc --noEmit && vite build",
   "preview": "vite preview",
   "typecheck": "tsc --noEmit",
   "test": "vitest run",
   "test:watch": "vitest",
   "sim": "tsx scripts/sim.ts",
   "e2e": "playwright test",
   "lint": "eslint .",
   "format": "prettier -w ."
   ```
3. Set up `tsconfig.json` (strict, `moduleResolution: "bundler"`, `target: ES2022`, `lib: ["ES2022","DOM"]`), `vite.config.ts` (`base: './'`), and `.gitignore` (`node_modules`, `dist`, `artifacts`, `test-results`, `playwright-report`).
4. Build the DOM shell with the responsive grid from 4.7, using placeholder HUD text.
5. Create a Phaser game in `#board` that draws a 6×6 tile grid with Graphics. Clicking a tile logs `{r,c}` and briefly tints it.
6. Configure Playwright with `desktop` and `mobile` projects. Write one test per project:
   - Load `/?test=1`.
   - Wait for `__AVA__.ready`.
   - Assert there are no console errors.
   - Take a screenshot.
   - Assert the canvas's centre pixel isn't fully transparent: `page.screenshot` clipped to the canvas, then check that the PNG isn't a single colour.
   - Use `webServer: { command: 'npm run build && npm run preview -- --port 4173', port: 4173 }`.
7. Write `CLAUDE.md` with the commands, the engine purity rule, and "read the Phaser skills first".

**Done when**

- `build`, `typecheck`, `test` (a trivial test), and `e2e` all pass.
- The desktop and mobile screenshots show the grid filling the board area with no scrollbars.
- On mobile the board is about the full width.

### Phase 1: Rules engine (target: 1 day)

**Tasks**

- Implement `engine/` per sections 2.2 and 4.2: `createGame`, `legalActions`, `applyAction`, `previewAction`, `hash`, and serialize.
- **Tests.** Build each case from a compact ASCII board helper:

  ```ts
  board(`
    . . . . . .
    . R . . . .
    . . i . . .
    . . . T . .
    . . . . . .
    . R . . T .`);
  ```

  Lower-case `i` is intel. `R*` or `T*` is a carrier. A reserve list is passed separately.

  Required cases:
  - Movement:
    - legal king moves
    - can't move onto spies
    - carriers can't enter intel cells
    - corners and edges
  - Deploy:
    - only from reserve
    - only empty home cells
    - deploy bumps
  - Bumping:
    - all 8 directions
    - own spies are bumped
    - blocked by a spy behind
    - not blocked by intel
    - no chaining
    - simultaneous multi-bump
  - Burning: off each edge and off corners diagonally, then into reserve.
  - Carrying:
    - drop on bump, at the origin cell
    - drop on burn, at the origin cell
    - a bumped spy picks up the intel it lands on
    - the actor picks up on arrival
  - Extraction:
    - immediate on reaching your own row
    - not on the opponent's row
    - "steal at the door"
    - respawn order, skipping occupied cells
  - Win:
    - reaching 3
    - tie on simultaneous extraction goes to the mover
    - `maxPlies` → higher score or draw
  - Pass only when no legal actions exist.
  - Event order matches the spec phases.
  - **Property tests** with a hand-rolled seeded loop of 2,000 random games. After every action, check these invariants:
    - ≤1 intel per cell
    - spies never overlap
    - every spy is either on the board or in reserve
    - intel count = `intelOnBoard` minus carried, plus nothing lost. That is, `intel.length + carriers == intelOnBoard` at all times.
    - scores never decrease
    - every game terminates by `maxPlies`
  - `applyAction` never mutates its input (deep-freeze the input in tests).

**Done when**

- All tests pass.
- The engine has 100% line coverage. Run `vitest --coverage` once to check; it isn't required in CI.

### Phase 2: Playable hotseat in the browser (target: 1 day)

**Tasks**

- Build the controller, `PhaserBoardView` with **plain shapes** (circles in team colours, a mustard square for intel), the DOM HUD (scores, whose turn, reserve trays with tappable reserve spies, an Undo button), and the select → target → commit flow, including the preview on touch.
- **Previews:** ghost arrows for bumps, a red tint for burns, a folder icon for drops.
- Animations at a **minimal** level:
  - linear tweens for moves and bumps
  - fade for burns
  - pop for extractions
- They must go through `play(events)` grouped by `phase`.
- Show a game-over overlay with Rematch.
- Add the test hooks and URL params.

**E2E additions**

- Script a full short game through `__AVA__.cellClient` taps on mobile and clicks on desktop. Assert that the score increments and game over appears.
- A screenshot test that loads `?state=` with a pending burn, taps to preview, and saves `preview-burn.png`.

**Done when** two humans can finish a game on a phone-sized viewport and on desktop, Undo works, and the screenshots look correct when you open them. Plain is fine at this point.

### Phase 3: Bots (target: 1 day)

**Tasks**

- Build `rng.ts`, `evaluate.ts`, and `bots.ts` (random, easy, medium, hard) per 4.4.
- Write `scripts/sim.ts` per section 5.
- Bot-vs-human seats in the controller, with a thinking delay and a turn banner that says "Agent Teal is thinking…".

**Tests**

- Bots only return legal actions.
- Given a seed, results are deterministic.
- Hard takes an immediate win when one is available. Use a fixture where an extraction wins.
- Hard avoids an immediate burn when a safe move exists.

**Done when**

- `npm run sim -- --games 200 --p0 easy --p1 random --swap` shows easy winning ≥85%.
- medium beats easy ≥70%.
- hard beats medium ≥65%.
- hard's p95 time per move is under 400ms in Node.
- If those gradients don't show up, fix the eval or search before moving on. A flat gradient means either a bot bug or a shallow game. Diagnose which one.

### Phase 4: Menus and onboarding (target: ½ day)

**Tasks**

- **Start menu (DOM):**
  - "Play vs Agent", with Easy/Medium/Hard.
  - "Pass & Play" (hotseat).
  - "How to play".
- The last choices are remembered in `localStorage` (try/catch).
- **Rules card** from 2.1, plus 3 tiny illustrated diagrams. Inline SVG in the DOM, built from the same art functions: bump, burn, extract.
- **First-game coach marks** (dismissible, shown once): "Tap a spy", then "Tap a square to preview", then "Tap again to move".
- Pause/menu button in the HUD with "Restart", "Rules", and "Quit to menu".

**Done when** the e2e test starts from the menu and plays vs Easy for 3 human moves on mobile and desktop, and the screenshots of the menu and rules card read well at 360px.

### Phase 5: Balance pass (target: ½–1 day, mostly sim)

**Tasks**

- Run the matrix: hard vs hard (seat balance), the skill gradient table, and the knobs: `firstMoveNoBump`, `intelToWin` ∈ {2, 3, 4}, `intelOnBoard` ∈ {1, 2, 3}, `movement` ∈ {king, orthogonal}, `bumpOwnSpies` ∈ {true, false}.
- Use ≥400 games per cell with `--swap` where that's relevant.
- Record every table in `DESIGN_NOTES.md`. Pick defaults against the targets in section 9, and write one paragraph explaining the choice.
- Play at least 3 games yourself through Playwright against hard (scripted with the `__AVA__` hooks plus your own reasoning). Note any moments that felt confusing or degenerate, such as a turtling stalemate or a dominant opening.

**Done when** the chosen defaults hit the section 9 targets, or the notes explain why a target was relaxed.

### Phase 6: Art and juice (target: 1–1½ days)

**Tasks**

- Replace the shapes with SVG art per 3.3: board, tiles, extraction-row tint and glyphs, the spy bean with fedora and shades in two silhouettes, intel folder, and the selected ring.
- Full motion spec 3.4, including `prefers-reduced-motion`.
- Particles for extraction, camera shake for burns, and pop text.
- Optional WebAudio blips and a mute toggle (3.5).
- HUD styling with the palette and Fredoka. Reserve trays show mini spies, and the score shows folder icons filling up (●●○).
- Keyboard controls (4.6).
- Favicon (an inline SVG spy head) and a `<title>`.

**Visual review protocol** (do it, don't skip it):

1. Generate screenshots for `menu`, `start-position`, `selected`, `preview-burn`, `mid-game`, `extraction-moment` (`speed=0`, captured after the events), and `game-over`, for both `desktop` and `mobile`. Also do `mobile-landscape` (844×390) and a small phone (320×568).
2. Open each PNG and check:
   - Is the board fully visible with no clipping?
   - Can you tell the teams apart at a glance, even in greyscale? Take one greyscale screenshot by applying CSS `filter: grayscale(1)` in the test.
   - Is the text readable?
   - Are tap targets big enough?
   - Does it feel "cozy spy"?
3. Fix, regenerate, and look again.

**Done when** all screenshots pass the checklist, the e2e still passes, and the 60fps sanity check holds: Chrome performance trace on desktop with no long tasks >50ms during animations, measured via `PerformanceObserver` in the e2e. Also move the hard bot into a Web Worker if its search causes visible frame hitches.

### Phase 7: Ship (target: ½ day)

**Tasks**

- **GitHub Actions `ci.yml`** on PRs and pushes:
  - `npm ci`
  - typecheck, lint, test
  - `npm run sim -- --games 50 --p0 hard --p1 hard` (a smoke check that it doesn't crash or hang)
  - build
  - e2e with `npx playwright install --with-deps chromium`. That's fine in GitHub's runners; the "never install" rule only applies to this cloud container. **This means the Playwright version can differ in CI.** Keep the config version-agnostic and have the executablePath override read an env var.
- **Deploy to GitHub Pages:** a workflow using `actions/upload-pages-artifact` and `actions/deploy-pages` from `dist/`. `base: './'` makes subpath hosting work.
- **PWA-lite (optional):** a manifest with name, icons (SVG), `display: standalone`, and theme colour, so "Add to Home Screen" looks good. No service worker in v1.
- Fill in the README: what the game is, the rules link, how to run, and how to sim.

**Done when** the CI is green, the Pages URL loads on a real phone (the human checks this), and a v1 tag exists.

### Phase 8 (stretch, after v1 sign-off): FFA and depth flags

- FFA mode per 2.6: rules preset, 4-colour HUD layout (opponent trays on 3 sides in landscape, compact chips in portrait), and paranoid search bots.
- Implement `veterans` behind a flag, sim it, and present the numbers to the human before making it a default.

---

## 8. Testing strategy detail

- **Unit tests (Vitest):**
  - **Engine:** exhaustive for the rules. Cover the ASCII fixtures and property invariants from Phase 1.
  - **AI:** legality, determinism, and tactical fixtures for mate-in-1 and avoid-burn-in-1.
  - **Serialize:** a round-trip property test.
- **E2E (Playwright):**
  - `boot.spec.ts`: no console errors, the canvas isn't blank, no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`).
  - `layout.spec.ts`: for each viewport, the board's bounding box is fully inside the viewport, HUD buttons are at least 44px, and nothing overlaps the board (compare DOM rects).
  - `play.spec.ts`: a scripted hotseat game to a win, using taps on mobile and clicks on desktop.
  - `bot.spec.ts`: a human vs Easy game for N moves, where the bot responds in under 2s.
  - `visual.spec.ts`: generates the named screenshots. Use `toHaveScreenshot` only after Phase 6 stabilises, with `maxDiffPixelRatio: 0.02` and animations disabled through `speed=0`.
- **Canvas clicks:** always go through `__AVA__.cellClient(r, c)`, then `page.mouse.click(x, y)` on desktop or `page.touchscreen.tap(x, y)` on mobile. Never hard-code pixels.

---

## 9. Balance and "is it fun?" targets (sim-measurable proxies)

| Metric                                                    | Target                                                     | Why                                                |
| --------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| Seat balance (hard vs hard, 400+ games)                   | P0 win rate 45–55%                                         | fair                                               |
| Draw rate (hard vs hard)                                  | < 8%                                                       | decisive                                           |
| Median game length                                        | 24–60 plies (12–30 turns each)                             | about a 5–10 minute game, like boop                |
| Skill gradient                                            | easy > random ≥85%, medium > easy ≥70%, hard > medium ≥65% | there's real depth to learn                        |
| Burns per game                                            | 1.5–6                                                      | battling actually happens but isn't constant chaos |
| Drops (steals) per game                                   | ≥ 1                                                        | the carrier tension works                          |
| Comeback games (winner was behind on score at some point) | ≥ 20%                                                      | games stay alive                                   |
| Forced passes                                             | ~0                                                         | no weird deadlocks                                 |

Knob priority if the targets miss:

1. **Seat balance:** try `firstMoveNoBump`, then giving P1 a centre-adjacent start.
2. **Too long or drawish:** lower `intelToWin` or raise `intelOnBoard`.
3. **Too few burns:** use `orthogonal` movement (more predictable lines) or start the spies one row in.
4. **Flat skill gradient:** this is a design problem. Try `veterans`. Write it up for the human rather than piling on more rules.

---

## 10. Out of scope for v1

- online multiplayer
- accounts
- leaderboards
- monetisation
- dark mode
- localisation
- sound beyond the blips
- a service worker or offline mode
- FFA (stretch)
- gadgets, decoys, cover tiles
- any framework (React and friends)
- external art assets

---

## 11. Questions to surface to the human (don't block on them; defaults are in parentheses)

1. Duel 2×2 vs 4-player FFA as the headline mode? (Duel)
2. Name? ("Agent vs Agent"; alternates: "Dead Drop", "Bump & Run")
3. Hosting target? (GitHub Pages from this repo)
4. Should bots be allowed to be LLM agents later? (The architecture allows it. Not in v1.)

---

## Sources

- [Phaser v4 download / release notes](https://phaser.io/download/stable)
- [Getting started with Phaser 4 + Vite + TypeScript](https://gamedev.net/news/2821-getting-started-with-phaser-4-vite-typescript-setup-using-the-official-create/)
- [Phaser 4.2.1 bundled skill: scale-and-responsive](https://unpkg.com/phaser@4.2.1/skills/scale-and-responsive/SKILL.md) (also in `node_modules/phaser/skills/`)
- [Phaser forum: responsive game size in mobile browser](https://phaser.discourse.group/t/responsive-game-size-in-mobile-browser/12088)
- [boop. rules (official game rules summary)](https://officialgamerules.org/game-rules/boop/)
- [boop. rulebook PDF](https://desktopgames.com.ua/games/7985/boop_rules_eng.pdf)
- npm registry (`npm view`) for current versions of phaser, vite, vitest, typescript, tsx, @playwright/test, @fontsource/fredoka (checked 2026-10-05)
