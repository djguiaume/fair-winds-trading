import { DEG, clamp } from './math';

/**
 * A ship class: everything that makes one hull sail differently from another. Phase 1 has the
 * sloop and the cutter; Phase 3 adds bigger ships (bigger hold, worse upwind) as new entries.
 * See docs/sailing-model.md for what each number does and how to tune it.
 */
export interface ShipClass {
  id: string;
  name: string;
  /** Half-width of the no-go zone: closer than this to the wind, the sails cannot draw. */
  noGoAngle: number;
  /** Polar curve: [true wind angle in degrees, fraction of top speed], sorted by angle. */
  polar: ReadonlyArray<readonly [number, number]>;
  /** Boat speed at best point of sail = windKn × speedRatio (full sails). */
  speedRatio: number;
  /** How fast the boat picks up speed (1/s). */
  accel: number;
  /** How fast it coasts down when the target speed drops (1/s); low = carries way through a tack. */
  decel: number;
  /** Extra braking when pointing into the wind ("in irons"), 1/s. */
  ironsDecel: number;
  /** Max turn rate at full steerage (rad/s). */
  turnRate: number;
  /** Fraction of the turn rate available when stopped (arcade: you can always turn a bit). */
  minSteerage: number;
  /** Boat speed (kn) at which the rudder reaches full steerage. */
  steerageSpeedKn: number;
  /** Speed lost while turning hard (1/s at full rudder). */
  turnDrag: number;
  /** Sideways drift downwind, as a fraction of wind speed. */
  leeway: number;
  /** Collision radius (units). */
  radius: number;
  /** How deep the hull sits, relative: scales the drag of shallow water (decision 0032). */
  draft: number;
  /** Cargo capacity in units of goods, before hold upgrades. */
  hold: number;
  /** Shipyard price in gold (0 for the starter ship). */
  price: number;
  /** Shipyard price of upgrade level 2 and level 3, the same for each track (decision 0011). */
  upgradePrices: readonly [number, number];
}

export const SLOOP: ShipClass = {
  id: 'sloop',
  name: 'Sloop',
  noGoAngle: 45 * DEG,
  polar: [
    [0, 0],
    [45, 0.42],
    [55, 0.68],
    [70, 0.88],
    [95, 1],
    [125, 0.93],
    [155, 0.8],
    [180, 0.7],
  ],
  speedRatio: 0.62,
  accel: 0.55,
  decel: 0.3,
  ironsDecel: 0.9,
  turnRate: 62 * DEG,
  minSteerage: 0.4,
  steerageSpeedKn: 4,
  turnDrag: 0.18,
  leeway: 0.045,
  radius: 4.5,
  draft: 0.7,
  hold: 10,
  price: 0,
  upgradePrices: [400, 1200],
};

/**
 * Second ship of Phase 1 (decision 0011): a narrower no-go zone (points higher into the wind), a
 * touch more speed, a bigger hold, but a heavier helm than the sloop.
 */
export const CUTTER: ShipClass = {
  id: 'cutter',
  name: 'Cutter',
  noGoAngle: 40 * DEG,
  polar: [
    [0, 0],
    [40, 0.45],
    [50, 0.72],
    [65, 0.9],
    [95, 1],
    [125, 0.92],
    [155, 0.78],
    [180, 0.68],
  ],
  speedRatio: 0.66,
  accel: 0.5,
  decel: 0.28,
  ironsDecel: 0.9,
  turnRate: 56 * DEG,
  minSteerage: 0.4,
  steerageSpeedKn: 4.5,
  turnDrag: 0.18,
  leeway: 0.04,
  radius: 5,
  draft: 1,
  hold: 16,
  price: 1500,
  upgradePrices: [600, 1800],
};

export const SHIP_CLASSES: Record<string, ShipClass> = { sloop: SLOOP, cutter: CUTTER };

/**
 * Fraction of top speed (0..1) at true wind angle `twa` (radians, 0 = head to wind, π = dead
 * downwind). Zero inside the no-go zone, linear between polar points outside it.
 */
export function polarFraction(ship: ShipClass, twa: number): number {
  const a = Math.abs(twa);
  if (a < ship.noGoAngle) return 0;
  const deg = clamp(a / DEG, 0, 180);
  const pts = ship.polar;
  for (let i = 1; i < pts.length; i++) {
    const [a1, f1] = pts[i]!;
    if (deg <= a1) {
      const [a0, f0] = pts[i - 1]!;
      return f0 + ((f1 - f0) * (deg - a0)) / (a1 - a0 || 1);
    }
  }
  return pts[pts.length - 1]![1];
}

export type PointOfSail = 'in-irons' | 'close-hauled' | 'beam-reach' | 'broad-reach' | 'running';

export function pointOfSail(ship: ShipClass, twa: number): PointOfSail {
  const deg = Math.abs(twa) / DEG;
  if (Math.abs(twa) < ship.noGoAngle) return 'in-irons';
  if (deg < 70) return 'close-hauled';
  if (deg < 115) return 'beam-reach';
  if (deg < 160) return 'broad-reach';
  return 'running';
}
