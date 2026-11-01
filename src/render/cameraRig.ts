import * as THREE from 'three';
import { TUNING } from '../data/tuning';
import { DEG, approach, clamp, lerp, wrapAngle } from '../sim/math';
import { ChaseView } from './chaseView';
import { CameraOrbit, type ViewAxes, seaMiddle, viewAxes } from './cameraOrbit';

/**
 * Where the sea camera stands and looks (decisions 0126, 0210, 0223): a little ahead of the boat,
 * or at a focus point (the home island and its plots), turned and tilted where the player turned
 * it, farther out in portrait. Numbers in `src/data/tuning/camera.json`.
 */
export class CameraRig {
  /** The camera the player turns (decision 0223). */
  readonly orbit = new CameraOrbit();
  /** The optional close chase view behind the boat. */
  readonly chase = new ChaseView();
  /** The point on the sea the camera looks at. */
  readonly target = new THREE.Vector3();
  /** The compass bearing the screen's top points toward this frame (the orbit's, or the chase's). */
  viewHeading = 0;
  /** The ground directions of the screen this frame, for the rain and the wind streaks. */
  readonly axes = viewAxes(0, {} as ViewAxes);
  /** The middle of the sea on screen, where the ocean grid centres. */
  readonly seaCentre = new THREE.Vector3();
  /** 1 = default; larger = farther away. */
  zoom = 1;
  /** A point the camera looks at instead of ahead of the boat (the home island, 0126). */
  private focus: { x: number; y: number } | null = null;
  /** Where on the screen the focus point sits, from the centre in screen fractions (0210). */
  private focusShift = { x: 0, y: 0 };

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  setZoom(zoom: number) {
    this.zoom = clamp(zoom, TUNING.camera.zoomMin, TUNING.camera.zoomMax);
  }

  /** Look at a map point, `shift` off centre in screen fractions (x right, y down), or null. */
  setFocus(point: { x: number; y: number } | null, jump: boolean, shift: { x: number; y: number }) {
    this.focus = point ? { ...point } : null;
    this.focusShift = { ...shift };
    // At once, without the camera's easing (the screenshot tool's --look).
    if (point && jump) this.target.set(point.x, 0, -point.y);
  }

  /**
   * Place the camera for a boat at scene `pos` heading `dir` (sim x east, y north) at `speedKn`;
   * a focus view eases the turned camera back north-up. Returns the distance fog and the far view
   * are set by.
   */
  place(
    dt: number,
    aspect: number,
    pos: THREE.Vector3,
    dir: { x: number; y: number },
    speedKn: number,
  ) {
    const c = TUNING.camera;
    this.orbit.held = this.focus !== null;
    this.orbit.update(dt);
    this.chase.update(dt, Math.atan2(dir.x, dir.y), this.focus === null);
    const b = this.chase.eased;
    const heading = this.orbit.heading + b * wrapAngle(this.chase.heading - this.orbit.heading);
    const pitch = lerp(this.orbit.pitch, c.chase.pitchDeg * DEG, b);
    this.viewHeading = heading;
    const axes = viewAxes(heading, this.axes);
    const ahead = lerp(speedKn * c.aheadPerKn, c.chase.lookAhead, b);
    // The field of view is vertical, so a tall phone sees a thin strip of sea: pull back until
    // portrait shows about as much water across as a landscape tablet (Guillaume, 2026-10-20).
    const portrait = aspect < 1 ? clamp(c.portraitWidth / aspect, 1, c.portraitPullMax) : 1;
    const seaDist = c.distance * this.zoom * portrait;
    const dist = lerp(seaDist, c.chase.distance * this.chase.zoom, b);
    // Fog and the far view follow the sea camera's distance, so the close view keeps the horizon.
    const sightDist = lerp(seaDist, c.chase.sightDistance, b);
    // A shifted focus: the ground the screen spans around the target, the tilt foreshortening it
    // top to bottom.
    const fov = this.camera.fov * DEG;
    const sx = this.focusShift.x * 2 * dist * Math.tan(fov / 2) * aspect;
    const sy = (this.focusShift.y * 2 * dist * Math.tan(fov / 2)) / Math.sin(pitch);
    const tx = this.focus
      ? this.focus.x - sx * axes.rightX + sy * axes.forwardX
      : pos.x + dir.x * ahead;
    const tz = this.focus
      ? -this.focus.y - sx * axes.rightZ + sy * axes.forwardZ
      : pos.z - dir.y * ahead;
    const target = this.target;
    target.x = approach(target.x, tx, c.followRate, dt);
    target.z = approach(target.z, tz, c.followRate, dt);
    const back = Math.cos(pitch) * dist;
    this.camera.position.set(
      target.x - axes.forwardX * back,
      Math.sin(pitch) * dist,
      target.z - axes.forwardZ * back,
    );
    // The screen's up is the view heading on the ground, so a camera straight down still knows it.
    this.camera.up.set(axes.forwardX, 0, axes.forwardZ);
    this.camera.lookAt(target);
    const middle = seaMiddle(pitch, dist, fov, TUNING.weather.sight.far * sightDist);
    this.seaCentre.set(target.x + axes.forwardX * middle, 0, target.z + axes.forwardZ * middle);
    return sightDist;
  }
}
