import { TUNING } from '../data/tuning';
import { DEG, approach, clamp } from '../sim/math';

/** How a ship rides the sea (issue #283): rise (units), pitch (bow up +) and roll (port down +). */
export interface RidePose {
  lift: number;
  pitch: number;
  roll: number;
}

/** Her waterline footprint in scene units (`BoatModel.wakeHull`, from her ship file's hull). */
export interface RideHull {
  length: number;
  beam: number;
}

/** What the sea is around her this frame, the same for every ship drawn. */
export interface RideConditions {
  /** The Gerstner waves are on (Settings › Waves); off, she only rises with the classic sea. */
  waves: boolean;
  /** Settings › Gentle sea motion's share of her pitch and roll (1 = full). */
  share: number;
  /** Storm strength 0..1 where she sails: the caps open by `ride.storm`. */
  storm: number;
}

/** The sea's height at a scene point (`SeaWaves.heightAt`). */
export type SeaHeight = (x: number, z: number) => number;

/**
 * The most a hull `length` metres long pitches and rolls (radians), in `out`: the art director's
 * caps for a small and a big ship (`waves.json › motion.ride`), between them by length, opened by
 * `ride.storm` in a full storm.
 */
export function rideCaps(length: number, storm: number, out: { pitch: number; roll: number }) {
  const { small, big, storm: opens } = TUNING.waves.motion.ride;
  const t = clamp((length - small.length) / Math.max(1e-6, big.length - small.length), 0, 1);
  const open = (1 + opens * clamp(storm, 0, 1)) * DEG;
  out.pitch = (small.pitchDeg + (big.pitchDeg - small.pitchDeg) * t) * open;
  out.roll = (small.rollDeg + (big.rollDeg - small.rollDeg) * t) * open;
  return out;
}

/** Follows `x` while it is small and never passes `cap`: no hard stop at the limit. */
const softCap = (x: number, cap: number) => (cap > 0 ? cap * Math.tanh(x / cap) : 0);

const finite = (x: number) => (Number.isFinite(x) ? x : 0);

/**
 * One ship's ride on the waves (issue #283), for drawing only: the sim's course, speed, grounding
 * and berths never read it. Four points of the shared sea (bow, stern and both sides, spaced by her
 * own hull) give her rise and the slopes she leans to; the slopes are smoothed over `tiltSec` so
 * she rolls with the swell, not every chop, and held under her caps. Driven by the world's time,
 * so it is the same at any frame rate and stops when the game does. At a berth the tilt eases out
 * over `dockSec`; the rise stays, so the hull never leaves the water. One object per ship, reused.
 */
export class BoatRide {
  readonly pose: RidePose = { lift: 0, pitch: 0, roll: 0 };
  private time = Number.NaN;
  private heave = 0;
  private pitch = 0;
  private roll = 0;
  /** Share of the tilt she keeps: 0 at a berth, 1 at sea. */
  private atSea = 1;
  private readonly caps = { pitch: 0, roll: 0 };

  update(
    sea: SeaHeight,
    x: number,
    z: number,
    heading: number,
    hull: RideHull,
    time: number,
    conditions: RideConditions,
    docked = false,
  ): RidePose {
    const motion = TUNING.waves.motion;
    const ride = motion.ride;
    // The first frame, or the clock turned back (a loaded voyage): take the sea as it is.
    const dt = time >= this.time ? time - this.time : Infinity;
    this.time = time;
    const bowX = Math.sin(heading),
      bowZ = -Math.cos(heading);
    const half = (hull.length * ride.bowStern) / 2,
      side = (hull.beam * ride.beam) / 2;
    const bow = sea(x + bowX * half, z + bowZ * half);
    const stern = sea(x - bowX * half, z - bowZ * half);
    // Starboard is the bow turned a quarter clockwise: (-bowZ, bowX) in the scene.
    const starboard = sea(x - bowZ * side, z + bowX * side);
    const port = sea(x + bowZ * side, z - bowX * side);

    this.atSea = approach(this.atSea, docked ? 0 : 1, 1 / ride.dockSec, dt);
    const tilt = conditions.waves ? conditions.share * this.atSea : 0;
    const level = ((bow + stern + starboard + port) / 4) * motion.heave;
    const pitch = Math.atan2(bow - stern, 2 * half) * motion.pitch * tilt;
    const roll = Math.atan2(starboard - port, 2 * side) * motion.roll * tilt;
    this.heave = approach(this.heave, finite(level), 1 / ride.heaveSec, dt);
    this.pitch = approach(this.pitch, finite(pitch), 1 / ride.tiltSec, dt);
    this.roll = approach(this.roll, finite(roll), 1 / ride.tiltSec, dt);

    const caps = rideCaps(hull.length, conditions.storm, this.caps);
    const pose = this.pose;
    pose.lift = this.heave;
    pose.pitch = softCap(this.pitch, caps.pitch);
    pose.roll = softCap(this.roll, caps.roll);
    return pose;
  }
}
