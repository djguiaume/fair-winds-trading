import { drivingWind } from './boat';
import { DEG } from './math';
import { seaDrag } from './seaDrag';
import { createSeaState, steadySeaState } from './seaState';
import { type ShipClass, polarFraction } from './ship';

/** One wind the balance model times a leg in: from (radians) and strength (knots). */
export interface Weather {
  from: number;
  kn: number;
}

const legSea = createSeaState();

/**
 * Best speed made good along `bearing` (kn), sailing straight or tacking, in one wind and the sea
 * it raises once settled, the waves slowing her unless `waves` is off (decision 0256): the
 * balance model's leg speed.
 */
export function madeGoodIn(
  ship: ShipClass,
  bearing: number,
  from: number,
  kn: number,
  waves: boolean,
): number {
  const drive = drivingWind(kn) * ship.speedRatio;
  const sea = steadySeaState(from, kn, 0, legSea);
  let best = 0;
  for (let a = -180; a <= 180; a += 2) {
    const heading = bearing + a * DEG;
    const flat = polarFraction(ship, from - heading) * drive * Math.cos(a * DEG);
    best = Math.max(best, waves ? flat * (1 - seaDrag(ship, heading, sea)) : flat);
  }
  return best;
}

/** Best speed made good along `bearing` (kn), averaged over the weather. */
export function madeGood(ship: ShipClass, bearing: number, weather: Weather[], waves: boolean) {
  let sum = 0;
  for (const w of weather) sum += madeGoodIn(ship, bearing, w.from, w.kn, waves);
  return sum / weather.length;
}
