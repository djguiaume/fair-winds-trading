import { type Play, envelope, filter, noise } from './nodes';

/**
 * The rigging's own sounds, heard in the follow cam (issue #555): a block rattle on a tack and the
 * watch that tells when a gust is strong enough to make the rig groan.
 */

/** Blocks and sheets clattering as the boom swings over: a few dry clicks, uneven, dying away. */
export const playRattle: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.02;
  const band = filter(ctx, 'bandpass', 2400 * pitch, 3);
  const out = ctx.createGain();
  out.gain.value = 1;
  band.connect(out).connect(destination);
  for (const [at, k] of [
    [0, 1],
    [0.07, 0.8],
    [0.15, 0.9],
    [0.22, 0.5],
    [0.34, 0.65],
    [0.41, 0.3],
    [0.55, 0.2],
  ] as const) {
    const click = envelope(ctx, t + at, level * k, 0.004, t + at + 0.05);
    noise(ctx, t + at, t + at + 0.06)
      .connect(click)
      .connect(band);
  }
};

export const RIGGING_SYNTHS = { rattle: playRattle } satisfies Record<string, Play>;

/** How slowly the wind's average follows the wind, seconds: a gust is what rises over it. */
const AVERAGE_SECS = 4;

/** Tells when the wind gusts: it climbs `gustKn` over its own slow average, at most once in `every`. */
export class GustWatch {
  private average: number | null = null;
  private quiet = 0;

  /** Feed the wind speed every `dt` seconds; true once as a gust arrives. */
  step(dt: number, windKn: number, gustKn: number, every: number): boolean {
    const avg = this.average ?? windKn;
    this.average = avg + (windKn - avg) * (1 - Math.exp(-dt / AVERAGE_SECS));
    this.quiet += dt;
    if (windKn - avg < gustKn || this.quiet < every) return false;
    this.quiet = 0;
    return true;
  }
}
