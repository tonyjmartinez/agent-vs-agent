# Agent vs Agent

A small bump-and-run spy board game for phone and desktop browsers. Two agents per side on a 6×6 board: move one square, and everything next to where you land gets **bumped** one square away. Bump spies off the edge to **burn** them, grab **intel** from the middle, and carry 3 home to win.

- **Play:** https://tonyjmartinez.github.io/agent-vs-agent/ (once GitHub Pages is enabled, see below)
- **Rules:** tap **How to play** in the game, or see `PLAN.md` §2.
- **Design log and balance data:** `DESIGN_NOTES.md`

## Run it

```sh
npm install
npm run dev -- --host   # open the printed URL on your phone (same Wi-Fi)
```

## Checks

```sh
npm run typecheck && npm run lint && npm test
npm run sim -- --games 200 --p0 hard --p1 medium --swap   # self-play balance sim
npm run e2e                                                # Playwright, desktop + phone sizes
npx tsx scripts/single.ts                                  # single-file build → dist-single/
```

## Deploy

Every push to the working branch runs `.github/workflows/deploy.yml`. It typechecks, lints, runs the tests, builds, and publishes `dist/` to the `gh-pages` branch.

One-time setup: **Settings → Pages → Build and deployment → Source: Deploy from a branch → `gh-pages` / (root)**. Pages on a private repo needs GitHub Pro; otherwise make the repo public.
