import { TUNING } from '../data/tuning';
import { DEG, approach, clamp, wrapAngle } from '../sim/math';
import { type ChaseFrame, type Framing, chaseFrame } from './chaseFrame';

/** Below this the follow cam counts as back behind the boat: the reset button hides. */
const HOME_EPSILON = 0.5 * DEG;

/** The camera button's stop for the sea camera above the boat, in `chase.cycle`. */
export const TOP_VIEW = 'top';

/** The views the camera button steps through, in order (`camera.json` › `chase.cycle`). */
export function cameraCycle(): string[] {
  return TUNING.camera.chase.cycle.split(',').map((id) => id.trim());
}

type FramingId = keyof typeof TUNING.camera.chase.framings;

/**
 * The optional close chase view: the camera sits behind and just above the boat and turns with it.
 * This holds only its state (on or off, how far the switch has eased, the smoothed heading, the
 * player's zoom and look round the boat, how fast she goes and how far she heels); `CameraRig`
 * places the camera from it. The camera button steps through the follow cam's framings and the
 * sea camera (decision 0312). Numbers: `camera.json` › `chase`.
 */
export class ChaseView {
  /** The player switched the view on. */
  active = false;
  /** The follow cam's framing in use (`chase.framings`). */
  framing: FramingId = firstFraming();
  /** The framing on screen, eased toward `framing` so a step of the camera button glides. */
  private readonly shown: Framing = { ...TUNING.camera.chase.framings[this.framing] };
  /** 0 = the sea camera, 1 = the chase camera; eases between the two. */
  blend = 0;
  /** The compass bearing the chase camera looks toward, trailing the boat's heading. */
  heading = 0;
  /** 1 = default; larger = farther behind the boat. */
  zoom = 1;
  /** The player's look round the boat (issue #536): + to the right of straight astern, radians. */
  yaw = 0;
  /** Steeper (+) or flatter (-) than the framing's rest, radians. */
  tilt = 0;
  /** 0 at rest .. 1 at full speed, eased so the camera never pumps. */
  pace = 0;
  /** How far the camera slides to the high side as she heels, scene units (+ to the right). */
  side = 0;
  /** The elevation the last frame rested at, before the player's tilt (radians). */
  private rest = 0;
  /** Seconds since the player last looked round. */
  private idle = 0;
  /** How far a pinch has pushed past the zoom limit (log of the pinch factors), toward a switch. */
  private overshoot = 0;

  toggle() {
    this.active = !this.active;
    this.overshoot = 0;
  }

  /** The view on screen as a cycle id: a framing of `chase.framings`, or `TOP_VIEW`. */
  get view(): string {
    return this.active ? this.framing : TOP_VIEW;
  }

  /** Switch to a cycle id (the saved sailing view, the camera button); unknown ids are ignored. */
  set view(id: string) {
    if (id === TOP_VIEW) {
      if (this.active) this.toggle();
      return;
    }
    if (!(id in TUNING.camera.chase.framings)) return;
    this.framing = id as FramingId;
    if (!this.active) this.toggle();
  }

  /** The camera button: on to the next view of the cycle, the sea camera or a framing. */
  cycle() {
    const views = cameraCycle();
    this.view = views[(views.indexOf(this.view) + 1) % views.length] ?? TOP_VIEW;
  }

  /**
   * `wanted` is false while another view (the home island focus) needs the sea camera; `heel` is
   * her heel in radians, as `BoatPose.heel`.
   */
  update(dt: number, boatHeading: number, wanted: boolean, speedKn = 0, heel = 0) {
    const c = TUNING.camera.chase;
    this.blend = approach(this.blend, this.active && wanted ? 1 : 0, c.blendRate, dt);
    if (this.blend < 0.001) this.blend = 0;
    else if (this.blend > 0.999) this.blend = 1;
    // Off, the heading rests on the boat so the view starts straight behind it.
    if (this.blend === 0) this.heading = boatHeading;
    else this.heading += wrapAngle(boatHeading - this.heading) * (1 - Math.exp(-c.turnRate * dt));
    this.easeFraming(this.blend === 0 ? 0 : dt);
    this.pace = approach(this.pace, paceAt(speedKn), 1 / c.speedEaseSec, dt);
    this.side = approach(this.side, sideAt(heel), 1 / c.speedEaseSec, dt);
    this.idle += dt;
    if (this.blend === 0 || this.idle > c.returnAfterSeconds) this.ease(dt);
  }

