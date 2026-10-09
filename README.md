# Agent vs Agent

A small bump-and-run spy board game for phone and desktop browsers. Two agents per side on a 6×6 board: move one square, and everything next to where you land gets **bumped** one square away. Bump spies off the edge to **burn** them, grab **intel** from the middle, and carry 3 home to win.

- **Play:** https://agent-vs-agent.pages.dev (Cloudflare Pages, once the repo is connected; see Deploy below)
- **Rules:** tap **How to play** in the game, or see `PLAN.md` §2.
- **Design log and balance data:** `DESIGN_NOTES.md`

On a phone, open the site and use **Share → Add to Home Screen** to play it fullscreen like an app.

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

## Deploy (Cloudflare Pages, Git integration)

Cloudflare builds straight from this repo. One-time setup in the Cloudflare dashboard:

1. **Workers & Pages → Create → Pages → Connect to Git**, then pick `tonyjmartinez/agent-vs-agent`.
2. Build settings:
   - Framework preset: **None** (or Vite)
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Production branch: `main`
3. **Save and Deploy.**

Every push to `main` then goes live at `https://agent-vs-agent.pages.dev`, and other branches get preview URLs. Node 22 comes from `.nvmrc`. Add a custom domain (e.g. `play.tonyjmartinez.com`) under the project's **Custom domains**.

GitHub Actions (`.github/workflows/ci.yml`) only runs the checks: typecheck, lint, tests and build.
