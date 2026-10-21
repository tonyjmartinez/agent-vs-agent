# Design notes

## Progress
- Phase 0 (scaffold and walking skeleton): done.

## Decisions
- Phaser 4.2.1 renders WebGL in headless Chromium once launched with `--use-angle=swiftshader --enable-unsafe-swiftshader`
  (set in `playwright.config.ts`). The canvas screenshot is not blank, so no Canvas fallback is needed.
- Phaser game is created after fonts load and one animation frame, so the parent has a size (PLAN risk 4).
- `window.__AVA__` currently exposes only `ready` and `clicks`; Phase 2 grows it to the full PLAN 4.8 API.
- Prettier ignores PLAN.md, DESIGN_NOTES.md, CLAUDE.md so the plan isn't reformatted.
- Mobile project uses a 360x740 viewport (Pixel 7 / iPhone 14 variants come later).
- Bundle: Phaser makes the JS chunk ~1.4 MB (358 KB gzip); the Vite size warning is expected (PLAN risk 8).

## Later
