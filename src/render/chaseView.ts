import { TUNING } from '../data/tuning';
import { approach, clamp, wrapAngle } from '../sim/math';

/**
 * The optional close chase view: the camera sits behind and just above the boat and turns with it.
 * This holds only its state (on or off, how far the switch has eased, the smoothed heading and
 * the player's zoom); `CameraRig` places the camera from it. Numbers: `camera.json` › `chase`.
 */
export class ChaseView {
  /** The player switched the view on. */
  active = false;
  /** 0 = the sea camera, 1 = the chase camera; eases between the two. */
  blend = 0;
  /** The compass bearing the chase camera looks toward, trailing the boat's heading. */
  heading = 0;
  /** 1 = default; larger = farther behind the boat. */
  zoom = 1;
  /** How far a pinch has pushed past the zoom limit (log of the pinch factors), toward a switch. */
  private overshoot = 0;

  toggle() {
    this.active = !this.active;
    this.overshoot = 0;
  }

  /** `wanted` is false while another view (the home island focus) needs the sea camera. */
  update(dt: number, boatHeading: number, wanted: boolean) {
    const c = TUNING.camera.chase;
    this.blend = approach(this.blend, this.active && wanted ? 1 : 0, c.blendRate, dt);
    if (this.blend < 0.001) this.blend = 0;
    else if (this.blend > 0.999) this.blend = 1;
    // Off, the heading rests on the boat so the view starts straight behind it.
    if (this.blend === 0) this.heading = boatHeading;
    else this.heading += wrapAngle(boatHeading - this.heading) * (1 - Math.exp(-c.turnRate * dt));
  }

  /** The switch as a smooth 0..1 curve, so the move starts and ends gently. */
  get eased(): number {
    return this.blend * this.blend * (3 - 2 * this.blend);
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
}
