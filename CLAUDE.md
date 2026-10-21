# Agent vs Agent

A small boop-like spy board game for desktop and mobile browsers. `PLAN.md` is the source of truth: rules spec,
stack, architecture, and a phased build plan with "Done when" checklists.

## How to work here

1. Read `PLAN.md` sections 1–5 before writing code, then work one phase of section 7 at a time.
2. Don't start a phase until the previous one's "Done when" list passes. Note progress in `DESIGN_NOTES.md`
   (decisions, sim results, which phase is done).
3. One phase (or a smaller slice of one) per PR. Put the phase's "Done when" checklist in the PR body, ticked.

## Commands

Phase 0 creates the scaffold. After that, run before every PR:

```sh
npm ci
npm run typecheck && npm test && npm run build   # names per PLAN.md section 4.1
```

## Gotchas (from PLAN.md)

- Phaser 4, not 3: read `node_modules/phaser/skills/*/SKILL.md` before writing Phaser code.
- The rules engine is pure TS with no Phaser imports; Vitest covers every clarification in section 2.2.
- Pin `@playwright/test@1.56.1` so it finds the preinstalled Chromium. Never run `playwright install`.
- Look at Playwright screenshots (desktop 1440px and phone 360px) before calling UI work done.
