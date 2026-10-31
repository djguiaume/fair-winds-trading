import { TUNING } from '../data/tuning';
import { approach } from '../sim/math';

/** Where the boat floats: how high she rides and her pitch (radians, bow up positive). */
export interface BoatFloat {
  lift: number;
  pitch: number;
}

/**
 * How much the sea moves the boat and the camera (issue #286, decision 0250): two comfort
 * switches in Settings, drawing only. The boat's speed, course, grounding and races never read
 * them, so they cannot change a race or a voyage. Numbers in `waves.json › motion`.
 */
export class SeaMotion {
  /** Settings › Gentle sea motion: the boat rises, pitches and shakes less. */
  gentle = false;
  /** Settings › Camera rides the waves: off by default. */
  cameraBob = false;
  private rise = 0;

  /** The share of the sea's rise, pitch and knocks the boat shows. */
  get share() {
    return this.gentle ? TUNING.waves.motion.gentle : 1;
  }

  /** The boat on sea heights `front` at her bow and `back` at her stern, `span` apart. */
  float(front: number, back: number, span: number, out: BoatFloat): BoatFloat {
    const { heave, pitch } = TUNING.waves.motion;
    out.lift = ((front + back) / 2) * heave * this.share;
    out.pitch = Math.atan2(front - back, span) * pitch * this.share;
    return out;
  }

  /** How far the camera rises this frame with the sea `under` the boat; 0 with the switch off. */
  cameraRise(dt: number, under: number): number {
    const { cameraBob, cameraEase } = TUNING.waves.motion;
    const want = this.cameraBob ? under * cameraBob * this.share : 0;
    this.rise = approach(this.rise, want, cameraEase, dt);
    return this.rise;
  }
}
