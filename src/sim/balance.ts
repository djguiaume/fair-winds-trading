import { TUNING } from '../data/tuning';
import TARGETS from '../data/balance-targets.json';
import { deliverContract, stepContracts, syncHelpOrder } from './contracts';
import { DIFFICULTIES, type Difficulty, knobs } from './difficulty';
import { GOODS, type GoodId } from './goods';
import { damageHull, repairHull } from './hazards';
import type { MapDef } from './map';
import { quoteBuy, quoteSell, stepMarket } from './market';
import { DEG } from './math';
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

/**
 * The balance simulation (decisions 0046, 0083, 0114). Simulated captains trade on a map for a
 * while: a sharp one always takes the best paying leg; a relaxed one sails slower, often settles
 * for the second or third best load and strikes something now and then. Leg times come from the
 * ship polars over the shifting (or steady) wind's range, so they follow sailing changes too.
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

/** ±50° for the shifting wind (0026); the steady trade wind stays within about ±10° (0083). */
const SHIFTING_SPREAD = 50;
const STEADY_SPREAD = 10;

function islandOfPort(map: MapDef, portId: string) {
  const port = map.ports.find((p) => p.id === portId)!;
  return map.islands.find((i) => i.id === port.islandId)!;
}

/** Best speed made good along `bearing` (kn), sailing straight or tacking, averaged over the weather. */
function madeGood(ship: ShipClass, bearing: number, weather: Weather[]): number {
  let sum = 0;
  for (const w of weather) {
    let best = 0;
    for (let a = -180; a <= 180; a += 2) {
      const speed = polarFraction(ship, w.from - bearing - a * DEG) * w.kn * ship.speedRatio;
      best = Math.max(best, speed * Math.cos(a * DEG));
    }
    sum += best;
  }
  return sum / weather.length;
}

/** Seconds from one port to another: 15 % detour round islands and reefs, manoeuvring losses. */
export function legSeconds(
  map: MapDef,
  ship: ShipClass,
  from: string,
  to: string,
  weather = weathers(map, SHIFTING_SPREAD),
): number {
  const a = islandOfPort(map, from);
  const b = islandOfPort(map, to);
  const d = Math.hypot(b.x - a.x, b.y - a.y) - a.radius - b.radius;
  const bearing = Math.atan2(b.x - a.x, b.y - a.y);
  const knotToUnits = TUNING.seamanship.boat.knotToUnits;
  return (d * 1.15) / (madeGood(ship, bearing, weather) * 0.9 * knotToUnits) + 8;
}

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
  weather: Weather[],
): Leg[] {
  const ship = effectiveShip(activeShip(trade), trade.captain.ships[trade.captain.activeShip]!);
  const here = trade.markets[from]!;
  const legs: Leg[] = [];
  for (const dest of chartedPorts(map)) {
    if (dest.id === from) continue;
    const seconds = legSeconds(map, ship, from, dest.id, weather) + DOCK_SECONDS;
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
  const steady = opts.level ? knobs(opts.level).steadyWind : false;
  const weather = weathers(map, steady ? STEADY_SPREAD : SHIFTING_SPREAD);
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
    const all = legOptions(map, trade, at, opts.contracts, weather);
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
}

export function economyRun(map: MapDef): EconomyRun {
  const ports = chartedPorts(map);
  const legs = ports.flatMap((a) =>
    ports.filter((b) => b !== a).map((b) => legSeconds(map, SLOOP, a.id, b.id)),
  );
  return {
    sharp: sailVoyage({ map, contracts: true, relaxed: false }),
    sharpMarket: sailVoyage({ map, contracts: false, relaxed: false }),
    relaxed: sailVoyage({ map, contracts: true, relaxed: true }),
    legRange: [Math.min(...legs), Math.max(...legs)],
  };
}

export function economyChecks(r: EconomyRun): BalanceCheck[] {
  const T = TARGETS.economy;
  const { sharp, sharpMarket, relaxed } = r;
  const orderShare = sharp.contractGold / (sharp.contractGold + sharp.marketGold);
  const relaxedIncome = relaxed.marketGold + relaxed.contractGold;
  const routes = (v: Voyage) => ({
    top: Math.max(...Object.values(v.routes)) / v.legs,
    count: Object.keys(v.routes).length,
  });
  const sr = routes(sharp);
  const mr = routes(sharpMarket);
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
      actual: `top route ${pct(Math.max(sr.top, mr.top))}, ${Math.min(sr.count, mr.count)} routes`,
      target: `< ${pct(T.topRouteShareMax)}, ≥ ${T.routesMin}`,
      ok:
        Math.max(sr.top, mr.top) < T.topRouteShareMax &&
        Math.min(sr.count, mr.count) >= T.routesMin,
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

/** Median milestones of a captain over a few seeds (one run for the sharp one: no randomness). */
export function pace(map: MapDef, level: Difficulty, relaxed: boolean): Pace {
  const T = TARGETS.difficulty;
  const runs = (relaxed ? T.seeds : [7]).map((seed) =>
    sailVoyage({ map, contracts: true, relaxed, minutes: T.minutes, level, seed }),
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

export type DifficultyRun = Record<Difficulty, { sharp: Pace; relaxed: Pace }>;

export function difficultyRun(map: MapDef, onLevel?: (level: Difficulty) => void): DifficultyRun {
  const out = {} as DifficultyRun;
  for (const level of DIFFICULTIES) {
    onLevel?.(level);
    out[level] = { sharp: pace(map, level, false), relaxed: pace(map, level, true) };
  }
  return out;
}

/** A level's English name from its file entry (decision 0113). */
export const levelName = (id: Difficulty) => TUNING.difficulty.levels[id]?.name ?? id;

export function difficultyChecks(by: DifficultyRun): BalanceCheck[] {
  const T = TARGETS.difficulty;
  // The targets name the three shipped levels; a missing one fails its checks.
  const none = { sharp: { repairs: NaN }, relaxed: { repairs: NaN } };
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
      id: 'sharp-every-level',
      label: 'A sharp captain reaches the cutter early on every level',
      actual: DIFFICULTIES.map((l) => min(by[l]!.sharp.cutter)).join(' / '),
      target: `≤ ${T.sharpCutterMax} min`,
      ok: DIFFICULTIES.every((l) => n(by[l]!.sharp.cutter) <= T.sharpCutterMax),
    },
  ];
}
