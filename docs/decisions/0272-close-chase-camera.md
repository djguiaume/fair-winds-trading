# 0272. Close chase camera

**Status:** Accepted (2026-11-01).

## Context

Issue #432 (Guillaume): a closer third-person view behind the boat, so the ride, waves and boat looks
show off. The sea camera already tilts and turns (decision 0223), so this is a second placement of
the same camera, not a new one.

## Decision

- An optional view, off by default. Switch on every input: key **C**, the pad's right-stick press
  (turned camera: back north-up first; otherwise it toggles the chase view), and a pinch past the
  closest sea zoom (pinch the other way past the farthest chase zoom to leave). The touch HUD button
  waits for the sea HUD rebuild (#441).
- `CameraRig` blends (eased) between the sea placement and the chase one: lower tilt, shorter
  distance, heading trailing the boat's heading. State lives in `src/render/chaseView.ts`.
- Fog and the far view keep the sea camera's distance (`sightDistance`), so the horizon and islands
  look the same; only the camera stands closer. Per frame cost: a few multiplies, no allocations.
- While chasing, drag and stick turns are ignored; the wind compass turns with the shown heading
  (`rig.viewHeading`), so wind stays readable. A focus view (home island) holds the sea camera.
- All numbers are `camera.json` › `chase`, editable in `?tune` (Camera tab).

## Consequences

- The HUD thread (#441) can hide the extra boxes in chase and should point the objective arrow with
  `rig.viewHeading`, not north-up; `rig.chase.active` says which view is on.
- Phone `?bench` near a beach still to be read on a real device (open list, #377).
