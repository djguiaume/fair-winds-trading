import { type BoatControls, type BoatState, createBoat, stepBoat } from './boat';
import { resolveCollisions } from './collision';
import type { MapDef } from './map';
import { DEG, distance } from './math';
import type { ShipClass } from './ship';
import { type DockEvent, type TradeState, activeShip, createTradeState, stepTrade } from './trade';
import { type Wind, windAt } from './wind';

/** Distance (units) at which a course buoy counts as reached. */
export const WAYPOINT_RADIUS = 12;

/** The whole game state. Plain data, no three.js: the renderer only reads it (decision 0005). */
export interface World {
  map: MapDef;
  /** Ship the boat sails as: the active class with its upgrades (follows `trade.captain`). */
  ship: ShipClass;
  time: number;
  wind: Wind;
  /** Degrees added to the map's wind direction (the "new wind" button). */
  windOffsetDeg: number;
  boat: BoatState;
  course: {
    index: number;
    /** Time the current leg started. */
    legStart: number;
    /** Completed legs. */
    reached: number;
    lastLegSeconds: number | null;
  };
  /** Gold, ships, cargo, markets and docking (Phase 1). */
  trade: TradeState;
}

export type WorldEvent =
  { type: 'bump' } | { type: 'waypoint'; label: string; seconds: number; next: string } | DockEvent;

export function createWorld(map: MapDef, ship: ShipClass): World {
  const trade = createTradeState(map, ship);
  const world: World = {
    map,
    ship: activeShip(trade),
    time: 0,
    wind: windAt(map.wind, 0),
    windOffsetDeg: 0,
    boat: createBoat(map.start.x, map.start.y, map.start.headingDeg * DEG),
    course: { index: 0, legStart: 0, reached: 0, lastLegSeconds: null },
    trade,
  };
  return world;
}

export function resetBoat(world: World): void {
  const { start } = world.map;
  world.boat = createBoat(start.x, start.y, start.headingDeg * DEG);
  world.course = { index: 0, legStart: world.time, reached: 0, lastLegSeconds: null };
}

export function currentWaypoint(world: World) {
  return world.map.course[world.course.index % world.map.course.length]!;
}

export function stepWorld(world: World, controls: BoatControls, dt: number): WorldEvent[] {
  const events: WorldEvent[] = [];
  world.time += dt;
  const cfg = { ...world.map.wind, fromDeg: world.map.wind.fromDeg + world.windOffsetDeg };
  world.wind = windAt(cfg, world.time);
  // Upgrades and ship purchases change the trade state; the boat picks them up here.
  world.ship = activeShip(world.trade);

  stepBoat(world.boat, controls, world.ship, world.wind, dt);
  const sinceBump = world.boat.sinceBump;
  resolveCollisions(
    world.boat,
    world.ship.radius,
    world.map.islands,
    world.map.boundsRadius,
    world.map.terrain,
  );
  // Report a new hit, not every frame spent grinding along a shore.
  if (world.boat.sinceBump === 0 && sinceBump > 0.5) events.push({ type: 'bump' });

  events.push(...stepTrade(world.trade, world.map, world.boat, dt));

  const wp = currentWaypoint(world);
  if (world.map.course.length > 0 && distance(world.boat, wp) < WAYPOINT_RADIUS) {
    const seconds = world.time - world.course.legStart;
    world.course.index = (world.course.index + 1) % world.map.course.length;
    world.course.reached += 1;
    world.course.legStart = world.time;
    world.course.lastLegSeconds = seconds;
    events.push({ type: 'waypoint', label: wp.label, seconds, next: currentWaypoint(world).label });
  }
  return events;
}
