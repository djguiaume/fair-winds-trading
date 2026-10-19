import { DEG, TAU, wrapPositive } from './math';

/** Wind at one moment. `from` is the compass bearing the wind blows FROM (sailors' convention). */
export interface Wind {
  from: number;
  speedKn: number;
}

/** Global wind settings for a map (Phase 0: one direction and strength for the whole sea). */
export interface WindConfig {
  fromDeg: number;
  speedKn: number;
  /** Relative strength of gusts, e.g. 0.15 = ±15 %. */
  gustiness: number;
  /** Maximum slow swing of the direction, in degrees. */
  shiftDeg: number;
}

/**
 * Wind at time `t` (seconds). Deterministic: a sum of slow sines, so the same map always has the
 * same breeze. Gusts and a small direction swing make the sea feel alive without changing the
 * route: real wind shifts over time arrive in Phase 1.
 */
export function windAt(config: WindConfig, t: number): Wind {
  const gust =
    0.6 * Math.sin((t * TAU) / 23) +
    0.3 * Math.sin((t * TAU) / 9.7 + 1.3) +
    0.1 * Math.sin(t * 1.9);
  const swing = Math.sin((t * TAU) / 61) * 0.7 + Math.sin((t * TAU) / 17 + 0.4) * 0.3;
  return {
    from: wrapPositive((config.fromDeg + swing * config.shiftDeg) * DEG),
    speedKn: config.speedKn * (1 + gust * config.gustiness),
  };
}

/** Compass bearing the wind blows TOWARD. */
export function windTo(wind: Wind): number {
  return wrapPositive(wind.from + Math.PI);
}
