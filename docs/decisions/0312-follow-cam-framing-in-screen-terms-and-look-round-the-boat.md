# 0312. Follow cam framing in screen terms and look round the boat

**Status:** Proposed (2026-11-15). Art director picked framing B; Guillaume's pick pending.

## Context

v1.11 "Welcome aboard" (issues #536, #537, whole-game review v1.9 section 3). The follow cam
(decision 0272) put the boat dead centre, so hull and mast hid the pier or mark being steered for,
and drags and the right stick did nothing in it. Art bible §13 sets the framing: boat centre at
62-68% of the screen height, horizon at 35-42%, the camera rising and pulling back (at most 30%)
with speed, eased over at least 1.5 s, no roll, an orbit that comes back 3 s after the last input.

## Decision

- **Framing in screen terms.** `camera.json` › `chase` holds where the boat's hull centre
  (`boatY`, `aimHeight` above the water) and the sea's edge (`horizonY`, `horizonYFast` at full
  speed) sit on screen, the view (`fovDeg`) and the distance. The camera's height over the boat and
  its tilt follow from those (`src/render/chaseFrame.ts`), so the boat and the horizon land in place
  at any distance or zoom. The horizon is the edge of the sea in the fog (`sightDistance` ×
  `weather.sight.far`), which lies a little below the true horizon.
- **A wider view in the follow cam: 56°** (the sea camera keeps 40°). At 40° the §13 positions
  leave the camera about 12° over the boat; 54-58° gives 17°. The rig blends the view with the
  switch. Cost: +1 to +4 draw calls and +1% to +9% triangles in the follow cam (headless, High);
  the sea camera and CI's render budget are unchanged. Art bible §13 now reads 12-20° at rest and
  a 54-58° view.
- **Speed and heel.** `pace` (speed over `fullSpeedKn`) eases with `speedEaseSec` (2 s): the horizon
  moves from `horizonY` to `horizonYFast` and the distance grows by `pullAtSpeed` (25%). The camera
  slides `leeShiftPerDeg` per degree of heel (at most `leeShiftMax`) to her high side, so the sail
  leans away from the way ahead. The camera never rolls.
- **Look round the boat.** Right-drag, two fingers and the pad's right stick (sideways) turn the
  follow cam round the boat with the sea camera's feel (`dragTurn`): yaw free, the camera between
  `orbitPitchMinDeg` (3°) and `orbitPitchMaxDeg` (35°) over her. It eases back behind her
  `returnAfterSeconds` (3 s) after the last input; the reset button and the pad's stick press bring
  it back at once. Steering keeps the left button. The wind compass is boat-up, so it reads true.
- Port signs in the follow cam stand no higher than 30% down the screen (`hud.portSignChaseMinY`,
  was 50%), so they no longer land on the boat.

## Consequences

- Framings are tuned by screen position, so a ?tune change cannot push the boat out of the lower
  third; `tests/chase-frame.test.ts` projects the rig's camera and checks §13 on every change.
- Three framings were shown (docs/reviews/v1.11/follow-cam-framing); the losing two are its
  `src/*.json` tune files.
- Phone `?bench&chase=1` on a device joins #377 (the wider view draws a few more boats and islands).
