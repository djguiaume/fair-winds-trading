# 0187. Controller buttons on quest cards

**Status:** Accepted (2026-10-25).

## Context

With a controller, a quest card (Rook at the rescue, an arrival card) took the pad's focus ring and
the A / B pill of [0163](0163-game-controller-in-the-menus-and-the-port-screen.md), which fades after a few seconds and sat over
the card's buttons in landscape. Guillaume asked how console games do it: almost all put the
button's icon on the action itself and keep it there while the choice is on screen. The tutorial
bubble already does ([0183](0183-play-in-the-xbox-browser.md): A Continue, Y Skip).

## Decision

- While the pad is the last input, the card dialog's answers carry their button glyph:
  the `press` button (A) on the focused answer only, since it presses whatever has the focus;
  `back` (B) on Not now, and on "To the market" when the card has no Not now (both close the card,
  as Esc does); `secondary` (X) on "Don't offer again", which is marked `data-pad="secondary"` so
  the pad's X clicks it, like Sell all.
- The buttons come from `controls.json` › `menu.actions` (the first button of each), drawn with
  `padGlyph`, so they follow the pad's brand names ([0186](0186-button-names-per-pad-maker.md)).
- The card dialog sets `data-pad-hints="off"`: a screen whose controls show their own buttons gets
  no A / B pill over them.
- The Quay tab's inline cards stay without glyphs: they share one screen, where B leaves the
  harbour and X would be ambiguous.

## Consequences

- Remapping a menu action in `controls.json` changes the card's glyphs with it.
- Screenshots: [docs/reviews/quest-card-pad/](../reviews/quest-card-pad/).
