import { TUNING } from '../data/tuning';
import { approach } from '../sim/math';

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
  private rise = 0;

  /** The share of the sea's pitch, roll and knocks a ship shows (her ride: `boatRide.ts`). */
  get share() {
    return this.gentle ? TUNING.waves.motion.gentle : 1;
  }

  /** How far the camera rises this frame with the sea `under` the boat; 0 with the switch off. */
  cameraRise(dt: number, under: number): number {
    const { cameraBob, cameraEase } = TUNING.waves.motion;
    const want = this.cameraBob ? under * cameraBob * this.share : 0;
    this.rise = approach(this.rise, want, cameraEase, dt);
    return this.rise;
  }
}
