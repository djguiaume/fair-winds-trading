# 0055. Smooth pier labels and stable destination bearings

**Status:** Implementation for review, 2026-10-20.

## Context

Playtesters reported that showing port signs slows the game and that signs move jerkily.
A Watchman Key bearing sometimes pointed towards the previous destination for roughly ten seconds.
Read 0006, 0022–0024, 0036 and 0049: retain low-end tablet budgets, pier anchors, explicit
navigation, market information and the instrument HUD.

The HUD moved whole signs at 10 Hz rather than with the rendered camera. Each update also
rewrote visibility and accessibility attributes, including for signs whose contents had not changed.
A separate reproducible bug explains an apparently stale arrow: projecting a distant point behind
the perspective camera reverses its screen coordinates. Sailing closer eventually moves it in
front of the camera and the bearing suddenly corrects itself. The selected world destination was
already updated; a delay/reset would not fix this.

## Decision

- Project eligible, discovered pier markers every rendered HUD frame. Move them with a
  subpixel `translate3d`, a compositor hint and layout/style containment. Avoid writes for
  unchanged transforms/visibility. Hidden markers have no composited surface to retain.
- Refresh prices, docking text and accessibility labels at most about eight times a second,
  or immediately on first appearance. Do not refresh off-screen marker content. Keep the
  same controls, translated cues, discovery filters and marker modes.
- Derive the destination's screen direction by projecting the boat and a one-unit step towards
  its target on the sea plane. Unlike projection of a distant target, this local direction does
  not cross the camera plane. Use the same angle for the destination chip and edge arrow,
  updated every frame with the selected name. The north-up compass keeps its world bearing;
  the real target projection is used only to decide whether an edge cue is needed.
- Preserve the three graphics profiles, saves, geometry, docking rules and navigation targets.
  No runtime dependency, texture, draw call or new scene object is added.

## Consequences and validation

239 tests pass after integrating the refined schooner from latest main, including real-perspective-camera regressions for southward targets behind
and across the camera plane, immediate opposite target selection/clearing, consecutive-frame
marker movement and unchanged-content mutation checks. Production build, ESLint and formatting
checks pass. Existing harbour, save and rendering-budget regressions remain green.

Actual engine screenshots and automated Chromium checks for Low/Medium/High are in
[overlay-navigation](../screenshots/overlay-navigation/README.md).
Headless software rendering validates behavior and rendering, not sustained physical tablet FPS.
Confirm longer sailing approaches on the reported device before calling its performance verified.
