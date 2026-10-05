# Design notes

Running log of decisions, sim results and playtest notes. Newest decisions appended per phase.

## Defaults (human hasn't answered PLAN §11)

- Headline mode: **Duel** (2 players × 2 spies). Title: **Agent vs Agent**. Hosting: **GitHub Pages**.

## Phase 0

- WebGL renders fine in headless Chromium 1194 with `--use-angle=swiftshader --enable-unsafe-swiftshader`; no Canvas fallback needed.
- Board sizing uses CSS container query units (`min(100cqw, 100cqh)`) on a `container-type: size` wrapper: the board is always the largest square that fits between the HUDs, in both orientations.
- Screenshots in `artifacts/screens/` are **committed** (not ignored) so they can be viewed on GitHub from a phone.
- Added a third e2e project, `iphone` (390×844 @3x, touch), alongside `desktop` and `mobile` (Pixel 7).

## Later

(ideas not in the plan go here)
