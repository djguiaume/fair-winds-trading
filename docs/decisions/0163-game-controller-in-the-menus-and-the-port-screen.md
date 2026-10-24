# 0163. Game controller in the menus and the port screen

**Status:** Proposed (2026-10-24): mockups waiting for Guillaume's pick.

## Context

[0162](0162-game-controller-for-sailing-and-the-chart.md) lets an Xbox-style pad (browser Gamepad
API) sail the boat and move the chart. Everything else, the title and pause menu, Settings, the port
screen's tabs, quest cards on the Quay, the arrival and dialogue cards, the journal and a build
spot's choice, is made for mouse and touch. With a pad in hand the player must be able to reach
every control, see which one is picked, and go back.

## Decision (proposed)

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

To be filled in once the look is picked and built.
