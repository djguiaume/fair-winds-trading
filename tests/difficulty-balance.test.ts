/**
 * Difficulty levels on the Windward Ring (decision 0083). The 0046 balance simulation, run on each
 * level with the game's own knobs: start gold, the port's cut, order rewards, damage, repair price
 * and town growth all come from src/sim/difficulty.ts. Fair winds also sails in the steady trade
 * wind, so its legs are timed over a narrow wind range. Captain must stay the 0046 game.
 */
import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { deliverContract, stepContracts, syncHelpOrder } from '../src/sim/contracts';
import { GOODS, type GoodId } from '../src/sim/goods';
import { damageHull, repairHull } from '../src/sim/hazards';
import { quoteBuy, quoteSell, stepMarket } from '../src/sim/market';
import { DEG } from '../src/sim/math';
import { createRng } from '../src/sim/rng';
import { stepSettlements } from '../src/sim/settlement';
import { DIFFICULTIES, type Difficulty, knobs } from '../src/sim/difficulty';
import { homePort } from '../src/sim/shipyards';
import { CUTTER, SLOOP, type ShipClass, polarFraction } from '../src/sim/ship';
import {
  type TradeState,
  activeShip,
  startVoyage,
  buy,
  buyShip,
  buyUpgrade,
  capacity,
  maxBuy,
  sellAll,
  syncMarketLevels,
  upgradeAllowed,
} from '../src/sim/trade';
import { type UpgradeTrack, effectiveShip, upgradePrice } from '../src/sim/upgrades';
import { createWorld } from '../src/sim/world';
import { TUNING } from '../src/data/tuning';

// Tuning values moved to src/data/tuning (decision 0094).
const KNOT_TO_UNITS = TUNING.seamanship.boat.knotToUnits;

/**
 * Phase 1 balance on the Windward Ring (decision 0046). Two simulated captains trade for 40
 * minutes of play: a sharp one who always takes the best paying leg, and a relaxed one who sails
 * slower, often settles for the second or third best load and strikes something now and then.
 * Leg times come from the sloop and cutter polars over the shifting wind's range, so they follow
 * sailing changes too. The milestones below are the targets in docs/economy.md.
 */

const MAP = PHASE1_MAP;
/** The four charted ports: the hidden shipwright yards stay out of a first session (decision 0048). */
const PORTS = MAP.ports.filter((p) => !p.hidden);
/** Upgrades and the cutter are bought only at the home port, Saltmere (decision 0048). */
const HOME = homePort(MAP).id;
const DOCK_SECONDS = 20;
/** Wind from the map's prevailing direction, ±`spread`° and ×0.8–1.1 as the weather shifts. */
const weathers = (spread: number) =>
  Array.from({ length: 11 }, (_, i) => ((i - 5) * spread) / 5).flatMap((off) =>
    [0.8, 0.95, 1.1].map((s) => ({
      from: (MAP.wind.fromDeg + off) * DEG,
      kn: MAP.wind.speedKn * s,
    })),
  );
/** ±50° as in 0046 for the shifting wind; the steady trade wind stays within about ±10°. */
const SHIFTING = weathers(50);
const STEADY = weathers(10);
let WEATHERS = SHIFTING;

function islandOfPort(portId: string) {
  const port = MAP.ports.find((p) => p.id === portId)!;
  return MAP.islands.find((i) => i.id === port.islandId)!;
}

/** Best speed made good along `bearing` (kn), sailing straight or tacking, averaged over the weather. */
function madeGood(ship: ShipClass, bearing: number): number {
  let sum = 0;
  for (const w of WEATHERS) {
    let best = 0;
    for (let a = -180; a <= 180; a += 2) {
      const speed = polarFraction(ship, w.from - bearing - a * DEG) * w.kn * ship.speedRatio;
      best = Math.max(best, speed * Math.cos(a * DEG));
    }
    sum += best;
  }
  return sum / WEATHERS.length;
}

