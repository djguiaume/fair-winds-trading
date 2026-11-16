import { TUNING } from '../data/tuning';

/** What Auto asks the game to do after a measured window (issue #549). */
export type AutoStep = { scale: number } | 'lower' | 'raise';

const FRAMES = 512;

/**
 * Auto quality. Frames are judged by their 95th percentile over a short window, not their average.
 * A slow window first moves the render scale down inside the level, in small steps to a floor;
 * only a scale held at the floor drops a level. A long calm spell steps the scale back up, then
 * the level (each drop doubles the calm a climb needs, so it cannot flap). The numbers live in
 * `graphics.json › auto`.
 */
export class AutoQuality {
  /** Drawing resolution inside the level, `auto.scaleFloor` .. 1. */
  scale = 1;
  /** Average frame rate and 95th percentile frame time of the last window, for the HUD and `?perf`. */
  fps = 60;
  p95Ms = 0;
  private readonly frames = new Float32Array(FRAMES);
  private count = 0;
  private sum = 0;
  private wait = TUNING.graphics.auto.firstSec;
  private atFloorSec = 0;
  private calmSec = 0;
  private drops = 0;

  /**
   * `canLower`: a level below this one exists; `canRaise`: a level above is allowed (the session's
   * first level is the ceiling).
   */
  sample(dt: number, canLower: boolean, canRaise: boolean): AutoStep | null {
    const auto = TUNING.graphics.auto;
    this.wait -= dt;
    this.sum += dt;
    if (this.count < FRAMES) this.frames[this.count++] = dt;
    if (this.sum < auto.windowSec) return null;
    const windowSec = this.sum;
    this.measure();
    const slow = this.p95Ms > 1000 / auto.minFps;
    const calm = this.p95Ms < 1000 / auto.calmFps;
    this.atFloorSec = slow && this.scale <= auto.scaleFloor ? this.atFloorSec + windowSec : 0;
    this.calmSec = calm ? this.calmSec + windowSec : 0;
    if (this.wait > 0) return null;
    if (slow) return this.lessWork(canLower);
    return this.moreWork(canRaise);
  }

  private measure() {
    const sorted = this.frames.subarray(0, this.count).sort();
    this.p95Ms = sorted[Math.min(this.count - 1, Math.floor(this.count * 0.95))]! * 1000;
    this.fps = this.count / this.sum;
    this.sum = 0;
    this.count = 0;
  }

  private lessWork(canLower: boolean): AutoStep | null {
    const auto = TUNING.graphics.auto;
    if (this.scale > auto.scaleFloor) return this.moveScale(this.scale - auto.scaleStep);
    if (!canLower || this.atFloorSec < auto.floorHoldSec) return null;
    this.drops++;
    this.scale = 1;
    return this.settle('lower');
  }

  private moreWork(canRaise: boolean): AutoStep | null {
    const auto = TUNING.graphics.auto;
    if (this.scale < 1) {
      if (this.calmSec < auto.calmSec) return null;
      return this.moveScale(this.scale + auto.scaleStep);
    }
    if (!canRaise || this.calmSec < auto.climbSec * 2 ** Math.min(this.drops, 4)) return null;
    // A costlier level starts at the floor and earns its resolution back.
    this.scale = auto.scaleFloor;
    return this.settle('raise');
  }

  private moveScale(next: number): AutoStep {
    const auto = TUNING.graphics.auto;
    this.scale = Math.min(1, Math.max(auto.scaleFloor, Math.round(next * 100) / 100));
    return this.settle({ scale: this.scale });
  }

  private settle(step: AutoStep): AutoStep {
    this.wait = TUNING.graphics.auto.cooldownSec;
    this.calmSec = 0;
    this.atFloorSec = 0;
    return step;
  }
}
