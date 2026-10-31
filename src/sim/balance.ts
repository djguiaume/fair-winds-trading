import { TUNING } from '../data/tuning';
import TARGETS from '../data/balance-targets.json';
import { deliverContract, stepContracts, syncHelpOrder } from './contracts';
import { CurrentField } from './currents';
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  DIFFICULTY,
  type Difficulty,
  knobs,
  weatherFor,
} from './difficulty';
import { coastDistance } from './coast';
import { beltMeanWait, beltNow, beltNumbers } from './stormBelt';
import { CRAFTED_FROM, GOODS, type GoodId, isCrafted, isFar } from './goods';
import { damageHull, repairHull } from './hazards';
import type { MapDef } from './map';
import { available, quoteBuy, quoteSell, stepMarket, trades } from './market';
import { DEG } from './math';
import { smoothOutline } from './flowShapes';
import { NO_ZONE, type ZoneEffect, type ZoneField, zoneField, zoneMeanAt } from './windZones';
import { createRng } from './rng';
import {
  MAX_SETTLEMENT_LEVEL,
  madeGoods,
  portTownGate,
  producesAt,
  settlementLevel,
  stepSettlements,
  wantsAt,
} from './settlement';
import { CUTTER, SLOOP, type ShipClass, polarFraction } from './ship';
import { discoverNear, discoveredPorts, homePort } from './shipyards';
import { islandCharted, stepFog } from './fog';
import {
  type QuestTimer,
  StandingOrders,
  StoryClock,
  questVisits,
  storyChapters,
} from './balanceStory';
import {
  type TradeState,
  activeShip,
  buy,
  buyShip,
  buyUpgrade,
  capacity,
  maxBuy,
  sellAll,
  startVoyage,
  syncMarketLevels,
  upgradeAllowed,
} from './trade';
import { type UpgradeTrack, effectiveShip, upgradePrice } from './upgrades';
import { createWorld } from './world';
import { drivingWind } from './boat';
import { seaDrag } from './seaDrag';
import { createSeaState, steadySeaState } from './seaState';
import { type WindConfig, windAt, withoutStorms } from './wind';

/**
 * The balance simulation (decisions 0046, 0083, 0114). Simulated captains trade on a map for a
 * while: a sharp one always takes the best paying leg; a relaxed one sails slower, often settles
 * for the second or third best load and strikes something now and then. Leg times come from the
 * ship polars in the game's own wind at that moment of the voyage (decision 0149): the level's
 * weather walk (steady on Fair winds, wandering round the compass on Captain and Old salt), its
 * calms and gales, the regions, the wind zones and the currents at the level's strength. So they
 * follow sailing, weather and map changes too.
 *
 * Shared by `tests/economy-balance.test.ts`, `tests/difficulty-balance.test.ts` and the `?tune`
 * panel's balance check, which runs it in a worker on edited values. The targets are in
 * `src/data/balance-targets.json`; `economyChecks` and `difficultyChecks` hold them against a run.
 * Reads `TUNING` at call time. Pure: no DOM.
 */

export const BALANCE_TARGETS = TARGETS;
const DOCK_SECONDS = 20;

interface Weather {
  from: number;
  kn: number;
}

/** Wind from the map's prevailing direction, ±`spread`° and ×0.8–1.1 as the weather shifts. */
function weathers(map: MapDef, spread: number): Weather[] {
  return Array.from({ length: 11 }, (_, i) => ((i - 5) * spread) / 5).flatMap((off) =>
    [0.8, 0.95, 1.1].map((s) => ({
      from: (map.wind.fromDeg + off) * DEG,
      kn: map.wind.speedKn * s,
    })),
  );
}

/** ±50° round the prevailing wind, for the averaged leg times of the "about a minute" check. */
const SHIFTING_SPREAD = 50;

function islandOfPort(map: MapDef, portId: string) {
  const port = map.ports.find((p) => p.id === portId)!;
  return map.islands.find((i) => i.id === port.islandId)!;
}

/**
 * Best speed made good along `bearing` (kn), sailing straight or tacking, in one wind and the sea
 * it raises once settled, the waves slowing her unless `waves` is off (decision 0256).
 */
