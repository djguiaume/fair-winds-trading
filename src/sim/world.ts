import { type BoatControls, type BoatState, createBoat, stepBoat } from './boat';
import { type Pier, piersOf, resolveCollisions } from './collision';
import type { MapDef } from './map';
import {
  type Reef,
  damageHull,
  impactDamage,
  reefDistance,
  reefsOf,
  shallowDrag,
  shallowness,
} from './hazards';
import { DEG, bearingTo, distance } from './math';
import type { ShipClass } from './ship';
import {
  type DockEvent,
  type TradeState,
  activeShip,
  createTradeState,
  portInRange,
  stepTrade,
} from './trade';
import type { GoodId } from './goods';
import {
  type LocalWeather,
  type Wind,
  type WindBlocker,
  localWind,
  windAt,
  windBlockers,
  windEffectAt,
} from './wind';

/** Distance (units) at which a course buoy counts as reached. */
export const WAYPOINT_RADIUS = 12;
/** Braking (1/s) when the sails are lowered within docking range of a port (decision 0041). */
export const HARBOUR_BRAKE = 1.6;
/** The crew only takes her alongside below this speed (knots); faster, she can still crash. */
export const MOOR_MAX_KN = 3;
/** Below this (knots) a boat being brought alongside comes to a dead stop. */
export const MOORED_KN = 0.2;

