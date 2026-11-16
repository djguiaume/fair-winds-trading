import { TUNING } from '../data/tuning';
import { DEG, approach, clamp } from '../sim/math';

/**
 * How much the sea moves the boat and the camera (issue #286, decision 0250): two comfort
 * switches in Settings, drawing only. The boat's speed, course, grounding and races never read
 * them, so they cannot change a race or a voyage. Numbers in `waves.json › motion`.
 */
export class SeaMotion {
  /** Settings › Gentle sea motion: the boat pitches, rolls and shakes less. */
  gentle = false;
  /** Settings › Camera rides the waves: off by default. */
  cameraBob = false;
  /** Settings › Motion reduced or off: the follow cam neither leans nor rides the waves. */
  steady = false;
  private rise = 0;
  private lean = 0;

  /** The share of the sea's pitch, roll and knocks a ship shows (her ride: `boatRide.ts`). */
  get share() {
    return this.gentle ? TUNING.waves.motion.gentle : 1;
  }

  /** How far the camera rises this frame with the sea `under` the boat; 0 with the switch off. */
  cameraRise(dt: number, under: number): number {
    const { cameraBob, cameraEase } = TUNING.waves.motion;
    const want = this.cameraBob && !this.steady ? under * cameraBob * this.share : 0;
    this.rise = approach(this.rise, want, cameraEase, dt);
    return this.rise;
  }

  /**
   * How far the follow cam rolls with her `heel` this frame (issue #554), radians: a share of it,
   * a few degrees at most, eased slower than the heel itself; 0 when the player wants it steady.
   */
  cameraLean(dt: number, heel: number): number {
    const { cameraLean, cameraLeanMaxDeg, cameraLeanEase } = TUNING.waves.motion;
    const most = cameraLeanMaxDeg * DEG;
    const want = this.steady ? 0 : clamp(heel * cameraLean, -most, most);
    this.lean = approach(this.lean, want, cameraLeanEase, dt);
    return this.lean;
  }
}
