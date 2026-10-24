import { type FogEvent, stepFog } from './fog';
import { TUNING } from '../data/tuning';
import {
  type BoatControls,
  type BoatState,
  createBoat,
  knotToUnits,
  stepBoat,
  trueWindAngle,
} from './boat';
import { type Pier, piersOf, resolveCollisions } from './collision';
import { CurrentField, type CurrentSample } from './currents';
import type { MapDef } from './map';
import {
  type Reef,
  damageHull,
  impactDamage,
  reefDistance,
  reefsOf,
  passageShallowness,
  shallowDrag,
  shallowness,
} from './hazards';
import { townLevels } from './founding';
import { settlementLevels } from './settlement';
import { DIFFICULTIES, knobs, weatherFor } from './difficulty';
import { mapZones, zoneField } from './windZones';
import { smoothOutline } from './flowShapes';
import { DEG, bearingTo, clamp, distance } from './math';
import { type ShipClass, noGoAngle } from './ship';
import {
  type DockEvent,
  type TradeState,
  activeShip,
  createTradeState,
  homeInRange,
  portInRange,
  stepTrade,
} from './trade';
import { applyPerks } from './perks';
import { GOODS, type GoodId } from './goods';
import type { SpatialGrid } from './spatial';
import { heelFactor, pointOfSailHeel } from './heel';
import {
  type LocalWeather,
  type Wind,
  type WindConfig,
  type WindBlocker,
  localWind,
  steadyWeather,
  windAt,
  windBlockers,
  windGrid,
  windEffectAt,
  withoutStorms,
} from './wind';

/*
 * `src/data/tuning/seamanship.json` › `harbour` (decision 0094): `waypointRadius` (units) at which
 * a course buoy counts as reached; `brake` (1/s) when the sails are lowered within docking range of
 * a port (decision 0041); the crew only takes her alongside below `moorMaxKn` (faster, she can
 * still crash), and below `mooredKn` a boat being brought alongside comes to a dead stop.
 */
const harbour = () => TUNING.seamanship.harbour;

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
  /** Land that blocks the wind, derived from the map once, in a grid for nearby lookups (0117). */
  windBlockers: SpatialGrid<WindBlocker>;
  /** Reefs, derived from the map once (decision 0032). */
  reefs: Reef[];
  /** Harbour piers, solid to the hull (decision 0038). */
  piers: Pier[];
  /** 0 = deep water … 1 = at a reef's edge. */
  shallow: number;
  /** Moving water (decision 0140), built from the map once; asked only at the boat. */
  currents: CurrentField;
  /** Currents on (Settings › Weather, decision 0140); off = still water everywhere. */
  currentsOn: boolean;
  /** The water at the boat on the last step, knots (east, north), after the switch and level. */
  water: CurrentSample;
  /** Speed over the ground on the last step, knots: through the water, leeway and current. */
  sogKn: number;
  /** Weather at the boat: sea-wide state, rain and storm (decision 0067). */
  weather: LocalWeather;
  /**
   * How hard the wind presses her (decisions 0067 and 0074), as the wind speed that would press a
   * full-sailed sloop on a beam reach as hard, averaged over a few seconds so a gust stands out.
   * Drives cargo going overboard. Negative until the first step.
   */
  pressKn: number;
  /** The press right now, before averaging: the warning reads it so it shows before a lurch. */
  pressNowKn: number;
  /** Seconds spent pressed past `overpressedKn` (eases off when she stands up). */
  overHeel: number;
  /** Seconds before another lurch can throw cargo. */
  lurchCooldown: number;
  /** Storms the captain has already been warned about. */
  stormsWarned: number[];
  /** Weather spells and storms on (decision 0067); off = a steady breeze. A Settings switch. */
  dynamicWeather: boolean;
  /** Moving storms on (decision 0067); players can turn them off in Settings. */
  storms: boolean;
  /** The map's wind zones on (decision 0140): Settings › Weather › Wind zones. */
  windZones: boolean;
  /**
   * The steady trade wind (decision 0083): small, slow shifts close to the prevailing wind. A
   * Settings choice whose default follows the difficulty level (on for Fair winds).
   */
  steadyWind: boolean;
  /** Wind config used on the last step, to notice a change of level or Wind setting. */
  windConfig: WindConfig | null;
  /** While the wind eases from an old config to the new one (decision 0083), the old one and when. */
  windBlend: { from: WindConfig; at: number } | null;
  /**
   * Why storms are held back right now (decision 0072): 'tutorial', later a special event such as
   * a delivery race with fixed weather. Any entry holds them; see `holdStorms`.
   */
  stormHolds: string[];
  /**
   * A light, steady breeze that replaces the sea's wind while set (decision 0139): a lesson's or
   * the tracked quest step's `wind`. Not saved; the game sets it before every step.
   */
  calmWind: Wind | null;
  /** Only storms that form at or after this time; set when storms come back (decision 0072). */
  stormsFrom: number;
  /** Whether storms could blow on the last step, to notice when they come back. */
  stormsOn: boolean;
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
  /** Shallows refused her: her draft is too deep for them (decisions 0137, 0152). */
  | { type: 'too-shallow' }
  | { type: 'reef-strike'; damage: number }
  | { type: 'crash'; damage: number; surface: 'shore' | 'pier' | 'boat' }
  | { type: 'waypoint'; label: string; seconds: number; next: string }
  | { type: 'storm-near'; bearing: number }
  | { type: 'overboard'; good: GoodId; qty: number }
  /** The boat sailed into a current she had not charted yet (decision 0140). */
  | { type: 'current-charted'; id: string }
  /** The boat sailed well into a named wind zone she had not charted yet (decision 0152). */
  | { type: 'zone-charted'; id: string }
  /** Fog of war (decision 0156): she sailed into an uncharted area, or sighted a fogged island. */
  | FogEvent
  | DockEvent;

