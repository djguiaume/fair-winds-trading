import { TUNING } from '../data/tuning';

/**
 * Wind strength the player can read (decision 0040): five named steps for the wind the boat
 * feels, with a little hysteresis so gusts near a boundary don't make the gauge flicker, and a
 * short "gust" cue when the wind jumps above its recent average.
 */

/** 0 calm, 1 light, 2 breeze, 3 fresh, 4 strong. */
export type WindForce = 0 | 1 | 2 | 3 | 4;

export const WIND_FORCES = ['calm', 'light', 'breeze', 'fresh', 'strong'] as const;
export type WindForceName = (typeof WIND_FORCES)[number];

/*
 * `src/data/tuning/weather.json` › `force` (decision 0094): `thresholdsKn`, the lower bound in
 * knots of forces 1..4 (calm is everything below 7 kn); `hysteresisKn`, knots the wind must move
 * past a boundary before the step changes; the gust cue stays up `gustHoldSec` seconds once the
 * wind is `gustJumpKn` above its recent average, taken over `averageSec` seconds.
 */
const force = () => TUNING.weather.force;

/** Force for a wind speed, without memory. */
export function windForce(speedKn: number): WindForce {
  let f = 0;
  for (const t of force().thresholdsKn) if (speedKn >= t) f++;
  return f as WindForce;
}

/** Force for a wind speed, staying on `previous` until the speed is clearly past a boundary. */
export function windForceSticky(speedKn: number, previous: WindForce): WindForce {
  const { thresholdsKn, hysteresisKn } = force();
  const lo = previous > 0 ? thresholdsKn[previous - 1]! - hysteresisKn : -Infinity;
  const hi = previous < 4 ? thresholdsKn[previous]! + hysteresisKn : Infinity;
  return speedKn >= lo && speedKn < hi ? previous : windForce(speedKn);
}

/** 0..1 across the playable range (5 kn → 0, 21 kn → 1), for scaling effects smoothly. */
export function windStrength01(speedKn: number): number {
  return Math.min(1, Math.max(0, (speedKn - 5) / 16));
}

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

/**
 * Advance the gauge by `dt` seconds with the wind the boat feels now. It changes `g` in place and
 * returns it, so the HUD's every frame allocates nothing (issue #441).
 */
export function updateWindGauge(g: WindGauge, speedKn: number, dt: number): WindGauge {
  const { averageSec, gustJumpKn, gustHoldSec } = force();
  const k = 1 - Math.exp(-dt / averageSec);
  g.average += (speedKn - g.average) * k;
  g.gust = speedKn - g.average >= gustJumpKn ? gustHoldSec : Math.max(0, g.gust - dt);
  g.force = windForceSticky(speedKn, g.force);
  return g;
}
