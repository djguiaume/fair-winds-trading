import type { Daylight } from '../sim/daylight';

/** One look per light: the sea and sky in bright day, golden dusk, moonlit night and a storm. */
export interface LookSet<T> {
  day: T;
  golden: T;
  night: T;
  storm: T;
}

/** Writes `a` blended toward `b` by `k` (0..1) into `out`, which may be `a`, and returns it. */
export type MixLooks<T> = (out: T, a: T, b: T, k: number) => T;

/**
 * Day → golden → night, then the storm on top (decisions 0067, 0068): a storm at night stays dark
 * blue-grey. The atmosphere's colours and the drawn sky's (issue #470) blend alike through this.
 * `storm` is scratch space for the storm's own look at this hour.
 */
export function blendLooks<T>(
  mix: MixLooks<T>,
  out: T,
  storm: T,
  looks: Readonly<LookSet<T>>,
  day: Readonly<Daylight>,
  gloom: number,
): T {
  mix(out, looks.day, looks.golden, day.warm * (1 - day.night));
  mix(out, out, looks.night, day.night);
  mix(storm, looks.storm, looks.night, day.night * 0.7);
  return mix(out, out, storm, gloom);
}