export function createWorld(map: MapDef, ship: ShipClass): World {
  const trade = createTradeState(map, ship);
  const world: World = {
    map,
    ship: activeShip(trade),
    time: 0,
    wind: windAt(map.wind, 0, map.seed, map.start),
    seaWind: windAt(map.wind, 0, map.seed, map.start),
    weather: { kind: 'breeze', rain: 0, showers: 0, gloom: 0, storm: 0, storms: [] },
    pressKn: -1,
    pressNowKn: 0,
    overHeel: 0,
    lurchCooldown: 0,
    stormsWarned: [],
    dynamicWeather: true,
    storms: true,
    windZones: true,
    steadyWind: false,
    windConfig: null,
    windBlend: null,
    stormHolds: [],
    calmWind: null,
    stormsFrom: 0,
    stormsOn: true,
    shelter: 0,
    funnel: 0,
    windBlockers: windGrid(windBlockers(map.islands, map.terrain)),
    reefs: reefsOf(map.terrain),
    piers: piersOf(map),
    shallow: 0,
    currents: new CurrentField(map),
    currentsOn: true,
    water: { east: 0, north: 0, id: '' },
    sogKn: 0,
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

/**
 * A voyage that takes the tutorial begins at the prologue's spot at sea (decision 0127), when the
 * map has one, lying still with the sails down so the first lesson is raising them (decision 0139).
 * Returns whether the boat moved.
 */
export function startAtPrologue(world: World): boolean {
  const start = world.map.prologue?.start;
  if (!start) return false;
  world.boat = createBoat(start.x, start.y, start.headingDeg * DEG);
  world.boat.sailStep = 0;
  world.destination = null;
  world.trade.dockedAt = null;
  return true;
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
  const k = Math.exp(-harbour().brake * dt);
  boat.speedKn = boat.speedKn * k < harbour().mooredKn ? 0 : boat.speedKn * k;
  // Lines ashore hold her against the wind once she has stopped.
  const hold = boat.speedKn === 0 ? 0 : k;
  boat.drift.x *= hold;
  boat.drift.y *= hold;
}

interface PierVersion {
  map: MapDef;
  levels: ReturnType<typeof settlementLevels>;
  count: number;
  /** Ports on the chart: founding a site (decision 0157) builds its pier. */
  charted: number;
}

const pierVersions = new WeakMap<World, PierVersion>();
export function refreshPiers(world: World) {
  const previous = pierVersions.get(world);
  const settlements = world.trade.settlements.byPort;
  let count = 0;
  let changed = !previous || previous.map !== world.map;
  // Scan mutable state directly: ordinary simulation steps allocate no level record or JSON.
  for (const id in settlements) {
    if (!Object.hasOwn(settlements, id)) continue;
    count++;
    if (
      !previous ||
      !Object.hasOwn(previous.levels, id) ||
      previous.levels[id] !== settlements[id]!.level
    )
      changed = true;
  }
  const charted = world.trade.progress.discovered.length;
  if (!changed && previous?.count === count && previous.charted === charted) return;
  world.piers = piersOf(world.map, townLevels(world.map, world.trade));
  pierVersions.set(world, {
    map: world.map,
    levels: settlementLevels(world.trade),
    count,
    charted,
  });
}

/*
 * Cargo overboard (decisions 0067 and 0074). The first rule read the heel the boat is drawn with,
 * but that heel is exaggerated so it reads from the high camera, slim rigs lean extra, and the
 * hull swings past its mark on every tack: players lost cargo in the ordinary breeze. The rule now
 * reads how hard the wind presses her, from the same inputs as the heel (wind she feels, point of
 * sail, sail area, luffing) but before any of the drawing.
 */
/*
 * `src/data/tuning/seamanship.json` › `cargo` (decision 0094). Pressed `overpressedKn` (averaged)
 * for `heavySeconds`, a unit goes over the side: breeze and rain stay under it (at most about 18.5
 * and 19.3 kn); a gale or a storm under full sail passes it. A gust `lurchGustKn` above the average
 * press throws cargo at once when she is already pressed `lurchPressKn`, then not again for
 * `lurchCooldown` seconds. The press is averaged over `pressAverageSec`, to tell a gust from a
 * steady blow, and the warning keeps `pressHysteresisKn` of hysteresis.
 */
const cargoTuning = () => TUNING.seamanship.cargo;

/**
 * How close she is to losing cargo, for the press warning on the sails control (decision 0078):
 * 0 = fine; 1 = amber, a hard gust can throw cargo (`lurchPressKn`); 2 = red, cargo goes over
 * the side within `heavySeconds` (`overpressedKn`). A little hysteresis keeps it from flickering
 * as the press wavers around a line. Alongside there is nothing to warn about.
 */
export type PressLevel = 0 | 1 | 2;

export function pressLevel(world: World, previous: PressLevel): PressLevel {
  // The press right now leads the average, so the warning comes before a gust can knock her.
  const press = Math.max(world.pressKn, world.pressNowKn);
  if (world.trade.dockedAt || world.pressKn < 0) return 0;
  const c = cargoTuning();
  const over = (line: number, held: boolean) => press > line - (held ? c.pressHysteresisKn : 0);
  if (over(c.overpressedKn, previous === 2)) return 2;
  if (over(c.lurchPressKn, previous >= 1)) return 1;
  return 0;
}

/** Storm warnings (decision 0067). */
export function stepStorms(world: World): WorldEvent[] {
  const events: WorldEvent[] = [];
  const { boat, weather } = world;
  for (const s of weather.storms) {
    if (world.stormsWarned.includes(s.id)) continue;
    if (distance(boat, s) - s.radius > TUNING.weather.storms.warningRange) continue;
    world.stormsWarned = [...world.stormsWarned.slice(-4), s.id];
    events.push({ type: 'storm-near', bearing: bearingTo(boat, s) });
  }
  return events;
}

/**
 * Units of the good the hold carries most of go over the side: one on Captain, two on Old salt,
 * none on Fair winds, where the warning still shows (decision 0083).
 */
function loseCargo(world: World): WorldEvent[] {
  const cargo = world.trade.captain.cargo;
  let good: GoodId | null = null;
  for (const g of GOODS) if (cargo[g] > 0 && (!good || cargo[g] > cargo[good])) good = g;
  const qty = good ? Math.min(cargo[good], knobs(world.trade.difficulty).cargoLost) : 0;
  if (!good || qty <= 0) return [];
  cargo[good] -= qty;
  return [{ type: 'overboard', good, qty }];
}

/* The wind takes `weather.json` › `blendSec` to ease to a new level or Wind setting, as a weather
 * change does. */

/** Sea wind at the boat, eased from the previous config for a while after it changed (0083). */
function seaWindAt(world: World, cfg: WindConfig): Wind {
  const previous = world.windConfig;
  if (previous && (previous.weather !== cfg.weather || previous.zones !== cfg.zones))
    world.windBlend = { from: previous, at: world.time };
  world.windConfig = cfg;
  const wind = windAt(cfg, world.time, world.map.seed, world.boat, world.weather);
  const blend = world.windBlend;
  if (!blend) return wind;
  const k = (world.time - blend.at) / TUNING.weather.blendSec;
  if (k >= 1 || k < 0) {
    world.windBlend = null;
    return wind;
  }
  const old = windAt(blend.from, world.time, world.map.seed, world.boat);
  const s = k * k * (3 - 2 * k);
  let turn = wind.from - old.from;
  turn -= 2 * Math.PI * Math.round(turn / (2 * Math.PI));
  const from = old.from + turn * s;
  return {
    from: from - 2 * Math.PI * Math.floor(from / (2 * Math.PI)),
    speedKn: old.speedKn + (wind.speedKn - old.speedKn) * s,
  };
}

/**
 * Cargo shifts when she is pressed too hard for too long or a hard gust knocks her over
 * (decisions 0067 and 0074, Guillaume's idea): sailing full in a gale or a storm costs cargo unless
 * you ease the sails or bear away, so reading the wind pays. Tacks and the ordinary breeze never
 * cost cargo. Stiff hulls (haulers, warships) stand up to more.
 */
export function stepHeel(world: World, dt: number): WorldEvent[] {
  const { boat, ship, wind, trade } = world;
  const abs = Math.abs(trueWindAngle(boat.heading, wind));
  const noGo = noGoAngle(ship);
  const luff = 1 - clamp((abs - noGo * 0.8) / (noGo * 0.3), 0, 1);
  const drive = pointOfSailHeel(abs, noGo) * boat.sail * (1 - luff);
  // Heel grows with wind^1.25 × drive (src/sim/heel.ts), so this is the beam-reach equivalent.
  const stiff = Math.min(1, heelFactor(trade.captain.activeShip));
  const press = wind.speedKn * Math.pow(drive * stiff, 0.8);
  const c = cargoTuning();
  world.pressNowKn = press;
  if (world.pressKn < 0) world.pressKn = press;
  if (dt > 0) world.pressKn += (press - world.pressKn) * (1 - Math.exp(-dt / c.pressAverageSec));
  world.lurchCooldown = Math.max(0, world.lurchCooldown - dt);
  // Alongside nothing is thrown about.
  if (trade.dockedAt || dt <= 0) return [];
  if (
    press - world.pressKn > c.lurchGustKn &&
    world.pressKn > c.lurchPressKn &&
    world.lurchCooldown === 0
  ) {
    world.lurchCooldown = c.lurchCooldown;
    world.overHeel = 0;
    return loseCargo(world);
  }
  if (world.pressKn <= c.overpressedKn) {
    world.overHeel = Math.max(0, world.overHeel - dt);
    return [];
  }
  world.overHeel += dt;
  if (world.overHeel < c.heavySeconds) return [];
  world.overHeel = 0;
  return loseCargo(world);
}

/**
 * Current (decision 0140): the water at the boat carries her over the ground, added to her motion
 * the way leeway is; the polars, heel and press stay "through the water". A moored boat (stopped
 * with her lines ashore) ignores it. Sailing into a current she has not met charts it.
 */
function stepCurrent(world: World, dt: number): WorldEvent[] {
  const { boat } = world;
  const scale = world.currentsOn ? knobs(world.trade.difficulty).currents : 0;
  const water = world.currents.at(boat.x, boat.y, scale, world.water);
  const moored = boat.speedKn === 0 && boat.sailStep === 0 && !boat.drift.x && !boat.drift.y;
  if (moored || !water.id) return [];
  const k = knotToUnits() * dt;
  boat.x += water.east * k;
  boat.y += water.north * k;
  const charted = (world.trade.progress.charted ??= []);
  if (
    charted.includes(water.id) ||
    Math.hypot(water.east, water.north) < TUNING.weather.currents.chartAtKn
  )
    return [];
  charted.push(water.id);
  return [{ type: 'current-charted', id: water.id }];
}

/**
 * A named wind zone goes on the chart once she is well inside it, past its soft edge, like a
 * current (decision 0152). Unnamed zones are tuning, not places, and stay off it.
 */
function chartZone(world: World): WorldEvent[] {
  const { zone, zoneWeight = 0 } = world.weather;
  if (!zone || zoneWeight < TUNING.weather.zones.chartWeight) return [];
  const zones = (world.trade.progress.zones ??= []);
  if (zones.includes(zone) || !world.map.windZones?.some((z) => z.id === zone && z.name)) return [];
  zones.push(zone);
  return [{ type: 'zone-charted', id: zone }];
}

/**
 * Holds storms back for a reason (decision 0072), or lets that reason go. Storms never blow during
 * the tutorial or a special event, whatever the Settings say. Idempotent, so callers can sync it
 * every step.
 */
export function holdStorms(world: World, reason: string, held: boolean) {
  const has = world.stormHolds.includes(reason);
  if (held && !has) world.stormHolds = [...world.stormHolds, reason];
  else if (!held && has) world.stormHolds = world.stormHolds.filter((r) => r !== reason);
}

export function stepWorld(world: World, controls: BoatControls, dt: number): WorldEvent[] {
  refreshPiers(world);
  const events: WorldEvent[] = [];
  world.time += dt;
  const base = world.map.wind.weather;
  // The difficulty level and the Wind setting shape the map's weather (decision 0083).
  const weather = base && weatherFor(base, world.trade.difficulty, world.steadyWind);
  // When storms come back (Settings, end of the tutorial or an event), only new ones form at the
  // edge of the sea: one already under way would otherwise appear out of nowhere (decision 0072).
  const stormsOn = world.dynamicWeather && world.storms && world.stormHolds.length === 0;
  if (stormsOn && !world.stormsOn) world.stormsFrom = world.time;
  world.stormsOn = stormsOn;
  const cfg = {
    ...world.map.wind,
    fromDeg: world.map.wind.fromDeg + world.windOffsetDeg,
    weather: !weather
      ? weather
      : !world.dynamicWeather
        ? steadyWeather(weather)
        : !stormsOn
          ? withoutStorms(weather)
          : weather,
    stormsFrom: world.stormsFrom,
    // Wind zones (decision 0140) sit on top of the weather, with their own Settings switch.
    zones: world.windZones ? zoneField(mapZones(world.map), smoothOutline) : null,
    easiest: world.trade.difficulty === DIFFICULTIES[0],
  };
  world.seaWind = seaWindAt(world, cfg);
  events.push(...chartZone(world));
  if (world.calmWind) world.seaWind = { ...world.calmWind };
  const effect = windEffectAt(world.windBlockers, world.boat, world.seaWind);
  world.shelter = effect.shelter;
  world.funnel = effect.funnel;
  world.wind = localWind(world.seaWind, effect);
  // Upgrades and ship purchases change the trade state; the boat picks them up here.
  world.ship = activeShip(world.trade);

  const before = { x: world.boat.x, y: world.boat.y };
  stepBoat(world.boat, controls, world.ship, world.wind, dt);
  // Lowering the sails near a port at a slow speed brings her alongside: the crew throws lines, she stops dead
  // and no longer drifts, so docking is reliable instead of a slow exponential crawl (0041).
  if (
    world.boat.sailStep === 0 &&
    world.boat.speedKn < harbour().moorMaxKn &&
    (portInRange(
      world.map,
      world.boat,
      undefined,
      townLevels(world.map, world.trade),
      world.ship.id,
    ) ||
      homeInRange(world.trade, world.map, world.boat))
  )
    moor(world.boat, dt);
  events.push(...stepCurrent(world, dt));
  events.push(
    ...stepFog(
      world.map,
      world.trade.progress,
      world.boat,
      applyPerks(world.trade.home, 'discoverRange', TUNING.economy.discoverRange),
    ),
  );
  // Shallows drag at the hull near reefs; deeper hulls feel it more (decision 0032).
  const nearReef = reefDistance(world.reefs, world.boat);
  world.shallow = Math.max(
    shallowness(nearReef, world.ship.radius),
    passageShallowness(world.map.terrain, world.boat),
  );
  if (world.shallow > 0) world.boat.speedKn *= shallowDrag(world.shallow, world.ship, dt);
  world.sogKn = dt > 0 ? distance(before, world.boat) / (knotToUnits() * dt) : 0;
  const sinceBump = world.boat.sinceBump;
  const speedBefore = world.boat.speedKn;
  const surface = resolveCollisions(
    world.boat,
    world.ship.radius,
    world.map.islands,
    world.map.boundsRadius,
    world.map.terrain,
    world.piers,
    world.ship.draft,
  );
  // Report a new hit, not every frame spent grinding along a shore.
  if (surface && world.boat.sinceBump === 0 && sinceBump > 0.5) {
    // Damage follows the speed the impact took off: reefs always cut, shores and piers only
    // past a docking bump, sandbanks are soft (decisions 0032 and 0038).
    const hit = impactDamage(surface, speedBefore - world.boat.speedKn);
    // The pilot house takes a share off every knock (decision 0126).
    const damage = damageHull(
      world.trade,
      applyPerks(world.trade.home, 'hullDamage', hit * knobs(world.trade.difficulty).damage),
    );
    if (surface === 'shallows') events.push({ type: 'too-shallow' });
    else if (damage >= 1 && surface === 'reef') events.push({ type: 'reef-strike', damage });
    else if (damage >= 1 && (surface === 'shore' || surface === 'pier' || surface === 'boat'))
      events.push({ type: 'crash', damage, surface });
    else events.push({ type: 'bump' });
  }

  events.push(...stepTrade(world.trade, world.map, world.boat, dt));
  refreshPiers(world);
  events.push(...stepStorms(world));
  events.push(...stepHeel(world, dt));

  const wp = currentWaypoint(world);
  if (
    world.map.practiceCourse &&
    !world.destination &&
    world.map.course.length > 0 &&
    distance(world.boat, wp) < harbour().waypointRadius
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
