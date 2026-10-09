# Agent vs Agent

A small bump-and-run spy board game for phone and desktop browsers. Two agents per side on a 6×6 board: move one square, and everything next to where you land gets **bumped** one square away. Bump spies off the edge to **burn** them, grab **intel** from the middle, and carry 3 home to win.

- **Play:** Cloudflare `agent-vs-agent` Worker, once connected (see Deploy below)
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

## Deploy (Cloudflare, via `wrangler.jsonc`)

The repo carries its own Cloudflare config (`wrangler.jsonc`): a static-assets Worker serving `dist/`.

**From the dashboard (auto-deploys on push):** go to **Workers & Pages → Create → Import a repository** and pick `tonyjmartinez/agent-vs-agent`. Cloudflare reads `wrangler.jsonc`. If it asks, use build command `npm run build` and deploy command `npx wrangler deploy`. Pushes to `main` go live at `https://agent-vs-agent.<your-subdomain>.workers.dev`. Add a custom domain (e.g. `play.tonyjmartinez.com`) under the Worker's **Settings → Domains & Routes**.

**From your machine:** run `npx wrangler login` once, then `npm run deploy` (it builds, then runs `wrangler deploy`).

GitHub Actions (`.github/workflows/ci.yml`) only runs the checks: typecheck, lint, tests and build.
