/**
 * Wind strength the player can read (decision 0040): five named steps for the wind the boat
 * feels, with a little hysteresis so gusts near a boundary don't make the gauge flicker, and a
 * short "gust" cue when the wind jumps above its recent average.
 */

/** 0 calm, 1 light, 2 breeze, 3 fresh, 4 strong. */
export type WindForce = 0 | 1 | 2 | 3 | 4;

export const WIND_FORCES = ['calm', 'light', 'breeze', 'fresh', 'strong'] as const;
export type WindForceName = (typeof WIND_FORCES)[number];

/** Lower bound in knots of forces 1..4 (calm is everything below 7 kn). */
export const FORCE_THRESHOLDS_KN: readonly number[] = [7, 11, 15, 19];
/** Knots the wind must move past a boundary before the step changes. */
export const FORCE_HYSTERESIS_KN = 0.6;

/** Force for a wind speed, without memory. */
export function windForce(speedKn: number): WindForce {
  let f = 0;
  for (const t of FORCE_THRESHOLDS_KN) if (speedKn >= t) f++;
  return f as WindForce;
}

/** Force for a wind speed, staying on `previous` until the speed is clearly past a boundary. */
export function windForceSticky(speedKn: number, previous: WindForce): WindForce {
  const lo = previous > 0 ? FORCE_THRESHOLDS_KN[previous - 1]! - FORCE_HYSTERESIS_KN : -Infinity;
  const hi = previous < 4 ? FORCE_THRESHOLDS_KN[previous]! + FORCE_HYSTERESIS_KN : Infinity;
  return speedKn >= lo && speedKn < hi ? previous : windForce(speedKn);
}

/** 0..1 across the playable range (5 kn → 0, 21 kn → 1), for scaling effects smoothly. */
export function windStrength01(speedKn: number): number {
  return Math.min(1, Math.max(0, (speedKn - 5) / 16));
}

/** Seconds the gust cue stays up. */
const GUST_HOLD = 1.6;
/** Knots above the recent average that count as a gust. */
const GUST_JUMP_KN = 1.4;
/** Time constant (s) of the recent average. */
const AVERAGE_TAU = 5;

export interface WindGauge {
  force: WindForce;
  /** Recent average speed (kn). */
  average: number;
  /** Seconds left on the gust cue; > 0 means show it. */
  gust: number;
}

export function createWindGauge(speedKn: number): WindGauge {
  return { force: windForce(speedKn), average: speedKn, gust: 0 };
}

/** Advance the gauge by `dt` seconds with the wind the boat feels now. */
export function updateWindGauge(g: WindGauge, speedKn: number, dt: number): WindGauge {
  const k = 1 - Math.exp(-dt / AVERAGE_TAU);
  const average = g.average + (speedKn - g.average) * k;
  const gust = speedKn - average >= GUST_JUMP_KN ? GUST_HOLD : Math.max(0, g.gust - dt);
  return { force: windForceSticky(speedKn, g.force), average, gust };
}
