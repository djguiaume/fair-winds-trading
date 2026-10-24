# 0163. Game controller in the menus and the port screen

**Status:** Proposed (2026-10-24): built with look A (recommended); waiting for Guillaume's pick and OK on the screenshots.

## Context

[0162](0162-game-controller-for-sailing-and-the-chart.md) lets an Xbox-style pad (browser Gamepad
API) sail the boat and move the chart. Everything else, the title and pause menu, Settings, the port
screen's tabs, quest cards on the Quay, the arrival and dialogue cards, the journal and a build
spot's choice, is made for mouse and touch. With a pad in hand the player must be able to reach
every control, see which one is picked, and go back.

## Decision

- One **focus manager** for every open screen: the D-pad or left stick moves a real DOM focus to
  the nearest control in that direction (spatial navigation over the visible buttons, tabs, switches
  and sliders of the topmost screen); **A** presses it, **B** goes back (closes the card, sheet or
  port screen, like Esc), **LB/RB** switch tabs (port screen, Settings groups, transfer), **Start**
  resumes from the pause menu. The button map is the `menu` section of `src/data/controls.json`
  (0162's file and its one poller, no second `getGamepads` loop).
- A **focus highlight** in UI style D, shown only while the pad is the last input
  (`html[data-input=pad]`); mouse or touch hides it again. Three looks were mocked up in the real
  game (`docs/mockups/controller-menus/`): A brass ring with a soft glow, B lifted plate with a
  brass edge, C thin line plus a sliding brass pointer.
- A small **button hints** pill (A Choose, B Back, LB RB Tabs where there are tabs), EN and FR,
  bottom centre, shown when a screen opens with the pad and faded after a few seconds so it never
  hides a control for long.
- `npm run shots` gains `--focus` (a control focused as by the pad), `--style`, `--script` and
  several `--click`s, so mockups and reviews of this are drawn by the tool.

## Consequences

- Built in `src/ui/padFocus.ts` (`PadFocus`: spatial moves, A, B, tabs, Start, hints; pure parts
  tested in `tests/padFocus.test.ts`). `main.ts` lists the screens (`padScreen`) and shares Esc's
  `goBack` with B; on a modal dialog B sends `cancel` as Esc does. Sliders take left/right as
  value steps; switches and choice buttons are pressed with A.
- The focus starts on a screen's brass (main) button, never on its close button or tabs, and is
  found again by its likeness when a screen redraws (the market after a sale). The pad's first
  move or A only shows where the focus is.
- The hints pill is a popover so it shows over a modal card; it fades after
  `menu.hintsSeconds` (4 s), so in portrait it only briefly covers the language switch.
- Not covered yet: the chart's own panels (journal, market) stay with the chart's pad controls of
  0162; coach bubbles at sea have no pad button.
- Review shots: `docs/reviews/controller-menus/` from its `shots.json` (`npm run shots --pad`).
