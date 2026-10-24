# 0162. Game controller for sailing and the chart

**Status:** Proposed (2026-10-24).

## Context

Guillaume asked for Xbox controller support (2026-10-24). Browsers read standard game pads
directly through the Gamepad API (USB or Bluetooth; desktop Chrome, Edge, Firefox, Safari,
Android Chrome and recent iPads), so no plugin is needed. Sailing already goes through one input
layer (`src/input/input.ts`, decision 0006): a held rudder and one-step sail changes. The menus,
the harbour and quest cards are made for mouse and touch; a second thread ("Add controller
support for menus") adds focus navigation for them. Old tablets must not pay for a feature they
rarely use (decision 0006).

## Decision

- **One poller** (`src/input/gamepad.ts`, `GamepadPoller`): reads `navigator.getGamepads()` once
  a frame in the main loop, and only after a `gamepadconnected` event, so a device without a pad
  does no work. It prefers a pad with the browser's `standard` mapping, else takes the first one.
- **Buttons have names** from the standard layout (`a b x y lb rb lt rt view menu ls rs up down
left right home`); sticks are `lx ly rx ry`. A press is reported once, then repeats after
  `repeatDelayMs`, every `repeatEveryMs`. Sticks have a dead zone and are rescaled to still reach
  ±1. Analog triggers count past `triggerPress`.
- **The mapping is data**: `src/data/controls.json` › `gamepad`, one action map per context
  (decision 0093). `controlProblems()` checks it (unknown buttons or axes, empty actions).
- **At sea** (`sea`): left stick or D-pad left/right steer (the stick is analog, like dragging
  the tiller); RB/RT/D-pad up raise the sails one step, LB/LT/D-pad down lower them (one step per
  press, held buttons do not run them, like the arrow keys); **B strikes all sails**, which stops
  the boat and docks it near a port, since docking is "sails down near a port" (decision 0094);
  **A** opens the harbour when docked; **Y** or View opens the chart; **Menu** pauses; right
  stick up/down zooms the camera like the mouse wheel.
- **On the chart** (`chart`): left stick or D-pad pans; RT/RB zoom in and LT/LB out one step per
  press (with hold repeat), so the SVG chart redraws only on a step, not every frame; **X** shows
  the whole sea; **B**, Y or View go back (a side panel first, then the chart), like Esc.
- **Contexts**: `chart` while the chart is open with no card over it, `sea` while playing and not
  paused, `menu` otherwise. Presses a context does not use, and every press in `menu`, go to
  `GamepadPoller.onMenuPress(press, context)` for the menus thread's focus code; other code can
  also listen with `onPress` and `onUsingPad` (the last input came from a pad: show focus rings
  only then). Keyboard, mouse and touch are unchanged; keys still win over the stick.
- **Hints**: a toast "Controller connected: left stick steers, LB/RB sails, Y map" when a pad is
  connected, and a "Controller" line in How to play, shown only once a pad has been seen
  (`body.has-gamepad`).

## Consequences

- Sailing, docking and the chart play with a pad on every device whose browser reports it;
  remapping a button is a one-line data edit.
- Menus, the harbour screen and quest cards still need the menus thread's focus navigation; until
  then a pad player uses the mouse or touch there (the Menu button pauses, which shows the menu).
- Browsers only expose a pad after a button is pressed on it, so the toast appears on the first
  press, not on plugging in.
- Tests: `tests/gamepad.test.ts` (data check, dead zone, press and repeat, triggers, sea and chart
  actions, no polling before a pad is seen).
