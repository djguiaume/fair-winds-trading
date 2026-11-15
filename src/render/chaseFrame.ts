import { TUNING } from '../data/tuning';
import { DEG, clamp, lerp } from '../sim/math';

/**
 * The follow cam's framing (art bible §13, issue #537), set in screen terms: the boat's centre
 * `boatY` and the horizon `horizonY` down the screen (0 top, 1 bottom) with a vertical field of
 * view `fovDeg`. Those three fix both angles; the distance only sets how big the boat is.
 * Numbers: `camera.json` › `chase` › `framings` (decision 0312). No three.js here, so tests drive it.
 */
export type Framing =
  (typeof TUNING.camera.chase.framings)[keyof typeof TUNING.camera.chase.framings];

/** Where the camera stands this frame. */
export interface ChaseFrame {
  /** The elevation with no player tilt (radians), where a look round comes back to. */
  rest: number;
  /** How high the camera stands over the boat's centre, seen from it (radians up). */
  elevation: number;
  /** How steeply the camera looks down (radians); less than the elevation, so the boat sits low. */
  pitch: number;
  /** From the boat's centre to the camera, scene units. */
  distance: number;
  /** The vertical field of view, radians. */
  fov: number;
}

/** The angle below the middle of the screen of a point `y` down it (0 top, 1 bottom). */
function belowMiddle(y: number, fov: number): number {
  return Math.atan((y - 0.5) * 2 * Math.tan(fov / 2));
}

/**
 * The frame for framing `f` at `pace` (0 at rest .. 1 at full speed: the camera climbs, so the horizon moves a
 * little up the screen, and pulls back), turned `tilt` steeper by the player within the orbit
 * limits, at `zoom`. The sea ends `sight` away in the fog, a little below the true horizon, so
 * the frame places that edge. Written into `out`, so a frame allocates nothing.
 */
export function chaseFrame(
  f: Framing,
  pace: number,
  tilt: number,
  zoom: number,
  sight: number,
  out: ChaseFrame,
): ChaseFrame {
  const c = TUNING.camera.chase;
  const fov = f.fovDeg * DEG;
  const boat = belowMiddle(f.boatY, fov);
  // The horizon lies straight out, so it sits as far above the middle as the camera looks down.
  const lookDown = -belowMiddle(lerp(f.horizonY, f.horizonYFast, pace), fov);
  const distance = f.distance * zoom * (1 + f.pullAtSpeed * pace);
  let rest = lookDown + boat;
  // The sea's edge dips below the horizon by the camera's height over the sight distance, and the
  // height depends on the elevation: two rounds settle it well under a pixel.
  for (let i = 0; i < 2; i++) {
    const dip = Math.atan((c.aimHeight + Math.sin(rest) * distance) / sight);
    rest = lookDown + dip + boat;
  }
  out.rest = rest;
  out.elevation = clamp(rest + tilt, c.orbitPitchMinDeg * DEG, c.orbitPitchMaxDeg * DEG);
  out.pitch = out.elevation - boat;
  out.distance = distance;
  out.fov = fov;
  return out;
}
