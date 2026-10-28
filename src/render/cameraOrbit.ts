import { TUNING } from '../data/tuning';
import { DEG, approach, clamp, wrapAngle } from '../sim/math';

/** Below this the camera counts as back home (north-up, default tilt): the reset button hides. */
const HOME_EPSILON = 0.5 * DEG;

/** A view heading's ground directions in the scene (x east, z south), as unit vectors. */
export interface ViewAxes {
  /** Toward the right of the screen. */
  rightX: number;
  rightZ: number;
  /** Toward the top of the screen. */
  forwardX: number;
  forwardZ: number;
}

/** The axes of a camera looking toward `heading` (a compass bearing, 0 = north), into `out`. */
export function viewAxes(heading: number, out: ViewAxes): ViewAxes {
  const s = Math.sin(heading);
  const c = Math.cos(heading);
  out.rightX = c;
  out.rightZ = s;
  out.forwardX = s;
  out.forwardZ = -c;
  return out;
}

export const NORTH_UP: Readonly<ViewAxes> = viewAxes(0, {} as ViewAxes);

/**
 * The sea camera the player turns (decision 0223): `heading` is the compass bearing it looks
 * toward (0 = north, the view before 0223) and `pitch` how steeply it looks down. The pad's right
 * stick, a right-button drag and a two-finger drag turn it; a reset, a focus view (the home
 * island, a harbour approach) or Settings › Camera switched off ease it back. The numbers live in
 * `src/data/tuning/camera.json`. No three.js here, so tests drive it.
 */
export class CameraOrbit {
  heading = 0;
  /** Steeper (+) or flatter (-) than the default tilt, so tuning the default moves it at once. */
  tilt = 0;
  /** Settings › Camera › "Turn the camera"; off holds the north-up view. */
  enabled = true;
  /** Settings › Camera › "Camera comes back by itself". */
  autoReturn = false;
  /** A focus view is on: it wants north-up, so turns wait until it ends. */
  held = false;
  private returning = false;
  private idle = 0;

  /** Turn by these angles (radians): + heading looks more to the right, + pitch looks steeper. */
  turn(heading: number, pitch = 0) {
    if (!this.enabled || this.held || (heading === 0 && pitch === 0)) return;
    const c = TUNING.camera;
    this.heading = wrapAngle(this.heading + heading);
    const tilted = clamp(this.pitch + pitch, c.pitchMinDeg * DEG, c.pitchMaxDeg * DEG);
    this.tilt = tilted - c.pitchDeg * DEG;
    this.returning = false;
    this.idle = 0;
  }

  /** A drag of (dx, dy) CSS pixels, by the right mouse button or two fingers: up flattens. */
  drag(dx: number, dy: number, device: 'mouse' | 'touch') {
    const c = TUNING.camera;
    const mouse = device === 'mouse';
    this.turn(
      dx * (mouse ? c.mouseDegPerPx : c.touchDegPerPx) * DEG,
      dy * (mouse ? c.mouseTiltDegPerPx : c.touchTiltDegPerPx) * DEG,
    );
  }

  /** Ease back north-up at the default tilt. */
  reset() {
    this.returning = true;
  }

  /** How steeply the camera looks down (radians from the horizon). */
  get pitch(): number {
    return TUNING.camera.pitchDeg * DEG + this.tilt;
  }

  /** Away from north-up or the default tilt: the reset button shows. */
  get turned(): boolean {
    return Math.abs(this.heading) > HOME_EPSILON || Math.abs(this.tilt) > HOME_EPSILON;
  }

  update(dt: number) {
    const c = TUNING.camera;
    this.idle += dt;
    if (!this.enabled || this.held || (this.autoReturn && this.idle > c.returnAfterSeconds))
      this.returning = true;
    if (!this.returning) return;
    // The heading stays in (-π, π], so easing it to 0 takes the short way round.
    this.heading = approach(this.heading, 0, c.resetRate, dt);
    this.tilt = approach(this.tilt, 0, c.resetRate, dt);
    if (this.turned) return;
    this.heading = this.tilt = 0;
    this.returning = false;
  }

  /**
   * Straight to a view, without easing or the player's tilt limits (the screenshot tool's --yaw
   * and --tilt), in degrees.
   */
  set(headingDeg: number, pitchDeg = TUNING.camera.pitchDeg) {
    this.heading = wrapAngle(headingDeg * DEG);
    this.tilt = (pitchDeg - TUNING.camera.pitchDeg) * DEG;
    this.returning = false;
    this.idle = 0;
  }
}
