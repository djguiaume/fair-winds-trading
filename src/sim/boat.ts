import { TUNING } from '../data/tuning';
import { type ShipClass, noGoAngle, polarFraction, turnRate } from './ship';
import { type Wind, windTo } from './wind';
import { type Vec2, approach, bearingVector, clamp, wrapAngle, wrapPositive } from './math';

/*
 * `src/data/tuning/seamanship.json` › `boat` (decision 0094): `knotToUnits`, game-world units
 * travelled per second at 1 knot (arcade scale: boats feel brisk); `overpoweredKn`, above which
 * more wind barely adds speed, the crew spills it (decision 0067); `referenceBreezeKn`, the wind
 * used to quote a ship's top speed in the shipyard, the Windward Ring's normal breeze (0075).
 */
const boatTuning = () => TUNING.seamanship.boat;

/** Game-world units travelled per second at 1 knot. */
export function knotToUnits(): number {
  return boatTuning().knotToUnits;
}

/** Discrete sail settings the player switches between (furled, half, full). */
export const SAIL_STEPS = [0, 0.5, 1] as const;

export interface BoatState {
  x: number;
  y: number;
  /** Compass heading of the bow (radians). */
  heading: number;
  /** Speed through the water along the heading (knots). */
  speedKn: number;
  /** Index into SAIL_STEPS the player asked for. */
  sailStep: number;
  /** Actual sail area 0..1 (eases toward the requested step). */
  sail: number;
  /** Smoothed rudder -1 (port/left) .. 1 (starboard/right). */
  rudder: number;
  /** Leeway drift velocity (knots, world axes). */
  drift: Vec2;
  /** Seconds since the last collision (for visuals); Infinity when none yet. */
  sinceBump: number;
}

export interface BoatControls {
  /** -1 = turn left, 1 = turn right. */
  steer: number;
  /** Requested sail step index. */
  sailStep: number;
}

export function createBoat(x: number, y: number, heading: number): BoatState {
  return {
    x,
    y,
    heading: wrapPositive(heading),
    speedKn: 0,
    sailStep: SAIL_STEPS.length - 1,
    sail: 0,
    rudder: 0,
    drift: { x: 0, y: 0 },
    sinceBump: Infinity,
  };
}

/** True wind angle: 0 = bow straight into the wind, π = wind from dead astern. Signed: > 0 when
 * the wind comes over the starboard (right) side. */
export function trueWindAngle(heading: number, wind: Wind): number {
  return wrapAngle(wind.from - heading);
}

/** Wind that drives the boat: all of it up to `overpoweredKn`, a quarter of anything above. */
export function drivingWind(speedKn: number): number {
  const over = boatTuning().overpoweredKn;
  return speedKn <= over ? speedKn : over + (speedKn - over) * 0.25;
}

/** Top speed (knots) on the best point of sail, full sails, in `windKn` of true wind (by default
 * the shipyard's reference breeze). */
export function topSpeedKn(ship: ShipClass, windKn = boatTuning().referenceBreezeKn): number {
  return drivingWind(windKn) * ship.speedRatio;
}

/** Speed the boat settles at for this heading, wind and sail (knots). */
export function targetSpeed(ship: ShipClass, heading: number, wind: Wind, sail: number): number {
  return (
    polarFraction(ship, trueWindAngle(heading, wind)) *
    drivingWind(wind.speedKn) *
    ship.speedRatio *
    sail
  );
}

/**
 * Advance one boat by `dt` seconds. Pure arcade model (decision 0007): speed eases toward the
 * polar-curve target, the no-go zone brakes hard, and the rudder needs water flow to bite.
 * `seaDrag` (0..1, `seaDrag.ts`) is the share of that target the waves take off; it changes
 * nothing else.
 */
export function stepBoat(
  boat: BoatState,
  controls: BoatControls,
  ship: ShipClass,
  wind: Wind,
  dt: number,
  seaDrag = 0,
): void {
  // Sails ease toward the requested setting.
  boat.sailStep = clamp(Math.round(controls.sailStep), 0, SAIL_STEPS.length - 1);
  const sailTarget = SAIL_STEPS[boat.sailStep]!;
  const sailRate = 1.4 * dt;
  boat.sail += clamp(sailTarget - boat.sail, -sailRate, sailRate);

  // Steering: the rudder follows the input quickly; its effect grows with speed.
  boat.rudder = approach(boat.rudder, clamp(controls.steer, -1, 1), 10, dt);
  const flow = clamp(boat.speedKn / ship.steerageSpeedKn, 0, 1);
  const steerage = ship.minSteerage + (1 - ship.minSteerage) * flow;
  boat.heading = wrapPositive(boat.heading + boat.rudder * turnRate(ship) * steerage * dt);

  // Speed eases toward the polar target; coasting is slow so you carry way through a tack.
  const twa = Math.abs(trueWindAngle(boat.heading, wind));
  const target = targetSpeed(ship, boat.heading, wind, boat.sail) * (1 - seaDrag);
  const inIrons = twa < noGoAngle(ship);
  const rate = boat.speedKn < target ? ship.accel : inIrons ? ship.ironsDecel : ship.decel;
  boat.speedKn = approach(boat.speedKn, target, rate, dt);
  boat.speedKn *= Math.exp(-Math.abs(boat.rudder) * ship.turnDrag * dt);

  // Leeway: the wind pushes the hull sideways downwind, more with sails up.
  const push = wind.speedKn * ship.leeway * (0.35 + 0.65 * boat.sail);
  const to = bearingVector(windTo(wind));
  boat.drift.x = approach(boat.drift.x, to.x * push, 0.8, dt);
  boat.drift.y = approach(boat.drift.y, to.y * push, 0.8, dt);

  const dir = bearingVector(boat.heading);
  const scale = knotToUnits();
  boat.x += (dir.x * boat.speedKn + boat.drift.x) * scale * dt;
  boat.y += (dir.y * boat.speedKn + boat.drift.y) * scale * dt;
  boat.sinceBump += dt;
}
