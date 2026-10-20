import { DEG, clamp } from './math';

/** Ship lines of decision 0035: the starter, then three lines of three tiers each. */
export type ShipLine = 'starter' | 'swift' | 'hauler' | 'warship';

/**
 * A ship class: everything that makes one hull sail differently from another. The sloop starts,
 * then the swift and hauler lines of decision 0035 (the warship line waits for Phase 5).
 * See docs/sailing-model.md for what each number does and how to tune it.
 */
export interface ShipClass {
  id: string;
  name: string;
  line: ShipLine;
  /** 0 for the starter, 1 to 3 within a line. */
  tier: number;
  /**
   * Deliveries completed at the port that builds this class before its shipwright will sell it
   * (decision 0048). 0 = on sale as soon as you reach the yard.
   */
  standing: number;
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
  line: 'starter',
  tier: 0,
  standing: 0,
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
  upgradePrices: [300, 900],
};

/**
 * Second ship of Phase 1 (decision 0011): a narrower no-go zone (points higher into the wind), a
 * touch more speed, a bigger hold, but a heavier helm than the sloop.
 */
export const CUTTER: ShipClass = {
  id: 'cutter',
  name: 'Cutter',
  line: 'swift',
  tier: 1,
  standing: 0,
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
  upgradePrices: [500, 1800],
};

/*
 * The rest of the swift and hauler lines (decision 0035). Speed and turning follow the 0035 table
 * relative to the sloop (speedRatio 0.62 and turnRate 62° = 100); bigger hulls also pick up and
 * lose way more slowly, need more speed to steer and sit deeper in the shallows. Square riggers
 * (fluyt, indiaman) peak on a broad reach and keep more speed running downwind.
 */

/** Tier 2 swift: two fore-and-aft masts, points highest of all, quick and nimble. */
export const SCHOONER: ShipClass = {
  id: 'schooner',
  name: 'Schooner',
  line: 'swift',
  tier: 2,
  standing: 3,
  noGoAngle: 38 * DEG,
  polar: [
    [0, 0],
    [38, 0.45],
    [48, 0.72],
    [62, 0.92],
    [95, 1],
    [125, 0.92],
    [155, 0.76],
    [180, 0.66],
  ],
  speedRatio: 0.775,
  accel: 0.5,
  decel: 0.26,
  ironsDecel: 0.85,
  turnRate: 68 * DEG,
  minSteerage: 0.38,
  steerageSpeedKn: 5,
  turnDrag: 0.17,
  leeway: 0.038,
  radius: 6.5,
  draft: 1.1,
  hold: 30,
  price: 5000,
  upgradePrices: [1500, 4500],
};

/** Tier 3 swift: three tall masts on a long slim hull, the fastest ship on the sea. */
export const CLIPPER: ShipClass = {
  id: 'clipper',
  name: 'Clipper',
  line: 'swift',
  tier: 3,
  standing: 6,
  noGoAngle: 40 * DEG,
  polar: [
    [0, 0],
    [40, 0.47],
    [50, 0.74],
    [65, 0.93],
    [100, 1],
    [130, 0.95],
    [160, 0.82],
    [180, 0.72],
  ],
  speedRatio: 0.9,
  accel: 0.46,
  decel: 0.24,
  ironsDecel: 0.85,
  turnRate: 65 * DEG,
  minSteerage: 0.35,
  steerageSpeedKn: 5.5,
  turnDrag: 0.16,
  leeway: 0.035,
  radius: 7,
  draft: 1.2,
  hold: 50,
  price: 20000,
  upgradePrices: [5000, 15000],
};

/** Tier 1 hauler: a beamy single-master, slow and broad but carries two and a half sloops. */
export const HOY: ShipClass = {
  id: 'hoy',
  name: 'Hoy',
  line: 'hauler',
  tier: 1,
  standing: 1,
  noGoAngle: 50 * DEG,
  polar: [
    [0, 0],
    [50, 0.38],
    [60, 0.62],
    [75, 0.85],
    [100, 1],
    [130, 0.95],
    [160, 0.82],
    [180, 0.74],
  ],
  speedRatio: 0.53,
  accel: 0.42,
  decel: 0.26,
  ironsDecel: 1,
  turnRate: 53 * DEG,
  minSteerage: 0.35,
  steerageSpeedKn: 4.5,
  turnDrag: 0.2,
  leeway: 0.05,
  radius: 5.2,
  draft: 1.2,
  hold: 25,
  price: 1800,
  upgradePrices: [700, 2100],
};

/** Square-rig polar shared by the big haulers: poor upwind, best on a broad reach. */
const SQUARE_POLAR: ShipClass['polar'] = [
  [0, 0],
  [55, 0.35],
  [65, 0.6],
  [80, 0.82],
  [105, 0.95],
  [135, 1],
  [160, 0.97],
  [180, 0.9],
];

/** Tier 2 hauler: a deep square-rigged merchantman. */
export const FLUYT: ShipClass = {
  id: 'fluyt',
  name: 'Fluyt',
  line: 'hauler',
  tier: 2,
  standing: 3,
  noGoAngle: 55 * DEG,
  polar: SQUARE_POLAR,
  speedRatio: 0.5,
  accel: 0.34,
  decel: 0.2,
  ironsDecel: 1.1,
  turnRate: 46 * DEG,
  minSteerage: 0.3,
  steerageSpeedKn: 5,
  turnDrag: 0.22,
  leeway: 0.055,
  radius: 8.5,
  draft: 1.5,
  hold: 60,
  price: 7000,
  upgradePrices: [2000, 6000],
};

/** Tier 3 hauler: the giant. Slowest to turn, deepest hull, a hold of a dozen sloops. */
export const INDIAMAN: ShipClass = {
  id: 'indiaman',
  name: 'Indiaman',
  line: 'hauler',
  tier: 3,
  standing: 6,
  noGoAngle: 55 * DEG,
  polar: SQUARE_POLAR,
  speedRatio: 0.53,
  accel: 0.3,
  decel: 0.18,
  ironsDecel: 1.1,
  turnRate: 43 * DEG,
  minSteerage: 0.3,
  steerageSpeedKn: 5.5,
  turnDrag: 0.22,
  leeway: 0.05,
  radius: 9.5,
  draft: 1.8,
  hold: 120,
  price: 25000,
  upgradePrices: [6000, 18000],
};

/** Every class the player can own, in shipyard order: starter, swift line, hauler line. */
export const SHIP_CLASSES: Record<string, ShipClass> = {
  sloop: SLOOP,
  cutter: CUTTER,
  schooner: SCHOONER,
  clipper: CLIPPER,
  hoy: HOY,
  fluyt: FLUYT,
  indiaman: INDIAMAN,
};

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
