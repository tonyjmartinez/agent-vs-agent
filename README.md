# Agent vs Agent

A small bump-and-run spy board game for phone and desktop browsers. Two agents per side on a 6×6 board: move one square, and everything next to where you land gets **bumped** one square away. Bump spies off the edge to **burn** them, grab **intel** from the middle, and carry 3 home to win.

- **Play:** https://agent-vs-agent.pages.dev (Cloudflare Pages, once the secrets below are set; add a custom domain such as `play.tonyjmartinez.com` in Cloudflare)
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

## Deploy (Cloudflare Pages)

Every push runs `.github/workflows/deploy.yml`. It typechecks, lints, runs the tests, builds, and uploads `dist/` to Cloudflare Pages with `wrangler`.

- `main` deploys to production: `https://agent-vs-agent.pages.dev` plus any custom domain.
- Other branches get a preview at `https://<branch>.agent-vs-agent.pages.dev`.

One-time setup:

1. Cloudflare → **My Profile → API Tokens → Create Token → Custom token**. Permission: **Account → Cloudflare Pages → Edit**. Copy the token.
2. Copy your **Account ID** (Cloudflare dashboard → Workers & Pages, right sidebar).
3. GitHub → this repo → **Settings → Secrets and variables → Actions** → add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
4. **Actions → Deploy to Cloudflare Pages → Run workflow** (or push). The first run creates the `agent-vs-agent` Pages project.
5. Optional: **Workers & Pages → agent-vs-agent → Custom domains**, then add e.g. `play.tonyjmartinez.com`.

Until the secrets exist, the workflow still runs the checks and build but skips the upload.