/** Seconds from one port to another: 15 % detour round islands and reefs, manoeuvring losses. */
function legSeconds(ship: ShipClass, from: string, to: string): number {
  const a = islandOfPort(from);
  const b = islandOfPort(to);
  const d = Math.hypot(b.x - a.x, b.y - a.y) - a.radius - b.radius;
  const bearing = Math.atan2(b.x - a.x, b.y - a.y);
  return (d * 1.15) / (madeGood(ship, bearing) * 0.9 * KNOT_TO_UNITS) + 8;
}

interface Leg {
  to: string;
  good: GoodId | null;
  qty: number;
  gain: number;
  seconds: number;
}

/** Every load worth carrying from the docked port, best gold per second first. */
function legOptions(trade: TradeState, from: string, contracts: boolean): Leg[] {
  const ship = effectiveShip(activeShip(trade), trade.captain.ships[trade.captain.activeShip]!);
  const here = trade.markets[from]!;
  const legs: Leg[] = [];
  for (const dest of PORTS) {
    if (dest.id === from) continue;
    const seconds = legSeconds(ship, from, dest.id) + DOCK_SECONDS;
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

interface Voyage {
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

function sail(opts: {
  contracts: boolean;
  relaxed: boolean;
  minutes?: number;
  level: Difficulty;
  seed?: number;
}): Voyage {
  const minutes = opts.minutes ?? 40;
  const world = createWorld(MAP, SLOOP);
  const trade = world.trade;
  startVoyage(trade, opts.level);
  WEATHERS = knobs(opts.level).steadyWind ? STEADY : SHIFTING;
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
  let at = HOME;
  let t = 0;
  let next = 0;
  while (t < minutes * 60) {
    trade.dockedAt = at;
    if (opts.relaxed) {
      const r = repairHull(trade);
      if (r.ok) v.repairGold += r.gold;
    }
    if (opts.contracts) {
      const r = deliverContract(trade, MAP);
      if (r.ok) v.contractGold += r.gold;
    }
    const before = trade.captain.gold;
    sellAll(trade, MAP);
    v.marketGold += trade.captain.gold - before;

    // Shop in a fixed order at the home port, keeping a little gold back for the next load.
    while (at === HOME && next < SHOPPING.length) {
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
      if (item !== 'cutter' && !upgradeAllowed(trade, MAP, levels[item] + 1)) break;
      const ok =
        item === 'cutter' ? buyShip(trade, MAP, 'cutter').ok : buyUpgrade(trade, MAP, item).ok;
      expect(ok).toBe(true);
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
      upgradeAllowed(trade, MAP, trade.captain.ships[trade.captain.activeShip]![item] + 1);
    const goHome = at !== HOME && want !== null && allowed && trade.captain.gold >= want + 80;
    const all = legOptions(trade, at, opts.contracts);
    const options = goHome ? all.filter((o) => o.to === HOME) : all;
    let leg = options[0]!;
    if (opts.relaxed) {
      const paying = options.filter((o) => o.gain > 0).slice(0, 3);
      const r = rng();
      leg = paying[Math.min(paying.length - 1, r < 0.5 ? 0 : r < 0.8 ? 1 : 2)] ?? leg;
    }
    if (leg.good && leg.qty > 0) expect(buy(trade, leg.good, leg.qty).ok).toBe(true);
    const key = `${at}>${leg.to}`;
    v.routes[key] = (v.routes[key] ?? 0) + 1;
    trade.dockedAt = null;
    const seconds = leg.seconds * (opts.relaxed ? 1.4 : 1);
    if (opts.relaxed && rng() < 0.2)
      damageHull(trade, (20 + rng() * 30) * knobs(opts.level).damage);
    for (const m of Object.values(trade.markets)) stepMarket(m, seconds);
    stepContracts(trade.contracts, seconds);
    // A neglected town, or the home port holding back an upgrade, asks for help (0069).
    syncHelpOrder(MAP, trade);
    t += seconds;
    for (const up of stepSettlements(trade, seconds, MAP))
      v.levels[`${up.portId} ${up.level}`] = t / 60;
    syncMarketLevels(trade, MAP);
    at = leg.to;
    v.legs++;
  }
  return v;
}

const NAMES: Record<Difficulty, string> = {
  fair: 'Fair winds',
  captain: 'Captain',
  salt: 'Old salt',
};
const SEEDS = [1, 2, 3, 4, 5];

interface Pace {
  firstUpgrade?: number;
  cutter?: number;
  maxed?: number;
  firstTown?: number;
  repairs: number;
}

/** Median milestones of a captain over a few seeds (one run for the sharp one: no randomness). */
function pace(level: Difficulty, relaxed: boolean): Pace {
  const runs = (relaxed ? SEEDS : [7]).map((seed) =>
    sail({ contracts: true, relaxed, minutes: 120, level, seed }),
  );
  WEATHERS = SHIFTING;
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
    maxed: median((v) => v.boughtAt.filter(([n]) => n === 'cutter hull')[1]?.[1]),
    firstTown: median(firstTown),
    repairs: median((v) => v.repairGold / (v.marketGold + v.contractGold)) ?? 0,
  };
}

const fmt = (m: number | undefined) => (m === undefined ? '-' : `${m.toFixed(1)} min`);

describe('difficulty levels (0083)', () => {
  const results = DIFFICULTIES.map((level) => ({
    level,
    sharp: pace(level, false),
    relaxed: pace(level, true),
  }));
  const by = Object.fromEntries(results.map((r) => [r.level, r])) as Record<
    'fair' | 'captain' | 'salt',
    (typeof results)[number]
  >;
  console.log(
    'level | captain | 1st upgrade | cutter | cutter maxed | 1st town | repairs\n' +
      results
        .flatMap((r) =>
          (['sharp', 'relaxed'] as const).map((who) =>
            [
              NAMES[r.level],
              who,
              fmt(r[who].firstUpgrade),
              fmt(r[who].cutter),
              fmt(r[who].maxed),
              fmt(r[who].firstTown),
              `${Math.round(100 * r[who].repairs)} %`,
            ].join(' | '),
          ),
        )
        .join('\n'),
  );

  it('each level is slower than the one before for a relaxed captain', () => {
    expect(by.fair.relaxed.cutter!).toBeLessThan(by.captain.relaxed.cutter!);
    expect(by.captain.relaxed.cutter!).toBeLessThan(by.salt.relaxed.cutter!);
    expect(by.fair.relaxed.firstTown!).toBeLessThan(by.salt.relaxed.firstTown!);
  });

  it('Fair winds gets a relaxed captain to the cutter about as fast as a sharp one on Captain', () => {
    expect(by.fair.relaxed.firstUpgrade!).toBeLessThanOrEqual(6);
    expect(by.fair.relaxed.cutter!).toBeLessThanOrEqual(22);
    // Towns grow much sooner, so the top upgrades come within a session or two.
    expect(by.fair.relaxed.firstTown!).toBeLessThan(by.captain.relaxed.firstTown! * 0.7);
  });

  it('Old salt is a long haul but still reaches the cutter within a long evening', () => {
    expect(by.salt.relaxed.cutter!).toBeGreaterThanOrEqual(28);
    expect(by.salt.relaxed.cutter!).toBeLessThanOrEqual(55);
    // Mistakes sting: repairs weigh much more than on Captain.
    expect(by.salt.relaxed.repairs).toBeGreaterThan(by.captain.relaxed.repairs * 1.5);
  });

  it('a sharp captain still reaches the cutter early on every level', () => {
    for (const r of results) expect(r.sharp.cutter!).toBeLessThanOrEqual(20);
  });
});
