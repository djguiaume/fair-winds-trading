import { type BoatControls, type BoatState, createBoat, stepBoat } from './boat';
import { resolveCollisions } from './collision';
import type { MapDef } from './map';
import {
  type Reef,
  damageHull,
  reefDistance,
  reefsOf,
  shallowDrag,
  shallowness,
  STRIKE_DAMAGE,
} from './hazards';
import { DEG, distance } from './math';
import type { ShipClass } from './ship';
import { type DockEvent, type TradeState, activeShip, createTradeState, stepTrade } from './trade';
import { type Wind, type WindBlocker, localWind, windAt, windBlockers, windEffectAt } from './wind';

/** Distance (units) at which a course buoy counts as reached. */
export const WAYPOINT_RADIUS = 12;

/** The whole game state. Plain data, no three.js: the renderer only reads it (decision 0005). */
export interface World {
  map: MapDef;
  /** Ship the boat sails as: the active class with its upgrades (follows `trade.captain`). */
  ship: ShipClass;
  time: number;
  /** Wind the boat feels: the sea wind, calmer in the lee of islands (decision 0027). */
  wind: Wind;
  /** Wind over open water, before island shelter. */
  seaWind: Wind;
  /** 0 = open sea … 1 = right behind a tall island. */
  shelter: number;
  /** 0 = no effect … 1 = wind squeezed through a channel between islands. */
  funnel: number;
  /** Land that blocks the wind, derived from the map once. */
  windBlockers: WindBlocker[];
  /** Reefs, derived from the map once (decision 0032). */
  reefs: Reef[];
  /** 0 = deep water … 1 = at a reef's edge. */
  shallow: number;
  /** Degrees added to the map's wind direction (the "new wind" button). */
  windOffsetDeg: number;
  boat: BoatState;
  destination: { portId: string; label: string; x: number; y: number } | null;
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
  | { type: 'bump' }
  | { type: 'reef-strike'; damage: number }
  | { type: 'waypoint'; label: string; seconds: number; next: string }
  | DockEvent;

export function createWorld(map: MapDef, ship: ShipClass): World {
  const trade = createTradeState(map, ship);
  const world: World = {
    map,
    ship: activeShip(trade),
    time: 0,
    wind: windAt(map.wind, 0, map.seed),
    seaWind: windAt(map.wind, 0, map.seed),
    shelter: 0,
    funnel: 0,
    windBlockers: windBlockers(map.islands, map.terrain),
    reefs: reefsOf(map.terrain),
    shallow: 0,
    windOffsetDeg: 0,
    boat: createBoat(map.start.x, map.start.y, map.start.headingDeg * DEG),
    destination: null,
    course: { index: 0, legStart: 0, reached: 0, lastLegSeconds: null },
    trade,
  };
  return world;
}

export function resetBoat(world: World): void {
  const { start } = world.map;
  world.boat = createBoat(start.x, start.y, start.headingDeg * DEG);
  world.destination = null;
  world.course = { index: 0, legStart: world.time, reached: 0, lastLegSeconds: null };
}

export function currentWaypoint(world: World) {
  return world.destination ?? world.map.course[world.course.index % world.map.course.length]!;
}

/** Only explicit player destinations appear during sandbox trading. */
export function navigationTarget(world: World) {
  return world.destination ?? (world.map.practiceCourse ? currentWaypoint(world) : null);
}

/** A fixed approach point chosen on the side of the port facing the boat. */
export function setPortDestination(world: World, portId: string): boolean {
  const port = world.map.ports.find((p) => p.id === portId);
  const island = world.map.islands.find((i) => i.id === port?.islandId);
  if (!port || !island) return false;
  const dx = world.boat.x - island.x,
    dy = world.boat.y - island.y;
  const length = Math.hypot(dx, dy) || 1;
  const existing = world.map.course.find((p) =>
    p.label.toLowerCase().includes(port.name.toLowerCase()),
  );
  world.destination = {
    portId,
    label: port.name,
    x: existing?.x ?? island.x + (dx / length) * (island.radius + 10),
    y: existing?.y ?? island.y + (dy / length) * (island.radius + 10),
  };
  return true;
}

export function stepWorld(world: World, controls: BoatControls, dt: number): WorldEvent[] {
  const events: WorldEvent[] = [];
  world.time += dt;
  const cfg = { ...world.map.wind, fromDeg: world.map.wind.fromDeg + world.windOffsetDeg };
  world.seaWind = windAt(cfg, world.time, world.map.seed);
  const effect = windEffectAt(world.windBlockers, world.boat, world.seaWind);
  world.shelter = effect.shelter;
  world.funnel = effect.funnel;
  world.wind = localWind(world.seaWind, effect);
  // Upgrades and ship purchases change the trade state; the boat picks them up here.
  world.ship = activeShip(world.trade);

  stepBoat(world.boat, controls, world.ship, world.wind, dt);
  // Shallows drag at the hull near reefs; deeper hulls feel it more (decision 0032).
  const nearReef = reefDistance(world.reefs, world.boat);
  world.shallow = shallowness(nearReef, world.ship.radius);
  if (world.shallow > 0) world.boat.speedKn *= shallowDrag(world.shallow, world.ship, dt);
  const sinceBump = world.boat.sinceBump;
  const speedBefore = world.boat.speedKn;
  resolveCollisions(
    world.boat,
    world.ship.radius,
    world.map.islands,
    world.map.boundsRadius,
    world.map.terrain,
  );
  // Report a new hit, not every frame spent grinding along a shore.
  if (world.boat.sinceBump === 0 && sinceBump > 0.5) {
    // Beaches are soft; reefs hole the hull in proportion to the speed the strike took off.
    const lost = speedBefore - world.boat.speedKn;
    const onReef = nearReef <= world.ship.radius + 1;
    const damage = onReef ? damageHull(world.trade, lost * STRIKE_DAMAGE) : 0;
    events.push(damage >= 1 ? { type: 'reef-strike', damage } : { type: 'bump' });
  }

  events.push(...stepTrade(world.trade, world.map, world.boat, dt));

  const wp = currentWaypoint(world);
  if (
    world.map.practiceCourse &&
    !world.destination &&
    world.map.course.length > 0 &&
    distance(world.boat, wp) < WAYPOINT_RADIUS
  ) {
    const seconds = world.time - world.course.legStart;
    world.course.index = (world.course.index + 1) % world.map.course.length;
    world.course.reached += 1;
    world.course.legStart = world.time;
    world.course.lastLegSeconds = seconds;
    events.push({ type: 'waypoint', label: wp.label, seconds, next: currentWaypoint(world).label });
  }
  return events;
}