  /** Straight to the boat's heading, speed and heel, without easing (the screenshot tool). */
  snap(boatHeading: number, speedKn: number, heel: number) {
    this.heading = boatHeading;
    this.pace = paceAt(speedKn);
    this.side = sideAt(heel);
    this.easeFraming(0);
  }

  /** The switch as a smooth 0..1 curve, so the move starts and ends gently. */
  get eased(): number {
    return this.blend * this.blend * (3 - 2 * this.blend);
  }

  /** The player has looked away from straight astern: the reset button shows. */
  get turned(): boolean {
    return Math.abs(this.yaw) > HOME_EPSILON || Math.abs(this.tilt) > HOME_EPSILON;
  }

  /** The camera's angles and distance this frame, the sea ending `sight` away, into `out`. */
  frame(sight: number, out: ChaseFrame): ChaseFrame {
    chaseFrame(this.shown, this.pace, this.tilt, this.zoom, sight, out);
    this.rest = out.rest;
    return out;
  }

  /**
   * Look round the boat by these angles (radians): + heading looks more to the right, + pitch
   * looks steeper. The yaw is free; the tilt stays inside the orbit limits.
   */
  turn(heading: number, pitch = 0) {
    if (!this.active || (heading === 0 && pitch === 0)) return;
    const c = TUNING.camera.chase;
    const rest = this.rest;
    this.yaw = wrapAngle(this.yaw + heading);
    this.tilt = clamp(
      this.tilt + pitch,
      c.orbitPitchMinDeg * DEG - rest,
      c.orbitPitchMaxDeg * DEG - rest,
    );
    this.idle = 0;
  }

  /** Ease back behind the boat now, as if the player had let go a while ago. */
  reset() {
    this.idle = Infinity;
  }

  /** A zoom factor (< 1 closer) while in the chase view, within the zoom limits. */
  zoomBy(factor: number) {
    const c = TUNING.camera.chase;
    this.zoom = clamp(this.zoom * factor, c.zoomMin, c.zoomMax);
  }

  /**
   * A pinch of `factor` (< 1 fingers spreading) with the sea camera already `seaAtClosest`. Pinching
   * past the closest sea zoom switches to the chase view; pinching past the farthest chase zoom
   * switches back. Returns true when it switched, false when the caller should zoom as usual.
   */
  pinch(factor: number, seaAtClosest: boolean): boolean {
    const c = TUNING.camera.chase;
    const pastLimit = this.active
      ? factor > 1 && this.zoom >= c.zoomMax
      : factor < 1 && seaAtClosest;
    if (!pastLimit) {
      this.overshoot = 0;
      return false;
    }
    this.overshoot += Math.abs(Math.log(factor));
    if (this.overshoot < c.pinchSwitch) return false;
    this.toggle();
    return true;
  }

  /** The framing on screen glides to the chosen one over `dt`; a `dt` of 0 lands on it at once. */
  private easeFraming(dt: number) {
    const target = TUNING.camera.chase.framings[this.framing];
    const shown = this.shown;
    const rate = TUNING.camera.chase.blendRate;
    for (const key of FRAMING_KEYS)
      shown[key] = dt > 0 ? approach(shown[key], target[key], rate, dt) : target[key];
  }

  /** The look round eases back behind the boat, at the sea camera's reset rate. */
  private ease(dt: number) {
    const rate = TUNING.camera.resetRate;
    // The yaw stays in (-π, π], so easing it to 0 takes the short way round.
    this.yaw = approach(this.yaw, 0, rate, dt);
    this.tilt = approach(this.tilt, 0, rate, dt);
    if (this.turned) return;
    this.yaw = this.tilt = 0;
  }
}

const FRAMING_KEYS = Object.keys(TUNING.camera.chase.framings.b) as (keyof Framing)[];

/** The first follow-cam framing of the cycle, where `?perf&chase=1` and the shots start. */
function firstFraming(): FramingId {
  const framings = TUNING.camera.chase.framings;
  const id = cameraCycle().find((v) => v in framings) ?? 'b';
  return id as FramingId;
}

/** Her speed as a share of the follow cam's full speed, 0..1. */
function paceAt(speedKn: number): number {
  return clamp(speedKn / TUNING.camera.chase.fullSpeedKn, 0, 1);
}

/**
 * The camera's slide for a heel; `leeShiftPerDeg`'s sign puts it on her high side, so the sail leans
 * away from the way ahead.
 */
function sideAt(heel: number): number {
  const c = TUNING.camera.chase;
  return clamp((heel / DEG) * c.leeShiftPerDeg, -c.leeShiftMax, c.leeShiftMax);
}
