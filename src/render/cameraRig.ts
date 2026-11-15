import * as THREE from 'three';
import { TUNING } from '../data/tuning';
import { DEG, approach, clamp, lerp, wrapAngle } from '../sim/math';
import type { ChaseFrame } from './chaseFrame';
import { ChaseView } from './chaseView';
import { CameraOrbit, type ViewAxes, seaAhead, viewAxes } from './cameraOrbit';

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
  /** The next placement lands at once, without the follow easing (the screenshot tool). */
  private jumpNext = false;
  /** The sea camera's field of view; the follow cam's comes from `camera.json` › `chase`. */
  private readonly seaFov: number;
  private readonly chaseFrame: ChaseFrame = {
    rest: 0,
    elevation: 0,
    pitch: 0,
    distance: 0,
    fov: 0,
  };
  private readonly eyeAt = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly chasePos = new THREE.Vector3();
  private readonly chaseLook = new THREE.Vector3();

  constructor(private readonly camera: THREE.PerspectiveCamera) {
    this.seaFov = camera.fov;
  }

  /** Where the camera stands, for effects that change close to it (the wind streaks). */
  get eye(): Readonly<THREE.Vector3> {
    return this.camera.position;
  }

  /** 0 the sea camera .. 1 the follow cam, eased as the view switches. */
  get low(): number {
    return this.chase.eased;
  }

  setZoom(zoom: number) {
    this.zoom = clamp(zoom, TUNING.camera.zoomMin, TUNING.camera.zoomMax);
  }

  /**
   * The next frame places the camera where it is heading at once, with `chase` in the chase view
   * behind the boat (`npm run shots -- --chase`).
   */
  jump(chase = false) {
    this.jumpNext = true;
    if (chase) Object.assign(this.chase, { active: true, blend: 1 });
  }

  /** Look at a map point, `shift` off centre in screen fractions (x right, y down), or null. */
  setFocus(point: { x: number; y: number } | null, jump: boolean, shift: { x: number; y: number }) {
    this.focus = point ? { ...point } : null;
    this.focusShift = { ...shift };
    // At once, without the camera's easing (the screenshot tool's --look).
    if (point && jump) this.target.set(point.x, 0, -point.y);
  }

  /**
   * Place the camera for a boat at scene `pos` heading `dir` (sim x east, y north) at `speedKn`,
   * heeled `heel` radians; a focus view eases the turned camera back north-up. Returns the
   * distance fog and the far view are set by.
   */
  place(
    dt: number,
    aspect: number,
    pos: THREE.Vector3,
    dir: { x: number; y: number },
    speedKn: number,
    heel = 0,
  ) {
    const c = TUNING.camera;
    const chase = this.chase;
    this.orbit.held = this.focus !== null;
    this.orbit.update(dt);
    const boatHeading = Math.atan2(dir.x, dir.y);
    chase.update(dt, boatHeading, this.focus === null, speedKn, heel);
    if (this.jumpNext) chase.snap(boatHeading, speedKn, heel);
    const b = chase.eased;
    const chaseHeading = chase.heading + chase.yaw;
    const heading = this.orbit.heading + b * wrapAngle(chaseHeading - this.orbit.heading);
    const axes = viewAxes(heading, this.axes);
    const ahead = lerp(speedKn * c.aheadPerKn, c.chase.lookAhead, b);
    // The field of view is vertical, so a tall phone sees a thin strip of sea: pull back until
    // portrait shows about as much water across as a landscape tablet (Guillaume, 2026-10-20).
    const portrait = aspect < 1 ? clamp(c.portraitWidth / aspect, 1, c.portraitPullMax) : 1;
    const seaDist = c.distance * this.zoom * portrait;
    // Fog and the far view follow the sea camera's distance, so the close view keeps the horizon.
    const sightDist = lerp(seaDist, c.chase.sightDistance, b);
    const sight = TUNING.weather.sight.far * sightDist;
    const frame = chase.frame(TUNING.weather.sight.far * c.chase.sightDistance, this.chaseFrame);
    this.setFov(lerp(this.seaFov, frame.fov / DEG, b));
    this.followTarget(dt, aspect, pos, dir, ahead, seaDist);
    const eye = this.seaEye(this.orbit.pitch, seaDist);
    const look = this.look.copy(this.target);
    if (b > 0) {
      this.chaseEye(pos, frame);
      eye.lerp(this.chasePos, b);
      look.lerp(this.chaseLook, b);
    }
    this.camera.position.copy(eye);
    // Above the sea the screen's up is the view heading on the ground, so a camera straight down
    // still knows it; the follow cam stands upright.
    this.camera.up.set(axes.forwardX * (1 - b), b, axes.forwardZ * (1 - b));
    this.camera.lookAt(look);
    this.centreSea(eye, look, sight);
    return sightDist;
  }

  /** The point on the sea the sea camera looks at, eased after the boat or the focus. */
  private followTarget(
    dt: number,
    aspect: number,
    pos: THREE.Vector3,
    dir: { x: number; y: number },
    ahead: number,
    dist: number,
  ) {
    const axes = this.axes;
    const pitch = this.orbit.pitch;
    // A shifted focus: the ground the screen spans around the target, the tilt foreshortening it
    // top to bottom.
    const fov = this.seaFov * DEG;
    const sx = this.focusShift.x * 2 * dist * Math.tan(fov / 2) * aspect;
    const sy = (this.focusShift.y * 2 * dist * Math.tan(fov / 2)) / Math.sin(pitch);
    const tx = this.focus
      ? this.focus.x - sx * axes.rightX + sy * axes.forwardX
      : pos.x + dir.x * ahead;
    const tz = this.focus
      ? -this.focus.y - sx * axes.rightZ + sy * axes.forwardZ
      : pos.z - dir.y * ahead;
    const target = this.target;
    const rate = TUNING.camera.followRate;
    if (this.jumpNext) target.set(tx, 0, tz);
    this.jumpNext = false;
    target.x = approach(target.x, tx, rate, dt);
    target.z = approach(target.z, tz, rate, dt);
  }

  /** The sea camera's eye: back from the target along the view, `dist` away at `pitch`. */
  private seaEye(pitch: number, dist: number): THREE.Vector3 {
    const back = Math.cos(pitch) * dist;
    const axes = this.axes;
    return this.eyeAt.set(
      this.target.x - axes.forwardX * back,
      Math.sin(pitch) * dist,
      this.target.z - axes.forwardZ * back,
    );
  }

  /**
   * The follow cam's eye and look point (issue #537): above and behind the boat's centre at the
   * frame's elevation and distance, slid to her high side, looking down the frame's pitch.
   */
  private chaseEye(pos: THREE.Vector3, frame: ChaseFrame) {
    const axes = this.axes;
    const { elevation, pitch, distance } = frame;
    const back = Math.cos(elevation) * distance;
    const side = this.chase.side;
    const eye = this.chasePos.set(
      pos.x - axes.forwardX * back + axes.rightX * side,
      TUNING.camera.chase.aimHeight + Math.sin(elevation) * distance,
      pos.z - axes.forwardZ * back + axes.rightZ * side,
    );
    const out = Math.cos(pitch) * distance;
    this.chaseLook.set(
      eye.x + axes.forwardX * out,
      eye.y - Math.sin(pitch) * distance,
      eye.z + axes.forwardZ * out,
    );
  }

  /** The ocean grid centres on the middle of the sea on screen (decision 0223). */
  private centreSea(eye: THREE.Vector3, look: THREE.Vector3, sight: number) {
    const axes = this.axes;
    const run = Math.hypot(look.x - eye.x, look.z - eye.z);
    const pitch = Math.atan2(eye.y - look.y, run);
    const middle = seaAhead(eye.y, pitch, this.camera.fov * DEG, sight);
    this.seaCentre.set(eye.x + axes.forwardX * middle, 0, eye.z + axes.forwardZ * middle);
  }

  /** The follow cam sees wider than the sea camera; the projection changes only when it does. */
  private setFov(fov: number) {
    if (Math.abs(this.camera.fov - fov) < 1e-3) return;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }
}
