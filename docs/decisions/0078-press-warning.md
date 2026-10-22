# 0078. Press warning on the sails control

**Status:** Accepted (Guillaume, 2026-10-22: "ok build it and merge it yourself")
**Date:** 2026-10-22

## Context

Since [0074](0074-forgiving-cargo-overboard.md), cargo goes overboard only when the wind presses
the boat too hard: in a gale or a storm under full sail, or when a hard gust hits her while she is
already pressed. Guillaume asked whether the drawn heel should show that press.

Screenshots showed that 14° and 23° of drawn heel look almost the same from the high camera, so
the heel alone cannot warn the player. The first mockup put a text pill on the sails lever.
Guillaume judged it unusable on a smartphone. He then asked whether the tutorial or the help
mentioned the danger at all. Neither did: players only learned about it from the storm warning
or after cargo was already lost.

Mockups: [docs/mockups/press-warning/](../mockups/press-warning/) (`press-warning-mockup.png` is
the rejected pill, `press-warning-phone.png` is the one that was picked).

## Decision

- **The sails control shows the danger.** The selected notch of the sails lever (usually FULL)
  and the lever's border turn **amber** when a hard gust could throw cargo, and **red** when cargo
  is about to go over the side. The colour sits right under the thumb that eases the sails, needs
  no text, and reads at phone size.
  - Amber: the press is above `LURCH_PRESS_KN` (18 kn equivalent).
  - Red: the press is above `OVERPRESSED_KN` (19.5 kn).
  - `pressLevel(world, previous)` in `src/sim/world.ts` reads the larger of the averaged press
    and the press right now. The warning therefore lights up before the averaged press can
    trigger a lurch: when full sail is hoisted in a gale, red shows about 5 s before the first
    loss. A 0.6 kn hysteresis stops it flickering on a line.
  - Alongside, the warning is always off.
- **The lee edge of the screen glows** in the same colour: a soft gradient on the side the boat
  leans to (the way the wind blows, projected on screen). In red it pulses slowly; there is no
  pulse with reduced motion. It is stronger and wider in portrait, where the screen edge is far
  from the boat. Only opacity animates, so it stays cheap on old phones.
- **One-time message**: the first time the warning turns amber, the toast says "Strong wind! Ease
  the sails or cargo goes overboard" (Settings remembers it with `seenPressHint`).
- **How to play** gets a fourth card, *Strong wind*: "When the sails control turns amber, then
  red, ease the sails or bear away, or cargo goes overboard."
- **Crossing into red** gives a short buzz on phones that support it (`navigator.vibrate`, so
  Android, not iOS) and a synthesised wooden creak (`src/audio/sfx.ts`). Until there is a
  separate effects slider, the creak follows the sound (music) volume.
- **No tutorial step.** Storms are held back during the tutorial
  ([0072](0072-no-storms-in-tutorial-or-events.md)) and the ordinary breeze never presses this
  hard, so a step would describe something the player cannot see. The one-time message covers it
  at the moment it matters.
- The drawn heel is unchanged.

## Consequences

- In fifteen minutes of breeze and rain with tacks and gybes, the sloop, cutter, schooner,
  clipper and fluyt never trigger the warning. It only shows in a gale or a storm, so it does not
  nag.
- Tests (`tests/weather.test.ts`) check four things: the warning stays quiet in a normal breeze;
  it goes amber before red; red comes at least `HEAVY_SECONDS` before the first loss; and it never
  flickers and stays off alongside.
- Pirates (Phase 5) can reuse the same edge glow for "pirate sighted" in red from their bearing,
  like the hazard markers in [0070](0070-hazard-markers.md).
- Screenshots: [docs/screenshots/press-warning/](../screenshots/press-warning/) (made with
  `capture.cjs`).
