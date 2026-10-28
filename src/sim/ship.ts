import { TUNING } from '../data/tuning';
import { DEG, clamp } from './math';

/** Ship lines of decision 0035: the starter, then three lines of three tiers each. */
export type ShipLine = 'starter' | 'swift' | 'hauler' | 'racer' | 'warship';

/**
 * A ship class: everything that makes one hull sail differently from another. The sloop starts,
 * then the swift and hauler lines of decision 0035 (the warship line waits for Phase 5).
 * See docs/sailing-model.md for what each number does and how to tune it; the numbers are in
 * `src/data/ships/<id>.json` (decision 0109): `sailing` and `unlock`.
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
  /**
   * A regatta series (`regatta.json`) that must be won before its yard sells this class; until
   * then it is not offered at all (decision 0228).
   */
  series?: string;
  /** Half-width of the no-go zone in degrees: closer than this to the wind, the sails cannot draw. */
  noGoDeg: number;
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
  /** Max turn rate at full steerage (degrees per second). */
  turnRateDeg: number;
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
  /**
   * Quest cargo lashed on deck (decision 0213), in the quest items' `space` units, apart from the
   * hold; upgrades do not change it.
   */
  deck: number;
  /** Shipyard price in gold (0 for the starter ship). */
  price: number;
  /** Shipyard price of upgrade level 2 and level 3, the same for each track (decision 0011). */
  upgradePrices: readonly [number, number];
}

/** Ship class ids in shipyard order: starter, swift line, hauler line. One file each in
 * `src/data/ships/` (decision 0109). */
export const SHIP_IDS: readonly string[] = Object.keys(TUNING.ships);

/*
 * These are the live objects of `TUNING`, so a tuned value shows up everywhere at once. Speed and
 * turning of the swift and hauler lines follow the 0035 table relative to the sloop (speedRatio
 * 0.62 and turnRate 62° = 100); bigger hulls also pick up and lose way more slowly, need more
 * speed to steer and sit deeper in the shallows. Square riggers (fluyt, indiaman) peak on a broad
 * reach and keep more speed running downwind. The cutter (decision 0011) points higher than the
 * sloop, with a heavier helm.
 */
export const SLOOP: ShipClass = TUNING.ships.sloop!;
export const CUTTER: ShipClass = TUNING.ships.cutter!;
export const SCHOONER: ShipClass = TUNING.ships.schooner!;
export const CLIPPER: ShipClass = TUNING.ships.clipper!;
export const HOY: ShipClass = TUNING.ships.hoy!;
export const FLUYT: ShipClass = TUNING.ships.fluyt!;
export const INDIAMAN: ShipClass = TUNING.ships.indiaman!;

/** Every class the player can own, in shipyard order: starter, swift line, hauler line. */
export const SHIP_CLASSES: Record<string, ShipClass> = TUNING.ships;

/** Half-width of the no-go zone (radians). */
export function noGoAngle(ship: ShipClass): number {
  return ship.noGoDeg * DEG;
}

/** Max turn rate at full steerage (rad/s). */
export function turnRate(ship: ShipClass): number {
  return ship.turnRateDeg * DEG;
}

/**
 * Fraction of top speed (0..1) at true wind angle `twa` (radians, 0 = head to wind, π = dead
 * downwind). Zero inside the no-go zone, linear between polar points outside it.
 */
export function polarFraction(ship: ShipClass, twa: number): number {
  const a = Math.abs(twa);
  if (a < noGoAngle(ship)) return 0;
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
  if (Math.abs(twa) < noGoAngle(ship)) return 'in-irons';
  if (deg < 70) return 'close-hauled';
  if (deg < 115) return 'beam-reach';
  if (deg < 160) return 'broad-reach';
  return 'running';
}