function madeGoodIn(
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
const legSea = createSeaState();

/** Best speed made good along `bearing` (kn), averaged over the weather. */
function madeGood(ship: ShipClass, bearing: number, weather: Weather[], waves: boolean): number {
  let sum = 0;
  for (const w of weather) sum += madeGoodIn(ship, bearing, w.from, w.kn, waves);
  return sum / weather.length;
}

/** A leg cut into stretches of at most `ZONE_STRETCH` units, each timed in its own wind and water. */
interface LegPath {
  bearing: number;
  /** Units of each stretch. */
  stretch: number;
  /** Middle of each stretch. */
  points: Array<[number, number]>;
}

const legPaths = new WeakMap<MapDef, Map<string, LegPath>>();

function legPath(map: MapDef, from: string, to: string): LegPath {
  let byMap = legPaths.get(map);
  if (!byMap) legPaths.set(map, (byMap = new Map()));
  const key = `${from}>${to}`;
  const known = byMap.get(key);
  if (known) return known;
  const a = islandOfPort(map, from);
  const b = islandOfPort(map, to);
  const centres = Math.hypot(b.x - a.x, b.y - a.y);
  const d = centres - a.radius - b.radius;
  const ux = (b.x - a.x) / centres,
    uy = (b.y - a.y) / centres;
  const n = Math.min(16, Math.max(1, Math.ceil(d / ZONE_STRETCH)));
  const points = Array.from({ length: n }, (_, i): [number, number] => {
    const along = a.radius + (d * (i + 0.5)) / n;
    return [a.x + ux * along, a.y + uy * along];
  });
  const path = { bearing: Math.atan2(b.x - a.x, b.y - a.y), stretch: d / n, points };
  byMap.set(key, path);
  return path;
}

const fields = new WeakMap<MapDef, CurrentField>();

/** The map's currents (decision 0140), built once per map. */
function currentField(map: MapDef): CurrentField {
  let field = fields.get(map);
  if (!field) fields.set(map, (field = new CurrentField(map)));
  return field;
}

/** The current along `bearing` at a point (kn, negative against her), at `scale` strength. */
function currentAlong(map: MapDef, x: number, y: number, bearing: number, scale: number): number {
  if (scale <= 0 || !map.currents?.length) return 0;
  const v = currentField(map).at(x, y, scale, water);
  return v.east * Math.sin(bearing) + v.north * Math.cos(bearing);
}
const water = { east: 0, north: 0, id: '' };

/** Slowest speed over the ground a stretch is timed at, so a calm against a current still ends. */
const CRAWL_KN = 0.5;

/** Seconds of one stretch: 15 % detour round islands and reefs, 10 % manoeuvring losses. */
const stretchSeconds = (units: number, madeGoodKn: number, currentKn: number) =>
  (units * 1.15) /
  (Math.max(CRAWL_KN, madeGoodKn * 0.9 + currentKn) * TUNING.seamanship.boat.knotToUnits);

/**
 * Seconds from one port to another averaged over a range of winds, in the zones' average wind,
 * the currents at `currents` strength (Captain's by default) and the waves slowing her unless
 * `waves` is off. For the "about a minute" check.
 */
export function legSeconds(
  map: MapDef,
  ship: ShipClass,
  from: string,
  to: string,
  weather = weathers(map, SHIFTING_SPREAD),
  currents = 1,
  waves = true,
): number {
  const zones = zoneField(map.windZones, smoothOutline);
  // Cached per weather list, since the checks ask for the same legs again.
  let byWeather = averageLegs.get(weather);
  if (!byWeather) averageLegs.set(weather, (byWeather = new Map()));
  const key = `${map.name}:${ship.id}:${ship.speedRatio}:${from}:${to}:${currents}:${waves}`;
  const known = byWeather.get(key);
  if (known !== undefined) return known;
  const path = legPath(map, from, to);
  let seconds = 8;
  for (const [x, y] of path.points) {
    // Wind zones (decision 0140): each stretch sailed in the zones' average wind at its middle.
    const local = !zones
      ? weather
      : weather.map((w) => {
          const z = zoneMeanAt(zones, x, y, w.from, false, legZone);
          return { from: w.from + z.turn, kn: w.kn * z.strength };
        });
    const current = currentAlong(map, x, y, path.bearing, currents);
    seconds += stretchSeconds(path.stretch, madeGood(ship, path.bearing, local, waves), current);
  }
  // Storm belts (decision 0167) crossed on the way: Captain's mean wait for a lull at each.
  if (zones) seconds += beltWait(zones, path.points, DIFFICULTY[DEFAULT_DIFFICULTY]!.stormBelt);
  byWeather.set(key, seconds);
  return seconds;
}

/** Mean seconds waiting for lulls at the storm belts a leg's stretches cross (decision 0167). */
function beltWait(field: ZoneField, points: readonly [number, number][], level: number): number {
  const belts = beltNumbers(field);
  if (!belts.size) return 0;
  let wait = 0;
  for (const z of field.zones) {
    const numbers = belts.get(z.def.id);
    if (numbers && points.some(([x, y]) => coastDistance(x, y, z.outline).distance < 0))
      wait += beltMeanWait(numbers, level);
  }
  return wait;
}

/** Length of one stretch of a leg sailed in one zone wind (units). */
const ZONE_STRETCH = 40;
const legZone: ZoneEffect = { ...NO_ZONE };
const averageLegs = new WeakMap<Weather[], Map<string, number>>();

/**
 * The sea of one voyage as the game has it (decision 0149): the level's weather without the
 * moving storms, the wind zones, and the currents at the level's strength.
 */
export interface Sea {
  map: MapDef;
  wind: WindConfig;
  seed: number;
  currents: number;
  /** The level's storm belt knob (decision 0167), 0 with the switch off: she waits for a lull. */
  belt: number;
  /** The waves slow her (decision 0256): Settings › Waves slow the boat. */
  seaDrag: boolean;
}

export interface SeaOptions {
  level?: Difficulty;
  /** Weather seed; each seed is another voyage's weather. */
  seed?: number;
  /** Settings › Currents (decision 0145); on by default. */
  currents?: boolean;
  /** Settings › Wind zones (decision 0144); on by default. */
  zones?: boolean;
  /** Settings › Wind steady; by default what the level starts with. */
  steadyWind?: boolean;
  /** Settings › Storm belt (decision 0167); on by default. */
  stormBelt?: boolean;
  /** Settings › Waves slow the boat (decision 0256); on by default. */
  seaDrag?: boolean;
}

export function seaOf(map: MapDef, opts: SeaOptions = {}): Sea {
  const level = opts.level ?? DEFAULT_DIFFICULTY;
  const k = knobs(level);
  const base = map.wind.weather;
  const weather = base && withoutStorms(weatherFor(base, level, opts.steadyWind ?? k.steadyWind));
  return {
    map,
    wind: {
      ...map.wind,
      weather,
      zones: opts.zones === false ? null : zoneField(map.windZones, smoothOutline),
      easiest: level === DIFFICULTIES[0],
    },
    seed: (map.seed ^ Math.imul(opts.seed ?? 0, 0x9e3779b1)) >>> 0,
    currents: opts.currents === false ? 0 : k.currents,
    belt: opts.stormBelt === false || opts.zones === false ? 0 : k.stormBelt,
    seaDrag: opts.seaDrag !== false,
  };
}

/**
 * Seconds from one port to another leaving at `t` (seconds into the voyage): each stretch is
 * sailed in the wind blowing there when she gets there, plus the current along her course.
 */
export function seaLegSeconds(
  sea: Sea,
  ship: ShipClass,
  from: string,
  to: string,
  t: number,
): number {
  const path = legPath(sea.map, from, to);
  let seconds = 8;
  let waited: string[] | null = null;
  for (const [x, y] of path.points) {
    spot.x = x;
    spot.y = y;
    // A storm belt (decision 0167): on reaching it in a train of squalls, she waits for the lull.
    const belt =
      sea.belt > 0 && sea.wind.zones
        ? beltNow(sea.wind.zones, sea.seed, t + seconds, x, y, 0, sea.belt)
        : null;
    if (belt?.inside && !waited?.includes(belt.zone)) {
      (waited ??= []).push(belt.zone);
      if (belt.squalls) seconds += belt.changeSec;
    }
    const wind = windAt(sea.wind, t + seconds, sea.seed, spot);
    const current = currentAlong(sea.map, x, y, path.bearing, sea.currents);
    seconds += stretchSeconds(
      path.stretch,
      madeGoodIn(ship, path.bearing, wind.from, wind.speedKn, sea.seaDrag),
      current,
    );
  }
  return seconds;
}
const spot = { x: 0, y: 0 };

/** A place a leg starts or ends at: a point at sea, or an island's coast (`r`, its radius). */
export interface Place {
  x: number;
  y: number;
  r: number;
}

/**
 * Seconds from one place to another leaving at `t`, as `seaLegSeconds` times a port-to-port leg:
 * for the quest steps that go to a spot at sea (decision 0195).
 */
export function placeSeconds(sea: Sea, ship: ShipClass, a: Place, b: Place, t: number): number {
  const centres = Math.hypot(b.x - a.x, b.y - a.y);
  const d = Math.max(0, centres - a.r - b.r);
  if (d <= 0) return 0;
  const ux = (b.x - a.x) / centres,
    uy = (b.y - a.y) / centres;
  const bearing = Math.atan2(b.x - a.x, b.y - a.y);
  const n = Math.min(16, Math.max(1, Math.ceil(d / ZONE_STRETCH)));
  let seconds = 8;
  for (let i = 0; i < n; i++) {
    const along = a.r + (d * (i + 0.5)) / n;
    spot.x = a.x + ux * along;
    spot.y = a.y + uy * along;
    const wind = windAt(sea.wind, t + seconds, sea.seed, spot);
    const current = currentAlong(sea.map, spot.x, spot.y, bearing, sea.currents);
    seconds += stretchSeconds(
      d / n,
      madeGoodIn(ship, bearing, wind.from, wind.speedKn, sea.seaDrag),
      current,
    );
  }
  return seconds;
}

/**
 * The ports charted when a voyage starts: the hidden shipwright yards stay out of a first session
 * (decision 0048), and so do the empty islands to found and the ports out in the fog (0156, 0157):
 * on the grown sea, the ring's ports. The "about a minute" leg checks hold these.
 */
export const chartedPorts = (map: MapDef) =>
  map.ports.filter((p) => {
    if (p.hidden || p.site) return false;
    const island = map.islands.find((i) => i.id === p.islandId);
    return !island || islandCharted(map, {}, island);
  });

interface Leg {
  to: string;
  good: GoodId | null;
  qty: number;
  gain: number;
  seconds: number;
  /** Seconds of the leg after it that `gain` counts too (a workshop run), for ranking only. */
  thenSeconds?: number;
}

/** Every load worth carrying from the docked port, best gold per second first. */
function legOptions(
  map: MapDef,
  trade: TradeState,
  from: string,
  contracts: boolean,
  sea: Sea,
  t: number,
  strict = false,
): Leg[] {
  const ship = effectiveShip(activeShip(trade), trade.captain.ships[trade.captain.activeShip]!);
  const here = trade.markets[from]!;
  const legs: Leg[] = [];
  // Only the ports on her chart: on a sea with fog, the seas open in story order (decision 0195).
  for (const dest of discoveredPorts(map, trade)) {
    if (dest.id === from) continue;
    const seconds = seaLegSeconds(sea, ship, from, dest.id, t) + DOCK_SECONDS;
    const there = trade.markets[dest.id]!;
    const order = trade.contracts.byPort[dest.id]!;
    legs.push({ to: dest.id, good: null, qty: 0, gain: 0, seconds });
    for (const good of GOODS) {
      // A port buys only what it trades: a far good only at its buyers (decision 0150). The ring's
      // early game keeps the 0046 bots' old reckoning for the ring's goods for now (a load to a
      // port that does not buy it rides along until one does), so the ring's tuned checks hold;
      // the story's voyages count only what sells (decision 0195).
      if ((strict || isFar(good)) && !trades(there, good)) continue;
      const most = Math.min(maxBuy(trade, good), capacity(trade));
      for (let qty = 1; qty <= most; qty++) {
        const fills =
          contracts && order.good === good && order.readyIn <= seconds && qty >= order.qty;
        const revenue = fills
          ? order.reward + quoteSell(there, good, qty - order.qty)
          : quoteSell(there, good, qty);
        const gain = revenue - quoteBuy(here, good, qty);
        const prev = legs[legs.length - 1]!;
        if (prev.to === dest.id && prev.good === good) {
          if (gain > prev.gain) Object.assign(prev, { qty, gain });
        } else legs.push({ to: dest.id, good, qty, gain, seconds });
      }
      const leg = legs[legs.length - 1]!;
      if (leg.to === dest.id && leg.good === good) workshopRun(map, trade, leg, sea, ship, t);
    }
    // An outpost's raw goods for the workshop, then the crafted goods to a buyer (0146).
    const gather = outpostRun(map, trade, dest.id, sea, ship, t + seconds);
    if (gather)
      for (const leg of legs)
        if (leg.to === dest.id && !leg.thenSeconds) {
          leg.gain += gather.gain;
          leg.thenSeconds = gather.seconds;
        }
  }
  const rank = (l: Leg) => l.gain / (l.seconds + (l.thenSeconds ?? 0));
  return legs.sort((x, y) => rank(y) - rank(x));
}

/**
 * The run from an outpost (decision 0146): a hold of its raw far good to the workshop that crafts
 * it, and the crafted goods on to their best buyer, as one plan. Null when no part of it pays.
 */
function outpostRun(
  map: MapDef,
  trade: TradeState,
  outpost: string,
  sea: Sea,
  ship: ShipClass,
  t: number,
): { gain: number; seconds: number } | null {
  const here = trade.markets[outpost]!;
  let out: { gain: number; seconds: number } | null = null;
  for (const raw of GOODS) {
    if (!isFar(raw) || isCrafted(raw) || !trades(here, raw)) continue;
    const qty = Math.min(available(here, raw), capacity(trade));
    if (qty <= 0) continue;
    const leg: Leg = { to: '', good: raw, qty, gain: 0, seconds: 0 };
    for (const port of discoveredPorts(map, trade)) {
      const there = trade.markets[port.id]!;
      if (port.id === outpost || !there.workshop || !trades(there, raw)) continue;
      const seconds = seaLegSeconds(sea, ship, outpost, port.id, t) + DOCK_SECONDS;
      const run = { ...leg, to: port.id, seconds };
      run.gain = quoteSell(there, raw, qty) - quoteBuy(here, raw, qty);
      workshopRun(map, trade, run, sea, ship, t);
      const total = run.seconds + (run.thenSeconds ?? 0);
      if (run.gain > 0 && (!out || run.gain / total > out.gain / out.seconds))
        out = { gain: run.gain, seconds: total };
    }
  }
  return out;
}

/**
 * Raw far goods for a workshop (decision 0146): a captain who knows the workshop crafts only from
 * what she brings counts the crafted goods' next leg too, to the best buyer, as one run.
 */
function workshopRun(
  map: MapDef,
  trade: TradeState,
  leg: Leg,
  sea: Sea,
  ship: ShipClass,
  t: number,
) {
  const there = trade.markets[leg.to]!;
  if (!leg.good || !there.workshop) return;
  let best = 0;
  let bestSeconds = 0;
  for (const crafted of Object.keys(there.workshop) as GoodId[]) {
    if (CRAFTED_FROM[crafted] !== leg.good) continue;
    for (const buyer of discoveredPorts(map, trade)) {
      const market = trade.markets[buyer.id]!;
      if (buyer.id === leg.to || !trades(market, crafted)) continue;
      const seconds = seaLegSeconds(sea, ship, leg.to, buyer.id, t + leg.seconds) + DOCK_SECONDS;
      const gain = quoteSell(market, crafted, leg.qty) - quoteBuy(there, crafted, leg.qty);
      if (gain / seconds > best / Math.max(1, bestSeconds)) {
        best = gain;
        bestSeconds = seconds;
      }
    }
  }
  if (best > 0) {
    leg.gain += best;
    leg.thenSeconds = bestSeconds;
  }
}

/**
 * A captain in the late game grows a buyer for a crafted far good no port buys yet, as the town
 * card asks (decisions 0065, 0146): she carries what a town that would buy it wants, from here.
 * If the buyers are port towns and the town waits for its rare goods, she fetches them from a
 * port that makes them, or first supplies a port that will make them until it does. The legs of
 * that errand, best first, or null.
 */
function portTownErrand(map: MapDef, trade: TradeState, at: string, all: Leg[]): Leg[] | null {
  const charted = discoveredPorts(map, trade);
  const made = madeGoods(map, trade);
  // Crafted goods made now that no port on her chart buys yet.
  const unsold = [...made].filter(
    (g) => isCrafted(g) && !charted.some((p) => wantsAt(map, trade, p.id).includes(g)),
  );
  const pick = (f: (o: Leg) => boolean) => {
    const legs = all.filter(f);
    return legs.length ? legs : null;
  };
  for (const town of charted) {
    const buysAt = Object.entries(town.levelWantsMade ?? {})
      .filter(([, goods]) => goods?.some((g) => unsold.includes(g)))
      .map(([level]) => Number(level));
    if (!buysAt.length) continue;
    const level = settlementLevel(trade, town.id);
    const gate = portTownGate(map, trade, town.id);
    if (!gate || level !== MAX_SETTLEMENT_LEVEL - 1 || Math.min(...buysAt) < MAX_SETTLEMENT_LEVEL) {
      // Not held by the rare goods: she grows the town with what it wants.
      if (Math.min(...buysAt) <= level) continue;
      const wants = wantsAt(map, trade, town.id);
      const legs = pick(
        (o) => o.to === town.id && !!o.good && wants.includes(o.good) && o.gain > 0,
      );
      if (legs) return legs;
      continue;
    }
    const makes = (id: string) => producesAt(map, trade, id).filter((g) => gate.goods.includes(g));
    const makers = charted.filter((p) => p.id !== town.id && makes(p.id).length);
    // A hold's worth comes back as the stock refills: go when there are a few to carry.
    const stocked = makers.filter((p) =>
      makes(p.id).some((g) => available(trade.markets[p.id]!, g) >= 5),
    );
    if (stocked.some((p) => p.id === at))
      return pick((o) => o.to === town.id && !!o.good && gate.goods.includes(o.good));
    if (stocked.length) return pick((o) => stocked.some((p) => p.id === o.to));
    if (makers.length) continue;
    // No port makes them yet: supply one that will, until it grows to make them.
    for (const p of charted) {
      const later = Object.values(p.levelProduces ?? {}).flat() as GoodId[];
      if (p.id === town.id || !later.some((g) => gate.goods.includes(g))) continue;
      const wants = wantsAt(map, trade, p.id);
      const legs = pick((o) => o.to === p.id && !!o.good && wants.includes(o.good));
      if (legs) return legs;
    }
  }
  return null;
}

/**
 * Times a story quest's steps in the voyage's wind (decision 0195): from where she is to each
 * place a step names, fetching its goods at the nearest port on her chart that makes them, a
 * dock's time per step for the cards and the handing over, and on to the nearest charted port.
 */
function questTimer(map: MapDef, trade: TradeState, sea: Sea): QuestTimer {
  const home = homePort(map).id;
  const portPlace = (id: string): Place | null => {
    const port = map.ports.find((p) => p.id === (id === 'home' ? home : id));
    const island = port && map.islands.find((i) => i.id === port.islandId);
    return island ? { x: island.x, y: island.y, r: island.radius } : null;
  };
  const far = (a: Place, b: Place) => Math.hypot(a.x - b.x, a.y - b.y);
  const nearest = (from: Place, ports: readonly { id: string }[]) => {
    let best: { id: string; place: Place } | null = null;
    for (const p of ports) {
      const place = portPlace(p.id);
      if (place && (!best || far(from, place) < far(from, best.place))) best = { id: p.id, place };
    }
    return best;
  };
  return (def, from, t) => {
    const ship = effectiveShip(activeShip(trade), trade.captain.ships[trade.captain.activeShip]!);
    let pos = portPlace(from)!;
    let seconds = 0;
    const go = (to: Place) => {
      seconds += placeSeconds(sea, ship, pos, to, t + seconds);
      pos = to;
    };
    for (const step of questVisits(def)) {
      seconds += DOCK_SECONDS;
      for (const visit of step) {
        if ('maker' in visit) {
          const good = visit.maker as GoodId;
          const makers = discoveredPorts(map, trade).filter((p) =>
            producesAt(map, trade, p.id).includes(good),
          );
          const maker = nearest(pos, makers);
          if (maker) go(maker.place);
        } else {
          const to = 'port' in visit ? portPlace(visit.port) : { ...visit, r: visit.within };
          if (to) go(to);
        }
      }
    }
    const end = nearest(pos, discoveredPorts(map, trade))!;
    go(end.place);
    return { seconds, at: end.id };
  };
}

/** Bought in this order at the home port. */
const SHOPPING: Array<UpgradeTrack | 'cutter'> = [
  'hold',
  'sails',
  'cutter',
  'hold',
  'sails',
  'hull',
  'hold',
  'sails',
  'hull',
];

export interface Voyage {
  /** Minutes of the first purchase of each item, e.g. "sloop hold", "cutter", "cutter sails". */
  bought: Record<string, number>;
  /** Every purchase in order, with its minute. */
  boughtAt: Array<[string, number]>;
  marketGold: number;
  contractGold: number;
  repairGold: number;
  legs: number;
  routes: Record<string, number>;
  /** Minute each port reached each level (decision 0059), e.g. "saltmere 3". */
  levels: Record<string, number>;
  /** Minute each outer sea opened in story order (decision 0195); empty on the ring. */
  opened: Record<string, number>;
  /** Gold the story's quests paid (decision 0195). */
  storyGold: number;
  /** Gold the standing orders paid (decision 0214). */
  standingGold: number;
  /** Minute each story quest was done, and the minutes each sea's quests took (ring: its arcs). */
  questsDone: Record<string, number>;
  storyMinutes: Record<string, number>;
  /** Market gold from far goods (decision 0150), and units of each sold. */
  farGold: number;
  farSold: Partial<Record<GoodId, number>>;
  /** Market and order gold after each leg: [minute, gold so far]. */
  income: Array<[number, number]>;
  /** Each leg sailed: [minute she left, seconds, a far sea's port at an end, a ring port at an end]. */
  sailed: Array<[number, number, boolean, boolean]>;
  /** Market gold, and the far goods' part of it, from `lateFrom` minutes on; routes sailed then. */
  lateMarket: number;
  lateFar: number;
  lateRoutes: string[];
}

export interface VoyageOptions {
  map: MapDef;
  contracts: boolean;
  relaxed: boolean;
  minutes?: number;
  /** Start the voyage on this difficulty level; without one, the 0046 game as created. */
  level?: Difficulty;
  seed?: number;
  /** Settings › Currents (decision 0145); on by default. */
  currents?: boolean;
  /** Minute the late game's tally starts (decision 0195). */
  lateFrom?: number;
  /**
   * Play the story on a sea with fog (decision 0195): the seas open through the quests. Without
   * it she trades on the ports charted at the start: the ring's early game, which the 0046 and
   * 0083 checks hold.
   */
  story?: boolean;
  /** `false`: she never takes the standing orders (decision 0214), for comparing. */
  standing?: boolean;
}

function must(ok: boolean, what: string) {
  if (!ok) throw new Error(`balance simulation: ${what} failed`);
}

export function sailVoyage(opts: VoyageOptions): Voyage {
  const { map } = opts;
  const minutes = opts.minutes ?? TARGETS.economy.minutes;
  const home = homePort(map).id;
  const world = createWorld(map, SLOOP);
  const trade = world.trade;
  if (opts.level) startVoyage(trade, opts.level);
  const sea = seaOf(map, { level: opts.level, seed: opts.seed ?? 7, currents: opts.currents });
  const damage = opts.level ? knobs(opts.level).damage : 1;
  const rng = createRng(opts.seed ?? 7);
  const v: Voyage = {
    bought: {},
    boughtAt: [],
    marketGold: 0,
    contractGold: 0,
    repairGold: 0,
    legs: 0,
    routes: {},
    levels: {},
    opened: {},
    storyGold: 0,
    standingGold: 0,
    questsDone: {},
    storyMinutes: {},
    farGold: 0,
    farSold: {},
    income: [],
    sailed: [],
    lateMarket: 0,
    lateFar: 0,
    lateRoutes: [],
  };
  const lateFrom = (opts.lateFrom ?? Infinity) * 60;
  const story = new StoryClock(map, opts.story ? storyChapters(map) : [], opts.relaxed ? 1.4 : 1);
  const timer = questTimer(map, trade, sea);
  if (story.active) story.ringMinutes(timer, home);
  const standing = new StandingOrders(map);
  const sight = TUNING.economy.discoverRange;
  const startPorts = new Set(chartedPorts(map).map((p) => p.id));
  let at = home;
  let t = 0;
  let next = 0;
  /** Time passes at sea: markets refill, orders come, towns grow or stall. */
  const pass = (seconds: number) => {
    for (const m of Object.values(trade.markets)) stepMarket(m, seconds);
    stepContracts(trade.contracts, seconds);
    // A neglected town, or the home port holding back an upgrade, asks for help (0069).
    syncHelpOrder(map, trade);
    t += seconds;
    for (const up of stepSettlements(trade, seconds, map))
      v.levels[`${up.portId} ${up.level}`] = t / 60;
    syncMarketLevels(trade, map);
  };
  while (t < minutes * 60) {
    trade.dockedAt = at;
    if (opts.relaxed) {
      const r = repairHull(trade);
      if (r.ok) v.repairGold += r.gold;
    }
    if (opts.contracts) {
      const r = deliverContract(trade, map);
      if (r.ok) v.contractGold += r.gold;
    }
    // People whose arc is done ask again (decision 0214).
    if (story.active && opts.standing !== false)
      v.standingGold += standing.dock(map, trade, at, story.done);
    // The story (decision 0195): once the cutter is hers and the ring's arcs could be sailed, she
    // plays each sea's quests as soon as each starts.
    if (v.bought.cutter !== undefined) story.begin(t / 60);
    story.step(trade, t / 60);
    for (let q = story.play(timer, at, t); q && t < minutes * 60; q = story.play(timer, at, t)) {
      pass(q.seconds);
      story.land(trade, t / 60, q.seconds);
      story.step(trade, t / 60);
      at = q.at;
      trade.dockedAt = at;
    }
    const late = t >= lateFrom;
    for (const g of GOODS) {
      const qty = trade.captain.cargo[g];
      if (!qty || !isFar(g) || !trades(trade.markets[at]!, g)) continue;
      const gold = quoteSell(trade.markets[at]!, g, qty);
      v.farGold += gold;
      if (late) v.lateFar += gold;
      v.farSold[g] = (v.farSold[g] ?? 0) + qty;
    }
    const before = trade.captain.gold;
    sellAll(trade, map);
    v.marketGold += trade.captain.gold - before;
    if (late) v.lateMarket += trade.captain.gold - before;

    // Shop in a fixed order at the home port, keeping a little gold back for the next load.
    while (at === home && next < SHOPPING.length) {
      const item = SHOPPING[next]!;
      const ship = trade.captain.activeShip;
      const price =
        item === 'cutter'
          ? CUTTER.price
          : upgradePrice(activeShip(trade), trade.captain.ships[ship]!, item);
      if (price === null) {
        next++;
        continue;
      }
      if (trade.captain.gold < price + 80) break;
      // The top upgrades wait for the home port to grow into a town (decision 0059).
      const levels = trade.captain.ships[ship]!;
      if (item !== 'cutter' && !upgradeAllowed(trade, map, levels[item] + 1)) break;
      const ok =
        item === 'cutter' ? buyShip(trade, map, 'cutter').ok : buyUpgrade(trade, map, item).ok;
      must(ok, `buying ${item}`);
      const name = item === 'cutter' ? 'cutter' : `${ship} ${item}`;
      v.bought[name] ??= t / 60;
      v.boughtAt.push([name, t / 60]);
      next++;
    }

    // With gold for the next purchase, head home to spend it (shipyard only there, 0048).
    const item = SHOPPING[next];
    const want =
      item === undefined
        ? null
        : item === 'cutter'
          ? CUTTER.price
          : upgradePrice(activeShip(trade), trade.captain.ships[trade.captain.activeShip]!, item);
    const allowed =
      item === undefined ||
      item === 'cutter' ||
      upgradeAllowed(trade, map, trade.captain.ships[trade.captain.activeShip]![item] + 1);
    const goHome = at !== home && want !== null && allowed && trade.captain.gold >= want + 80;
    const all = legOptions(map, trade, at, opts.contracts, sea, t, story.active);
    const errand = goHome || !story.started ? null : portTownErrand(map, trade, at, all);
    const options = goHome ? all.filter((o) => o.to === home) : (errand ?? all);
    let leg = options[0]!;
    if (opts.relaxed) {
      const paying = options.filter((o) => o.gain > 0).slice(0, 3);
      const r = rng();
      leg = paying[Math.min(paying.length - 1, r < 0.5 ? 0 : r < 0.8 ? 1 : 2)] ?? leg;
    }
    if (leg.good && leg.qty > 0) must(buy(trade, leg.good, leg.qty).ok, `buying ${leg.good}`);
    const key = `${at}>${leg.to}`;
    v.routes[key] = (v.routes[key] ?? 0) + 1;
    if (t >= lateFrom) v.lateRoutes.push(key);
    trade.dockedAt = null;
    const seconds = leg.seconds * (opts.relaxed ? 1.4 : 1);
    if (opts.relaxed && rng() < 0.2) damageHull(trade, (20 + rng() * 30) * damage);
    pass(seconds);
    // Once the seas open, what she sails into or sights on the way goes on the chart (0156), and
    // so do the hidden ports she passes (0048).
    if (story.started)
      for (const [x, y] of legPath(map, at, leg.to).points) {
        stepFog(map, trade.progress, { x, y }, sight);
        discoverNear(trade, map, { x, y });
      }
    v.sailed.push([
      (t - seconds) / 60,
      seconds,
      !startPorts.has(at) || !startPorts.has(leg.to),
      startPorts.has(at) || startPorts.has(leg.to),
    ]);
    at = leg.to;
    v.legs++;
    v.income.push([t / 60, v.marketGold + v.contractGold + v.standingGold]);
  }
  v.opened = story.opened;
  v.questsDone = story.done;
  v.storyMinutes = story.chapterMinutes;
  v.storyGold = story.gold;
  return v;
}

/** Minute the cutter's hull reached level 3 (its second hull upgrade), or Infinity. */
export const cutterMaxed = (v: Voyage) =>
  v.boughtAt.filter(([n]) => n === 'cutter hull')[1]?.[1] ?? Infinity;

/** One target held against a run, for the tests and the panel. */
export interface BalanceCheck {
  id: string;
  label: string;
  /** What the run gave, e.g. "11.4 min". */
  actual: string;
  /** What it should be, e.g. "9–16 min". */
  target: string;
  ok: boolean;
}

const min = (m: number | undefined) =>
  m === undefined || !Number.isFinite(m) ? 'never' : `${m.toFixed(1)} min`;
const pct = (x: number) => `${Math.round(100 * x)} %`;
/** Undefined milestones fail every comparison, as `expect(undefined)` would. */
const n = (m: number | undefined) => m ?? NaN;

// --- 0046: one level, 40 minutes ------------------------------------------------------------

export interface EconomyRun {
  sharp: Voyage;
  sharpMarket: Voyage;
  relaxed: Voyage;
  /** Shortest and longest sloop leg between charted ports, seconds. */
  legRange: [number, number];
  /** Busiest route's share of the legs and how many routes, each sharp voyage (with and without orders). */
  routes: Array<{ top: number; count: number }>;
}

const routeShare = (v: Voyage) => ({
  top: Math.max(...Object.values(v.routes)) / v.legs,
  count: Object.keys(v.routes).length,
});

/**
 * The voyage whose cutter came at the median minute over the seeds: each seed is another
 * voyage's weather, so one seed alone could be a lucky or an unlucky one (decision 0149).
 */
export function medianVoyage(runs: readonly Voyage[]): Voyage {
  return [...runs].sort((a, b) => (a.bought.cutter ?? Infinity) - (b.bought.cutter ?? Infinity))[
    Math.floor(runs.length / 2)
  ]!;
}

const medianOf = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

export function economyRun(map: MapDef): EconomyRun {
  const ports = chartedPorts(map);
  const legs = ports.flatMap((a) =>
    ports.filter((b) => b !== a).map((b) => legSeconds(map, SLOOP, a.id, b.id)),
  );
  const sail = (contracts: boolean, relaxed: boolean) =>
    TARGETS.economy.seeds.map((seed) => sailVoyage({ map, contracts, relaxed, seed }));
  const sharpRuns = sail(true, false);
  const marketRuns = sail(false, false);
  return {
    sharp: medianVoyage(sharpRuns),
    sharpMarket: medianVoyage(marketRuns),
    relaxed: medianVoyage(sail(true, true)),
    legRange: [Math.min(...legs), Math.max(...legs)],
    routes: [...sharpRuns, ...marketRuns].map(routeShare),
  };
}

export function economyChecks(r: EconomyRun): BalanceCheck[] {
  const T = TARGETS.economy;
  const { sharp, sharpMarket, relaxed } = r;
  const orderShare = sharp.contractGold / (sharp.contractGold + sharp.marketGold);
  const relaxedIncome = relaxed.marketGold + relaxed.contractGold;
  // Median over the seeds: one voyage's weather can favour one route (decision 0149).
  const half = r.routes.length / 2;
  const top = Math.max(
    medianOf(r.routes.slice(0, half).map((x) => x.top)),
    medianOf(r.routes.slice(half).map((x) => x.top)),
  );
  const count = Math.min(
    medianOf(r.routes.slice(0, half).map((x) => x.count)),
    medianOf(r.routes.slice(half).map((x) => x.count)),
  );
  return [
    {
      id: 'legs',
      label: 'Sloop legs between ports take about a minute',
      actual: `${Math.round(r.legRange[0])}–${Math.round(r.legRange[1])} s`,
      target: `${T.legSeconds[0]}–${T.legSeconds[1]} s`,
      ok: r.legRange[0] > T.legSeconds[0]! && r.legRange[1] < T.legSeconds[1]!,
    },
    {
      id: 'sharp-first-upgrade',
      label: 'Sharp captain: first upgrade',
      actual: min(sharp.bought['sloop hold']),
      target: `≤ ${T.sharpFirstUpgradeMax} min`,
      ok: n(sharp.bought['sloop hold']) <= T.sharpFirstUpgradeMax,
    },
    {
      id: 'sharp-cutter',
      label: 'Sharp captain: cutter',
      actual: min(sharp.bought.cutter),
      target: `${T.sharpCutter[0]}–${T.sharpCutter[1]} min`,
      ok:
        n(sharp.bought.cutter) >= T.sharpCutter[0]! && n(sharp.bought.cutter) <= T.sharpCutter[1]!,
    },
    {
      id: 'sharp-maxed',
      label: 'Sharp captain: cutter fully upgraded (a long-run goal)',
      actual: min(cutterMaxed(sharp)),
      target: `≥ ${T.sharpCutterMaxedMin} min`,
      ok: cutterMaxed(sharp) >= T.sharpCutterMaxedMin,
    },
    {
      id: 'relaxed-first-upgrade',
      label: 'Relaxed captain: first upgrade',
      actual: min(relaxed.bought['sloop hold']),
      target: `≤ ${T.relaxedFirstUpgradeMax} min`,
      ok: n(relaxed.bought['sloop hold']) <= T.relaxedFirstUpgradeMax,
    },
    {
      id: 'relaxed-cutter',
      label: 'Relaxed captain: cutter',
      actual: min(relaxed.bought.cutter),
      target: `≤ ${T.relaxedCutterMax} min`,
      ok: n(relaxed.bought.cutter) <= T.relaxedCutterMax,
    },
    {
      id: 'order-share',
      label: 'Delivery orders help, market trading carries the game',
      actual: `${pct(orderShare)} of gold from orders`,
      target: `${pct(T.orderShare[0]!)}–${pct(T.orderShare[1]!)}`,
      ok: orderShare > T.orderShare[0]! && orderShare < T.orderShare[1]!,
    },
    {
      id: 'market-only-cutter',
      label: 'Market trading alone reaches the cutter, later',
      actual: min(sharpMarket.bought.cutter),
      target: `after ${min(sharp.bought.cutter)}, ≤ ${T.marketOnlyCutterMax} min`,
      ok:
        n(sharpMarket.bought.cutter) > n(sharp.bought.cutter) &&
        n(sharpMarket.bought.cutter) <= T.marketOnlyCutterMax,
    },
    {
      id: 'routes',
      label: 'No single route is the only good one',
      actual: `top route ${pct(top)}, ${count} routes`,
      target: `< ${pct(T.topRouteShareMax)}, ≥ ${T.routesMin}`,
      ok: top < T.topRouteShareMax && count >= T.routesMin,
    },
    {
      id: 'repairs',
      label: 'Repairs sting but do not stall a careless captain',
      actual: `${pct(relaxed.repairGold / relaxedIncome)} of income`,
      target: `> 0, < ${pct(T.repairShareMax)}`,
      ok: relaxed.repairGold > 0 && relaxed.repairGold / relaxedIncome < T.repairShareMax,
    },
  ];
}

// --- 0083: each difficulty level, two hours, median of a few seeds ---------------------------

export interface Pace {
  firstUpgrade?: number;
  cutter?: number;
  maxed?: number;
  firstTown?: number;
  /** Share of income spent on repairs. */
  repairs: number;
}

/** Median milestones of a captain over a few seeds, each its own weather (and luck if relaxed). */
export function pace(map: MapDef, level: Difficulty, relaxed: boolean, currents = true): Pace {
  const T = TARGETS.difficulty;
  const runs = T.seeds.map((seed) =>
    sailVoyage({ map, contracts: true, relaxed, minutes: T.minutes, level, seed, currents }),
  );
  const median = (f: (v: Voyage) => number | undefined) => {
    const xs = runs.map((v) => f(v) ?? Infinity).sort((a, b) => a - b);
    const m = xs[Math.floor(xs.length / 2)]!;
    return Number.isFinite(m) ? m : undefined;
  };
  const firstTown = (v: Voyage) => {
    const ms = Object.entries(v.levels)
      .filter(([k]) => k.endsWith(' 3'))
      .map(([, m]) => m);
    return ms.length ? Math.min(...ms) : undefined;
  };
  return {
    firstUpgrade: median((v) => v.bought['sloop hold']),
    cutter: median((v) => v.bought.cutter),
    maxed: median((v) => v.boughtAt.filter(([x]) => x === 'cutter hull')[1]?.[1]),
    firstTown: median(firstTown),
    repairs: median((v) => v.repairGold / (v.marketGold + v.contractGold)) ?? 0,
  };
}

/** Sloop leg times on one level, seconds, over every charted pair at many moments (0149). */
export interface LegTimes {
  median: number;
  /** Nine legs in ten are quicker than this. */
  slow: number;
}

/**
 * Sloop legs between every pair of charted ports, leaving every few minutes of each seed's two
 * hours, in that level's wind and currents.
 */
export function legTimes(map: MapDef, level: Difficulty, currents = true): LegTimes {
  const T = TARGETS.difficulty;
  const ports = chartedPorts(map);
  const legs: number[] = [];
  for (const seed of T.seeds) {
    const sea = seaOf(map, { level, seed, currents });
    for (let t = 0; t < T.minutes * 60; t += T.legEverySec)
      for (const a of ports)
        for (const b of ports) if (a !== b) legs.push(seaLegSeconds(sea, SLOOP, a.id, b.id, t));
  }
  legs.sort((a, b) => a - b);
  const at = (q: number) => legs[Math.floor(q * (legs.length - 1))] ?? NaN;
  return { median: at(0.5), slow: at(0.9) };
}

export interface LevelRun {
  sharp: Pace;
  relaxed: Pace;
  legs: LegTimes;
  /** The relaxed captain with Settings › Currents off, to see what the currents change. */
  stillWater?: Pace;
}

export type DifficultyRun = Record<Difficulty, LevelRun>;

/**
 * Every level (decision 0083) in its own wind and currents (0149). `stillWater` also sails the
 * relaxed captain with the currents off, for the "currents do not tip the balance" check.
 */
export function difficultyRun(
  map: MapDef,
  onLevel?: (level: Difficulty) => void,
  stillWater = true,
): DifficultyRun {
  const out = {} as DifficultyRun;
  for (const level of DIFFICULTIES) {
    onLevel?.(level);
    out[level] = {
      sharp: pace(map, level, false),
      relaxed: pace(map, level, true),
      legs: legTimes(map, level),
      ...(stillWater && map.currents?.length ? { stillWater: pace(map, level, true, false) } : {}),
    };
  }
  return out;
}

/** A level's English name from its file entry (decision 0113). */
export const levelName = (id: Difficulty) => TUNING.difficulty.levels[id]?.name ?? id;

export function difficultyChecks(by: DifficultyRun): BalanceCheck[] {
  const T = TARGETS.difficulty;
  // The targets name the three shipped levels; a missing one fails its checks.
  const none: LevelRun = {
    sharp: { repairs: NaN },
    relaxed: { repairs: NaN },
    legs: { median: NaN, slow: NaN },
  };
  const [fair, captain, salt] = ['fair', 'captain', 'salt'].map((id) => by[id] ?? none) as [
    DifficultyRun[string],
    DifficultyRun[string],
    DifficultyRun[string],
  ];
  return [
    {
      id: 'levels-ordered',
      label: 'Each level is slower than the one before (relaxed captain, cutter)',
      actual: `${min(fair.relaxed.cutter)} / ${min(captain.relaxed.cutter)} / ${min(salt.relaxed.cutter)}`,
      target: 'Fair winds < Captain < Old salt',
      ok:
        n(fair.relaxed.cutter) < n(captain.relaxed.cutter) &&
        n(captain.relaxed.cutter) < n(salt.relaxed.cutter) &&
        n(fair.relaxed.firstTown) < n(salt.relaxed.firstTown),
    },
    {
      id: 'fair-first-upgrade',
      label: 'Fair winds, relaxed: first upgrade',
      actual: min(fair.relaxed.firstUpgrade),
      target: `≤ ${T.fairFirstUpgradeMax} min`,
      ok: n(fair.relaxed.firstUpgrade) <= T.fairFirstUpgradeMax,
    },
    {
      id: 'fair-cutter',
      label: 'Fair winds, relaxed: cutter',
      actual: min(fair.relaxed.cutter),
      target: `≤ ${T.fairCutterMax} min`,
      ok: n(fair.relaxed.cutter) <= T.fairCutterMax,
    },
    {
      id: 'fair-towns',
      label: 'Fair winds: towns grow much sooner',
      actual: `first town ${min(fair.relaxed.firstTown)}`,
      target: `< ${min(n(captain.relaxed.firstTown) * T.fairFirstTownVsCaptainMax)}`,
      ok: n(fair.relaxed.firstTown) < n(captain.relaxed.firstTown) * T.fairFirstTownVsCaptainMax,
    },
    {
      id: 'salt-cutter',
      label: 'Old salt, relaxed: cutter within a long evening',
      actual: min(salt.relaxed.cutter),
      target: `${T.saltCutter[0]}–${T.saltCutter[1]} min`,
      ok: n(salt.relaxed.cutter) >= T.saltCutter[0]! && n(salt.relaxed.cutter) <= T.saltCutter[1]!,
    },
    {
      id: 'salt-repairs',
      label: 'Old salt: mistakes sting',
      actual: `repairs ${pct(salt.relaxed.repairs)} of income`,
      target: `> ${pct(captain.relaxed.repairs * T.saltRepairsVsCaptainMin)}`,
      ok: salt.relaxed.repairs > captain.relaxed.repairs * T.saltRepairsVsCaptainMin,
    },
    {
      id: 'legs-every-level',
      label: 'Sloop legs take about a minute on every level, in its wind and currents',
      actual: DIFFICULTIES.map(
        (l) => `${Math.round(by[l]!.legs.median)} s (${Math.round(by[l]!.legs.slow)} s)`,
      ).join(' / '),
      target: `median ${T.legMedian[0]}–${T.legMedian[1]} s, 9 in 10 under ${T.legSlowMax} s`,
      ok: DIFFICULTIES.every(
        (l) =>
          by[l]!.legs.median >= T.legMedian[0]! &&
          by[l]!.legs.median <= T.legMedian[1]! &&
          by[l]!.legs.slow <= T.legSlowMax,
      ),
    },
    ...(DIFFICULTIES.some((l) => by[l]!.stillWater)
      ? [
          {
            id: 'currents-shift',
            label: 'Currents change the pace a little, not the balance (relaxed captain, cutter)',
            actual: DIFFICULTIES.map((l) => {
              const still = by[l]!.stillWater?.cutter;
              const now = by[l]!.relaxed.cutter;
              return still === undefined || now === undefined
                ? 'never'
                : `${now - still >= 0 ? '+' : '−'}${Math.abs(now - still).toFixed(1)} min`;
            }).join(' / '),
            target: `within ${pct(T.currentsShiftMax)} of still water`,
            ok: DIFFICULTIES.every((l) => {
              const still = by[l]!.stillWater;
              return (
                !still ||
                Math.abs(n(by[l]!.relaxed.cutter) - n(still.cutter)) <=
                  n(still.cutter) * T.currentsShiftMax
              );
            }),
          },
        ]
      : []),
    {
      id: 'sharp-every-level',
      label: 'A sharp captain reaches the cutter early on every level',
      actual: DIFFICULTIES.map((l) => min(by[l]!.sharp.cutter)).join(' / '),
      target: `≤ ${T.sharpCutterMax} min`,
      ok: DIFFICULTIES.every((l) => n(by[l]!.sharp.cutter) <= T.sharpCutterMax),
    },
  ];
}

// --- 0195: the grown sea in story order, the late game -----------------------------------------

/** One level's late game: medians over the story seeds. */
export interface StoryPace {
  /** Minute each sea opened, relaxed captain. */
  opened: Record<string, number>;
  /** Minute the last sea's outpost was founded, relaxed captain (undefined: not in the run). */
  allFounded?: number;
  /** Minute the sharp captain founded it. */
  sharpFounded?: number;
  /** Minutes each sea's quests took to sail (ring: the ring's arcs), relaxed and sharp captain. */
  arcMinutes: Record<string, number>;
  sharpArcMinutes: Record<string, number>;
  /** Relaxed captain's market and order gold per minute: the ring alone, and the run's last hour. */
  ringRate: number;
  lateRate: number;
  /** Share of the relaxed captain's late market gold from far goods. */
  farShare: number;
  /** Share of the relaxed captain's legs in the last hour that start or end at a ring port. */
  ringLegs: number;
  /** Median seconds of the legs to or from a far sea's port, relaxed captain. */
  farLegs: number;
  /** Crafted far goods the sharp captain sold, units. */
  craftedSold: Partial<Record<GoodId, number>>;
  /** Share of the quests' gold in the relaxed captain's income. */
  storyShare: number;
  /** Share of the standing orders' gold in the relaxed captain's last hour of income (0214). */
  standingShare: number;
  /** Busiest route's share of the relaxed captain's legs in the last hour. */
  lateTopRoute: number;
}

export type StoryRun = Record<Difficulty, StoryPace>;

const goldAt = (v: Voyage, minute: number) => {
  let g = 0;
  for (const [m, gold] of v.income) if (m <= minute) g = gold;
  return g;
};

/**
 * The relaxed and the sharp captain on every level for the story's minutes (decision 0195): the
 * ring until the cutter, then each sea in story order. Only on a sea with chart areas.
 */
export function storyRun(map: MapDef, onLevel?: (level: Difficulty) => void): StoryRun | null {
  if (!storyChapters(map).length) return null;
  const S = TARGETS.story;
  const out = {} as StoryRun;
  for (const level of DIFFICULTIES) {
    onLevel?.(level);
    const sail = (relaxed: boolean) =>
      S.seeds.map((seed) =>
        sailVoyage({
          map,
          contracts: true,
          relaxed,
          minutes: S.minutes,
          level,
          seed,
          lateFrom: late,
          story: true,
        }),
      );
    const late = S.minutes - S.lateMinutes;
    const relaxed = sail(true);
    const sharp = sail(false);
    const med = (xs: number[]) => medianOf(xs.map((x) => (Number.isNaN(x) ? Infinity : x)));
    const seas = storyChapters(map).map((c) => c.sea);
    const lastQuest = storyChapters(map).at(-1)!.beats.at(-1)!.quest;
    const founded = med(relaxed.map((v) => v.questsDone[lastQuest] ?? Infinity));
    const seaMinutes = (runs: Voyage[]) =>
      Object.fromEntries(
        ['ring', ...seas].map((sea) => [sea, med(runs.map((v) => v.storyMinutes[sea] ?? NaN))]),
      );
    const crafted: Partial<Record<GoodId, number>> = {};
    for (const g of GOODS) if (isCrafted(g)) crafted[g] = med(sharp.map((v) => v.farSold[g] ?? 0));
    out[level] = {
      opened: Object.fromEntries(
        seas.map((sea) => [sea, med(relaxed.map((v) => v.opened[sea] ?? Infinity))]),
      ),
      allFounded: Number.isFinite(founded) && founded <= S.minutes ? founded : undefined,
      sharpFounded: (() => {
        const m = med(sharp.map((v) => v.questsDone[lastQuest] ?? Infinity));
        return Number.isFinite(m) ? m : undefined;
      })(),
      arcMinutes: seaMinutes(relaxed),
      sharpArcMinutes: seaMinutes(sharp),
      ringRate: med(
        relaxed.map((v) => {
          const end = v.opened[seas[0]!] ?? S.minutes;
          return goldAt(v, end) / end;
        }),
      ),
      lateRate: med(relaxed.map((v) => (goldAt(v, S.minutes) - goldAt(v, late)) / S.lateMinutes)),
      farShare: med(relaxed.map((v) => v.lateFar / Math.max(1, v.lateMarket))),
      ringLegs: med(
        relaxed.map((v) => {
          const lateLegs = v.sailed.filter(([m]) => m >= late);
          return lateLegs.filter(([, , , ring]) => ring).length / Math.max(1, lateLegs.length);
        }),
      ),
      farLegs: med(
        relaxed.map((v) => {
          const far = v.sailed.filter(([, , f]) => f).map(([, sec]) => sec);
          return far.length ? medianOf(far) : NaN;
        }),
      ),
      craftedSold: crafted,
      storyShare: med(
        relaxed.map((v) => v.storyGold / (v.storyGold + v.marketGold + v.contractGold)),
      ),
      standingShare: med(
        relaxed.map(
          (v) => v.standingGold / Math.max(1, v.standingGold + v.marketGold + v.contractGold),
        ),
      ),
      lateTopRoute: med(
        relaxed.map((v) => {
          const n: Record<string, number> = {};
          let all = 0;
          v.lateRoutes.forEach((r) => {
            n[r] = (n[r] ?? 0) + 1;
            all++;
          });
          return all ? Math.max(...Object.values(n)) / all : 0;
        }),
      ),
    };
  }
  return out;
}

export function storyChecks(by: StoryRun): BalanceCheck[] {
  const T = TARGETS.story;
  // A level may go higher: Fair winds, where standing orders keep far prices up (decision 0214).
  const lateTop = (l: Difficulty) =>
    (T.lateVsRingTopByLevel as Record<string, number | undefined>)[l] ?? T.lateVsRing[1]!;
  const levels = DIFFICULTIES.map((l) => by[l]!);
  const each = (f: (p: StoryPace) => string) => levels.map(f).join(' / ');
  const x = (r: number) => `${r.toFixed(1)}×`;
  const crafted = GOODS.filter(isCrafted);
  return [
    {
      id: 'story-opens',
      label: 'Every sea opens and its outpost is founded within the run (relaxed captain)',
      actual: each((p) => min(p.allFounded)),
      target: `≤ ${T.minutes} min`,
      ok: levels.every((p) => p.allFounded !== undefined),
    },
    {
      id: 'far-pays',
      label: 'The far seas pay more than the ring (relaxed, last hour vs the ring alone)',
      actual: each((p) => x(p.lateRate / p.ringRate)),
      target: `${x(T.lateVsRing[0]!)}–${DIFFICULTIES.map((l) => x(lateTop(l))).join(' / ')}`,
      ok: DIFFICULTIES.every((l) => {
        const r = by[l]!.lateRate / by[l]!.ringRate;
        return r >= T.lateVsRing[0]! && r <= lateTop(l);
      }),
    },
    {
      id: 'far-share',
      label: 'Far goods carry the late game (relaxed, last hour)',
      actual: each((p) => pct(p.farShare)),
      target: `≥ ${pct(T.farShareMin)} of market gold`,
      ok: levels.every((p) => p.farShare >= T.farShareMin),
    },
    {
      id: 'ring-legs',
      label: 'The ring still counts: its ports buy the crafts (relaxed, last hour)',
      actual: each((p) => pct(p.ringLegs)),
      target: `≥ ${pct(T.ringLegsMin)} of legs start or end at a ring port`,
      ok: levels.every((p) => p.ringLegs >= T.ringLegsMin),
    },
    {
      id: 'far-crafted',
      label: "Every sea's crafted good sells (sharp captain)",
      actual: each((p) =>
        crafted.map((g) => `${g} ${Math.round(p.craftedSold[g] ?? 0)}`).join(', '),
      ),
      target: `≥ ${T.craftedSoldMin} of each`,
      ok: levels.every((p) => crafted.every((g) => (p.craftedSold[g] ?? 0) >= T.craftedSoldMin)),
    },
    {
      id: 'far-legs',
      label: "Legs to and from the far seas' ports (relaxed captain, sailed)",
      actual: each((p) => `${Math.round(p.farLegs)} s`),
      target: `median ≤ ${T.farLegMedianMax} s`,
      ok: levels.every((p) => p.farLegs <= T.farLegMedianMax),
    },
    {
      id: 'late-ordered',
      label: 'Each level earns less in the late game than the one before (relaxed)',
      actual: each((p) => `${Math.round(p.lateRate)}/min`),
      target: 'Fair winds > Captain > Old salt',
      ok: levels.every((p, i) => i === 0 || p.lateRate < levels[i - 1]!.lateRate),
    },
    {
      id: 'late-routes',
      label: 'No single route is the only good one in the late game (relaxed)',
      actual: each((p) => pct(p.lateTopRoute)),
      target: `< ${pct(T.topRouteShareMax)}`,
      ok: levels.every((p) => p.lateTopRoute < T.topRouteShareMax),
    },
    {
      id: 'story-gold',
      label: "The quests' gold helps, trade carries the game (relaxed)",
      actual: each((p) => pct(p.storyShare)),
      target: `≤ ${pct(T.storyShareMax)} of all gold`,
      ok: levels.every((p) => p.storyShare <= T.storyShareMax),
    },
  ];
}
