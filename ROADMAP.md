# Roadmap: next milestone ("finish v1")

Status found in the repo: PLAN.md Phases 0-4 are done. Phase 5 (balance) is recorded in DESIGN_NOTES.md (sprint + fumble
ship as the Duel default). Phase 6 (art, juice, keyboard, sound, favicon) and Phase 7 (CI in `.github/workflows/ci.yml`,
manifest + icons, README, hosting on Cloudflare instead of GitHub Pages) are shipped. Still open from Phase 6/7:
the 60fps long-task check, and the human sign-off steps (v1 tag, real-phone check). Everything else is polish.
So the milestone is: close the remaining v1 verification gaps, then deepen what players already use (missions, debrief).

Each item fits one loop iteration. Order is by user value. Tag: **[design]** = design-polish loop, **[product]** = product loop.

1. **[product] Long-task check in e2e. (DONE: e2e/longtask.spec.ts)** Add a `PerformanceObserver` (`longtask`) spec that plays an auto game at speed 1 and
   asserts no task over 50 ms during animations. Why: PLAN §7 Phase 6 "Done when" requires it and no spec has it yet
   (`grep longtask e2e src` is empty); the hard bot already runs in a worker (`src/ai/ai.worker.ts`), so this should pass.
2. **[design] Reduced-motion e2e + screenshot.** Emulate `prefers-reduced-motion: reduce`, play an extraction and a burn, and
   assert no camera shake or particle objects and that the HUD pip pop is off. Why: CSS covers it (`styles.css` has a
   reduce block) but the Phaser side (shake, particles, tweens) has no test.
3. **[design] Greyscale team-readability across all states.** Extend the greyscale check in `e2e/variant.spec.ts` to menu-less
   states: selected, preview-burn, extraction-moment at 320x568 and 844x390, and look at the PNGs. Why: PLAN §7 Phase 6
   review step 2 asks for it for every state; only one exists.
4. **[product] "Closest call" debrief stat. (DONE: "Close calls" row)** Show the turn where a side was one intel from winning and was denied. Why:
   CLAUDE.md "Next ideas" lists it; the debrief (`DESIGN_NOTES.md` "Match stats debrief") already has the stat plumbing.
   Needs after-state in `addAction`; keep the engine pure.
5. **[product] Measure steal loops, decide on superko.** Run `npm run sim` with 400 games per bot level and count games ending
   by turn cap or repeated positions; log in DESIGN_NOTES.md. Add the no-repeat rule only if the number is material. Why:
   the "Later" list in DESIGN_NOTES.md flags positional superko as a maybe; a number settles it.
6. **[product] 3-move daily-pool entries.** Mine with `npx tsx scripts/missions.ts --moves 3 --games 120` and add proven
   entries to the daily pool. Why: CLAUDE.md next ideas; a 2-move-only pool gets repetitive for daily players.
7. **[design] README screenshots.** Add one desktop and one phone screenshot from `artifacts/screens/` to the README top.
   Why: README explains the game in text only; a visitor from a share link has no picture. Uses repo-owned images only.
8. **[design] Focus-visible audit of menu and overlay buttons.** Check every `button`/`a` in `src/ui/styles.css` has a visible
   `:focus-visible` style matching the mission-pill ring (#51). Why: keyboard play shipped, but only the pill is known to
   have a ring.

## Blocked on Tony

- **v1 sign-off and tag.** Needed: open the live Cloudflare URL on a real phone, confirm it loads and plays, then say "v1
  approved" (or list what is wrong). Then a `v1` tag can be created (agents cannot push tags).
- **PLAN §2.7 / §11.1: Duel 2x2 or 4-player FFA as headline mode.** Duel is the default and is what ships. Needed: "keep
  Duel" or "FFA first".
- **PLAN §11.2: final name** ("Agent vs Agent" is in use; alternates "Dead Drop", "Bump & Run").
- **Phase 8 (FFA mode, `veterans` flag).** Gated on the v1 sign-off above and the 2.7 answer. Do not start before then.
- **PLAN §11.4: LLM-agent bots.** Needs a decision and API keys; not in v1.
