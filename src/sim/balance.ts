import { TUNING } from '../data/tuning';
import TARGETS from '../data/balance-targets.json';
import { deliverContract, stepContracts, syncHelpOrder } from './contracts';
import { CurrentField } from './currents';
import { DEFAULT_DIFFICULTY, DIFFICULTIES, type Difficulty, knobs, weatherFor } from './difficulty';
import { GOODS, type GoodId } from './goods';
import { damageHull, repairHull } from './hazards';
import type { MapDef } from './map';
import { quoteBuy, quoteSell, stepMarket } from './market';
import { DEG } from './math';
import { smoothOutline } from './flowShapes';
import { NO_ZONE, type ZoneEffect, zoneField, zoneMeanAt } from './windZones';
import { createRng } from './rng';
import { stepSettlements } from './settlement';
import { CUTTER, SLOOP, type ShipClass, polarFraction } from './ship';
import { homePort } from './shipyards';
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

/** Best speed made good along `bearing` (kn), sailing straight or tacking, in one wind. */
function madeGoodIn(ship: ShipClass, bearing: number, from: number, kn: number): number {
  const drive = drivingWind(kn) * ship.speedRatio;
  let best = 0;
  for (let a = -180; a <= 180; a += 2)
    best = Math.max(
      best,
      polarFraction(ship, from - bearing - a * DEG) * drive * Math.cos(a * DEG),
    );
  return best;
}

/** Best speed made good along `bearing` (kn), averaged over the weather. */
function madeGood(ship: ShipClass, bearing: number, weather: Weather[]): number {
  let sum = 0;
  for (const w of weather) sum += madeGoodIn(ship, bearing, w.from, w.kn);
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
 * Seconds from one port to another averaged over a range of winds, in the zones' average wind and
 * the currents at `currents` strength (Captain's by default). For the "about a minute" check.
 */
export function legSeconds(
  map: MapDef,
  ship: ShipClass,
  from: string,
  to: string,
  weather = weathers(map, SHIFTING_SPREAD),
  currents = 1,
): number {
  const zones = zoneField(map.windZones, smoothOutline);
  // Cached per weather list, since the checks ask for the same legs again.
  let byWeather = averageLegs.get(weather);
  if (!byWeather) averageLegs.set(weather, (byWeather = new Map()));
  const key = `${map.name}:${ship.id}:${ship.speedRatio}:${from}:${to}:${currents}`;
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
    seconds += stretchSeconds(path.stretch, madeGood(ship, path.bearing, local), current);
  }
  byWeather.set(key, seconds);
  return seconds;
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
  for (const [x, y] of path.points) {
    spot.x = x;
    spot.y = y;
    const wind = windAt(sea.wind, t + seconds, sea.seed, spot);
    const current = currentAlong(sea.map, x, y, path.bearing, sea.currents);
    seconds += stretchSeconds(
      path.stretch,
      madeGoodIn(ship, path.bearing, wind.from, wind.speedKn),
      current,
    );
  }
  return seconds;
}
const spot = { x: 0, y: 0 };

/** The charted ports: the hidden shipwright yards stay out of a first session (decision 0048). */
export const chartedPorts = (map: MapDef) => map.ports.filter((p) => !p.hidden);

interface Leg {
  to: string;
  good: GoodId | null;
  qty: number;
  gain: number;
  seconds: number;
}

/** Every load worth carrying from the docked port, best gold per second first. */
function legOptions(
  map: MapDef,
  trade: TradeState,
  from: string,
  contracts: boolean,
  sea: Sea,
  t: number,
): Leg[] {
  const ship = effectiveShip(activeShip(trade), trade.captain.ships[trade.captain.activeShip]!);
  const here = trade.markets[from]!;
  const legs: Leg[] = [];
  for (const dest of chartedPorts(map)) {
    if (dest.id === from) continue;
    const seconds = seaLegSeconds(sea, ship, from, dest.id, t) + DOCK_SECONDS;
    const there = trade.markets[dest.id]!;
    const order = trade.contracts.byPort[dest.id]!;
    legs.push({ to: dest.id, good: null, qty: 0, gain: 0, seconds });
    for (const good of GOODS) {
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
    }
  }
  return legs.sort((x, y) => y.gain / y.seconds - x.gain / x.seconds);
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
  };
  let at = home;
  let t = 0;
  let next = 0;
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
    const before = trade.captain.gold;
    sellAll(trade, map);
    v.marketGold += trade.captain.gold - before;

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
    const all = legOptions(map, trade, at, opts.contracts, sea, t);
    const options = goHome ? all.filter((o) => o.to === home) : all;
    let leg = options[0]!;
    if (opts.relaxed) {
      const paying = options.filter((o) => o.gain > 0).slice(0, 3);
      const r = rng();
      leg = paying[Math.min(paying.length - 1, r < 0.5 ? 0 : r < 0.8 ? 1 : 2)] ?? leg;
    }
    if (leg.good && leg.qty > 0) must(buy(trade, leg.good, leg.qty).ok, `buying ${leg.good}`);
    const key = `${at}>${leg.to}`;
    v.routes[key] = (v.routes[key] ?? 0) + 1;
    trade.dockedAt = null;
    const seconds = leg.seconds * (opts.relaxed ? 1.4 : 1);
    if (opts.relaxed && rng() < 0.2) damageHull(trade, (20 + rng() * 30) * damage);
    for (const m of Object.values(trade.markets)) stepMarket(m, seconds);
    stepContracts(trade.contracts, seconds);
    // A neglected town, or the home port holding back an upgrade, asks for help (0069).
    syncHelpOrder(map, trade);
    t += seconds;
    for (const up of stepSettlements(trade, seconds, map))
      v.levels[`${up.portId} ${up.level}`] = t / 60;
    syncMarketLevels(trade, map);
    at = leg.to;
    v.legs++;
  }
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
