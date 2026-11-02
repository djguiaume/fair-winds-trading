# 0277. Loading screen and portrait page

**Status:** Accepted (2026-11-02).

## Context

On the phone build v1.4.364 the loading screen was a dark navy page with dark title text and a plain bar (issue #459), and a phone held upright loaded the game and laid it out as a mess (issue #458). Decision 0268 made the game landscape-only (desktop and phone landscape).

## Decision

- **Loading screen.** Paper background, the whole screen as plain markup in `index.html` (rewritten by `npm run identity -- sprite` from the sprite, so the logo cannot drift), the tagline, then a small ink sailboat on a wave line that inks in behind it. No percentage; the word is "Hoisting sail" / "On hisse la voile". `boot.ts` sets `--splash-p`; the browser reports no progress for a module graph, so the boat steps at known points and eases towards the end, then sails home when the game is up. Reduced motion: no gliding. Colours fall back to the theme values (a test keeps them equal).
- **Portrait page.** A touch device held upright with a phone-sized short side (`pointer: coarse`, width at most the theme's `phone-max-height`) shows a full-screen paper page: logo, "Turn your phone sideways to set sail.", a turning-phone drawing, the tagline. No button; it leaves on rotation. While it shows, the game loop and music are stopped like a hidden tab (`awayFromGame()` in the visibility handler). Tablets and desktop windows are never blocked.
- The words live in `src/i18n/boot.json` (own file, so the first paint does not wait for `en.json` and `fr.json`).
- `npm run shots -- --splash` and `--portrait-gate` take the two screens.

## Consequences

- The game still downloads and builds behind the page on a portrait phone; it simply is not shown or run.
- Boot texts are the one place a string may exist twice (the tagline); a test holds it equal to `menu.tagline`.
