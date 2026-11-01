/**
 * The compass's help for a boat held in the wind: brief tacks stay quiet; only sustained,
 * intentional sailing into the wind turns it amber, then pulses, then offers the help chip.
 * Kept as fields, not a fresh object each frame, so a frame at sea allocates nothing (#441).
 */
export class WindCue {
  /** How long she has been held in the wind with her sails up. */
  seconds = 0;
  amber = false;
  pulse = false;
  chip = false;

  /** `held`: in the no-go zone, sails raised, not moored, the game running. */
  update(dt: number, held: boolean): void {
    this.seconds = held ? this.seconds + dt : 0;
    this.amber = held;
    this.pulse = this.seconds >= 1.2;
    this.chip = this.seconds >= 3;
  }
}
