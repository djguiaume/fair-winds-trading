import { trueWindAngle } from '../sim/boat';
import { TUNING } from '../data/tuning';
import { DEG, clamp, wrapAngle } from '../sim/math';
import { type ShipClass, noGoAngle } from '../sim/ship';
import { type Wind, windTo } from '../sim/wind';
import type { World } from '../sim/world';
import { HEEL_FEEL, Heel, type HeelInput, heelFactor } from './heel';
import type { BoatPose } from './models/types';

/**
 * The rig's pose from the simulation each frame: boom, luff and heel (decision 0044), with a
 * crash's knock shaken by `share` (Settings › Gentle sea motion, decision 0250), and the helm.
 * The boom swings across at a sailor's pace in a tack or gybe (issue #553) instead of jumping.
 * One pose object, reused, so a frame allocates nothing.
 */
export class RigPose {
  private readonly heel = new Heel();
  private readonly input: HeelInput = {
    twa: 0,
    noGoAngle: 0,
    windKn: 0,
    sail: 0,
    luff: 0,
    factor: 1,
  };
  private readonly pose: BoatPose = {
    sail: 0,
    boomAngle: 0,
    luff: 0,
    heel: 0,
    windRelative: 0,
    time: 0,
    rudder: 0,
  };
  /** The boom's drawn angle; NaN until the first frame (and after a ship change) snaps it. */
  private boom = NaN;

  /** Her heel last frame (radians, as `BoatPose.heel`): the follow cam slides to her high side. */
  get lean(): number {
    return this.heel.angle;
  }

  /** How readily the ship being sailed leans (decision 0044). */
  setShip(id: string) {
    this.input.factor = heelFactor(id);
    this.boom = NaN;
  }

  update(
    boat: World['boat'],
    wind: Wind,
    ship: ShipClass,
    time: number,
    dt: number,
    lowDetail: boolean,
    share: number,
  ): BoatPose {
    const twa = trueWindAngle(boat.heading, wind);
    const abs = Math.abs(twa);
    const lee = twa > 0 ? -1 : 1;
    const noGo = noGoAngle(ship);
    const boomMag = (12 + clamp((abs / DEG - 45) / 135, 0, 1) * 68) * DEG;
    const luff = 1 - clamp((abs - noGo * 0.8) / (noGo * 0.3), 0, 1);
    const input = this.input;
    input.twa = twa;
    input.noGoAngle = noGo;
    input.windKn = wind.speedKn;
    input.sail = boat.sail;
    input.luff = luff;
    const heel = this.heel.update(input, dt, HEEL_FEEL[lowDetail ? 'smooth' : 'lively']);
    const shake =
      boat.sinceBump < 0.4 ? Math.sin(time * 60) * (0.4 - boat.sinceBump) * 0.4 * share : 0;
    const pose = this.pose;
    pose.sail = boat.sail;
    pose.boomAngle = this.swing(lee * boomMag * (1 - luff * 0.7), dt);
    pose.rudder = boat.rudder;
    pose.luff = luff;
    pose.heel = heel + shake;
    pose.windRelative = wrapAngle(windTo(wind) - boat.heading);
    pose.time = time;
    return pose;
  }

  /** The boom eased toward `target` at most `closeUp.boomSwingDegPerSec`: a gybe swings across. */
  private swing(target: number, dt: number) {
    const step = TUNING.graphics.closeUp.boomSwingDegPerSec * DEG * dt;
    this.boom = Number.isNaN(this.boom)
      ? target
      : this.boom + clamp(target - this.boom, -step, step);
    return this.boom;
  }
}
