# 0252. Start view while the game loads

**Status:** Proposed (2026-10-31).

## Context

Issue #396: on Guillaume's phone (Android 10, Medium) the game took 8 to 10 s to show anything. The page ran its whole script (parse, island and town builds, shore and seabed bakes) before the first paint, and the menu stays hidden until the world exists.

## Decision

- `index.html` carries a start view: the title, a thin bar and one word ("Loading" or "Chargement", the saved or browser language) on the night-water blue, with its own inline CSS so it paints before any script or stylesheet. Only the bar moves, as a compositor animation, so it keeps running while the game builds.
- The page's entry is `src/boot.ts`: after the first frame it imports `main.ts`, so the browser paints the view before it parses the game.
- `main.ts` calls `dismissSplash()` (`src/ui/splash.ts`) right after the menu is shown: a 0.4 s fade, then the element is removed. The no-WebGL2 message dismisses it too.

## Consequences

- Something useful is on screen at the first paint (about 64 ms headless, was blank until ready at about 14 s). The game's own load time is unchanged: this decision hides it, it does not shorten it.
- Profile of the start (headless, 1x CPU): about 3.4 s in `insideOutline` called from island heightfield sampling (`designedSample`), 2.2 s in the weighted blur `pass` (ground textures, heightfield smoothing), 0.8 s `coastDistance`, 0.8 s `bakeExposure` (waves). Shortening the load is a follow-up in those four places (cache outline tests per island, cheaper blur, defer the exposure bake until after the menu).
- No settings, no new text beyond the one word.
