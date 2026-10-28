# 0223. A camera the player can turn

**Status:** Proposed (2026-10-28). Accepted once Guillaume has played it on the Xbox, a phone and the old tablet.

## Context

Guillaume asked on 2026-10-25 whether the camera could be moved (right stick, right-drag on a PC, something on a phone). The feasibility check is the v1.1 plan's section "Candidate: a camera the player can turn" ([docs/v1.1/plan.md](../v1.1/plan.md)); it became issue #256. Until now the camera looked north at a fixed 58° from `src/render/view.ts` constants.

## Decision

1. **Heading and tilt.** `src/render/cameraOrbit.ts` holds the camera's heading (the bearing it looks toward, 0 = north) and its tilt offset; `view.ts` places the camera from them. The sim, steering (the rudder is relative to the boat) and saves do not care where the camera looks.
2. **Controls.**
   - Controller: right stick sideways turns (`controls.json` › `gamepad.sea.orbitAxis`, `orbitDegPerSec`); up/down stays zoom; clicking the stick resets (`actions.resetCamera: ["rs"]`).
   - PC: right-button drag turns (sideways) and tilts (up flattens); double right-click or Home resets; the browser menu is blocked over the sea.
   - Touch: two fingers drag to turn and tilt, a pinch zooms. When the second finger lands the steering drag lets go (rudder back to 0) and the touch is the camera's until every finger lifts (`src/input/touchCamera.ts`).
   - A round "reset the view" button by the compass shows only while the camera is turned.
   - Direction conventions: the pad and the mouse look the way they push (look right); on touch the sea follows the fingers. The signs live in data (`mouseDegPerPx`, `touchDegPerPx`), so a playtest can flip either.
3. **Narrow tilt.** 50° to 70° (default 58°), so the old tablet's fill rate is safe and the far plane still ends at the fog. `ultraPitchMinDeg` (35°) is the Ultra tier's flatter limit ([0221](0221-an-ultra-quality-level-for-desktop-and-xbox.md)); the Ultra issue reads it.
4. **What assumed north-up now turns:** the HUD compass rose turns with the camera (its letters stay upright), the rain field and the wind streaks turn their areas with the screen, and a focus view (the home island, Skerry's plots, a shifted focus) holds the camera and eases it back north-up while it lasts. Quest arrows, port labels and boat labels already projected through the camera.
5. **Settings › Display:** "Turn the camera" (on by default; off keeps north up and ignores the inputs) and "Camera comes back by itself" (off by default; eases back after `returnAfterSeconds` without camera input).
6. **Data:** every camera number (default tilt, limits, distance, zoom range, portrait pull-back, look-ahead, follow and reset ease, mouse and touch degrees per pixel, return delay) is in `src/data/tuning/camera.json` with `tuning-meta` entries, so `?tune` and the editors' Tuning page show a Camera tab. The pad's axis, speed and reset button are on the editors' Controls page and checked by `npm run check`.
7. **CLI:** `npm run shots -- --yaw 40 --tilt 52` shoots a turned camera (no player limits, so `--tilt 35` previews Ultra); `--pad "rx=0.8:800,rs:100"` fakes the stick and the reset.

## Consequences

- Turning costs nothing (same sea on screen, square ocean grid and shadow box). The flattest tilt shows a little more land: `?bench` must run at both tilt limits on the old tablet before this is accepted; if it drops, ship heading only (set `pitchMinDeg` = `pitchMaxDeg` = `pitchDeg`).
- The chart stays north-up; the sea compass shows where north is.
- Harbour pictures ([0211](0211-the-port-in-the-harbour-screen.md)) keep their own fixed cameras.
