# 0192. Port screen with a game controller

**Status:** Proposed (2026-10-25).

## Context

Guillaume's Xbox playtest: with a controller, players could switch the port screen's tabs (LB/RB)
but "cannot do anything else: no buying/selling, no changing quantities, no buying boats or
upgrades". The pad focus of decision 0163 (`src/ui/padFocus.ts`) already moved over the market's
Buy and Sell buttons, so the screen looked dead for other reasons:

- **Greyed buttons could not be reached.** A `disabled` button takes no focus, so a Shipyard where
  no upgrade or ship is affordable yet had nothing to move to but Set sail, and nothing said why.
- **The focus fell onto ✕ after the last sale.** When a Sell button greyed, the redraw put the
  focus on the close button, so the next A left the port; up from Set sail also landed on ✕.
- **Nothing told the player what the buttons do.** The A / B pill vanished after 4 seconds and
  never named LB/RB, and the lot (×1 ×5 ×10) was only reachable by walking up to the top corner.

Guillaume's rule: menu style and navigation must be the same in the whole game, so the fix stays in
the one focus system (the chart tabs of decision 0194 reuse it).

## Decision

All in `padFocus.ts`, with the buttons in `controls.json` › `gamepad.menu` (editable on the
Controls page, decision 0189):

1. **Greyed but reachable.** `softDisable(root)` turns the port screen's `disabled` buttons into
   `aria-disabled="true"` ones, styled as before; `guardSoftDisabled(root)` stops any click on them
   (pointer, keyboard or pad). The pad can move onto "Upgrade · 300 gold · need 150 more" and read
   it; A there does nothing. After a sale the focus stays on its (now greyed) button.
2. **LT / RT step an amount** (`less` / `more` actions): the screen's row of choices marked
   `data-pad="steps"` (the market's lot), or a focused slider. They repeat while held. LT and RT
   glyphs sit at the lot row's ends, like LB and RB at the tab bar's.
3. **The right stick scrolls** a long screen (`scrollY`, `scrollPxPerSec`): the box round the focused
   control that scrolls; when the focus scrolls out of sight it moves to the nearest control that
   scrolled into it.
4. **The hints pill stays up** while a screen is open with the pad (`hintsSeconds: 0`) and lists
   what works there: A Choose, B Back, and LB RB Tabs / LT RT Amount when the screen has them
   (those two are dropped under 1100 px wide, where the glyphs beside the controls do the job).
5. **Safer focus.** The focus never moves onto a close button (B already closes), never starts on a
   button marked `data-pad-start="never"` (the port's Set sail) while anything else is there, and
   prefers a screen's own controls over its header and footer bars.

## Consequences

- Every port control is reachable and usable with the pad: buy, sell, lot, Sell all (X), deliver,
  quay answers, upgrades and ships, Set sail.
- Every screen with the pad now keeps its hint pill (pause menu, settings, the chart's tabs); quest
  cards keep theirs off (`data-pad-hints="off"`, decision 0187).
- Other screens can use `data-pad="steps"`, `softDisable` and `data-pad-start="never"` the same way.
- Screenshots: `docs/reviews/port-pad/` (1080p TV, desktop, phone landscape).