/** The whole game state. Plain data, no three.js: the renderer only reads it (decision 0005). */
export interface World {
  map: MapDef;
  /** Ship the boat sails as: the active class with its upgrades (follows `trade.captain`). */
  ship: ShipClass;
  time: number;
  /** Wind the boat feels: the sea wind, calmer in the lee of islands (decision 0027). */
  wind: Wind;
  /** Wind over open water where the boat is, before island shelter; it differs across the sea (0064). */
  seaWind: Wind;
  /** 0 = open sea … 1 = right behind a tall island. */
  shelter: number;
  /** 0 = no effect … 1 = wind squeezed through a channel between islands. */
  funnel: number;
  /** Land that blocks the wind, derived from the map once. */
  windBlockers: WindBlocker[];
  /** Reefs, derived from the map once (decision 0032). */
  reefs: Reef[];
  /** Harbour piers, solid to the hull (decision 0038). */
  piers: Pier[];
  /** 0 = deep water … 1 = at a reef's edge. */
  shallow: number;
  /** Weather at the boat: sea-wide state, rain and storm (decision 0065). */
  weather: LocalWeather;
  /** Storm exposure (seconds at full force) since cargo was last soaked. */
  soak: number;
  /** Storms the captain has already been warned about. */
  stormsWarned: number[];
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
  | { type: 'crash'; damage: number; surface: 'shore' | 'pier' }
  | { type: 'waypoint'; label: string; seconds: number; next: string }
  | { type: 'storm-near'; bearing: number }
  | { type: 'spoiled'; goods: Partial<Record<GoodId, number>> }
  | DockEvent;

export function createWorld(map: MapDef, ship: ShipClass): World {
  const trade = createTradeState(map, ship);
  const world: World = {
    map,
    ship: activeShip(trade),
    time: 0,
    wind: windAt(map.wind, 0, map.seed, map.start),
    seaWind: windAt(map.wind, 0, map.seed, map.start),
    weather: { kind: 'breeze', rain: 0, showers: 0, storm: 0, storms: [] },
    soak: 0,
    stormsWarned: [],
    shelter: 0,
    funnel: 0,
    windBlockers: windBlockers(map.islands, map.terrain),
    reefs: reefsOf(map.terrain),
    piers: piersOf(map),
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

function moor(boat: BoatState, dt: number): void {
  const k = Math.exp(-HARBOUR_BRAKE * dt);
  boat.speedKn = boat.speedKn * k < MOORED_KN ? 0 : boat.speedKn * k;
  // Lines ashore hold her against the wind once she has stopped.
  const hold = boat.speedKn === 0 ? 0 : k;
  boat.drift.x *= hold;
  boat.drift.y *= hold;
}

/** Goods that seawater ruins; timber, stone and the workshop goods are packed to keep (0065). */
export const PERISHABLE: readonly GoodId[] = ['fish', 'grain', 'bread'];
/** Seconds in a storm's core before a soaking spoils part of the perishable cargo. */
export const SOAK_SECONDS = 4;
/** Share of each perishable good lost per soaking (at least one unit). */
export const SOAK_SHARE = 0.1;
/** Warn when a storm's edge comes this close (map units). */
export const STORM_WARNING = 140;

/** Storm warnings and spoiled cargo (decision 0065). */
export function stepStorms(world: World, dt: number): WorldEvent[] {
  const events: WorldEvent[] = [];
  const { boat, weather, trade } = world;
  for (const s of weather.storms) {
    if (world.stormsWarned.includes(s.id)) continue;
    if (distance(boat, s) - s.radius > STORM_WARNING) continue;
    world.stormsWarned = [...world.stormsWarned.slice(-4), s.id];
    events.push({ type: 'storm-near', bearing: bearingTo(boat, s) });
  }
  // Moored in harbour, the cargo is under cover.
  if (weather.storm < 0.5 || trade.dockedAt) return events;
  world.soak += weather.storm * dt;
  if (world.soak < SOAK_SECONDS) return events;
  world.soak = 0;
  const lost: Partial<Record<GoodId, number>> = {};
  const cargo = trade.captain.cargo;
  for (const g of PERISHABLE) {
    if (cargo[g] <= 0) continue;
    const n = Math.min(cargo[g], Math.max(1, Math.round(cargo[g] * SOAK_SHARE)));
    cargo[g] -= n;
    lost[g] = n;
  }
  if (Object.keys(lost).length) events.push({ type: 'spoiled', goods: lost });
  return events;
}

export function stepWorld(world: World, controls: BoatControls, dt: number): WorldEvent[] {
  const events: WorldEvent[] = [];
  world.time += dt;
  const cfg = { ...world.map.wind, fromDeg: world.map.wind.fromDeg + world.windOffsetDeg };
  world.seaWind = windAt(cfg, world.time, world.map.seed, world.boat, world.weather);
  const effect = windEffectAt(world.windBlockers, world.boat, world.seaWind);
  world.shelter = effect.shelter;
  world.funnel = effect.funnel;
  world.wind = localWind(world.seaWind, effect);
  // Upgrades and ship purchases change the trade state; the boat picks them up here.
  world.ship = activeShip(world.trade);

  stepBoat(world.boat, controls, world.ship, world.wind, dt);
  // Lowering the sails near a port at a slow speed brings her alongside: the crew throws lines, she stops dead
  // and no longer drifts, so docking is reliable instead of a slow exponential crawl (0041).
  if (
    world.boat.sailStep === 0 &&
    world.boat.speedKn < MOOR_MAX_KN &&
    portInRange(world.map, world.boat)
  )
    moor(world.boat, dt);
  // Shallows drag at the hull near reefs; deeper hulls feel it more (decision 0032).
  const nearReef = reefDistance(world.reefs, world.boat);
  world.shallow = shallowness(nearReef, world.ship.radius);
  if (world.shallow > 0) world.boat.speedKn *= shallowDrag(world.shallow, world.ship, dt);
  const sinceBump = world.boat.sinceBump;
  const speedBefore = world.boat.speedKn;
  const surface = resolveCollisions(
    world.boat,
    world.ship.radius,
    world.map.islands,
    world.map.boundsRadius,
    world.map.terrain,
    world.piers,
  );
  // Report a new hit, not every frame spent grinding along a shore.
  if (surface && world.boat.sinceBump === 0 && sinceBump > 0.5) {
    // Damage follows the speed the impact took off: reefs always cut, shores and piers only
    // past a docking bump, sandbanks are soft (decisions 0032 and 0038).
    const damage = damageHull(world.trade, impactDamage(surface, speedBefore - world.boat.speedKn));
    if (damage >= 1 && surface === 'reef') events.push({ type: 'reef-strike', damage });
    else if (damage >= 1 && (surface === 'shore' || surface === 'pier'))
      events.push({ type: 'crash', damage, surface });
    else events.push({ type: 'bump' });
  }

  events.push(...stepTrade(world.trade, world.map, world.boat, dt));
  events.push(...stepStorms(world, dt));

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
