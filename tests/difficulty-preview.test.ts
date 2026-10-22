/**
 * Difficulty presets preview (docs/reviews/difficulty/README.md). A copy of the 0046 balance
 * simulation with rough preset knobs applied on top (income, damage, repair price, town growth,
 * start gold). Not a target test: it prints a pace table and is skipped unless FWT_DIFFICULTY_SIM is set.
 */
import { expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { KNOT_TO_UNITS } from '../src/sim/boat';
import { deliverContract, stepContracts, syncHelpOrder } from '../src/sim/contracts';
import { GOODS, type GoodId } from '../src/sim/goods';
import { damageHull, repairHull } from '../src/sim/hazards';
import { quoteBuy, quoteSell, stepMarket } from '../src/sim/market';
import { DEG } from '../src/sim/math';
import { createRng } from '../src/sim/rng';
import { GROWTH_TO_LEVEL, stepSettlements } from '../src/sim/settlement';
const BASE_GROWTH = { ...GROWTH_TO_LEVEL };
import { homePort } from '../src/sim/shipyards';
import { CUTTER, SLOOP, type ShipClass, polarFraction } from '../src/sim/ship';
import {
  type TradeState,
  activeShip,
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
/** Wind from the map's prevailing direction, ±50° and ×0.8–1.1 as the weather shifts (0026). */
const WEATHERS = Array.from({ length: 11 }, (_, i) => (i - 5) * 10).flatMap((off) =>
  [0.8, 0.95, 1.1].map((s) => ({ from: (MAP.wind.fromDeg + off) * DEG, kn: MAP.wind.speedKn * s })),
);

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

export interface Preset {
  name: string;
  income: number;
  damage: number;
  repair: number;
  growth: number;
  startGold: number;
}

function sail(opts: {
  contracts: boolean;
  relaxed: boolean;
  minutes?: number;
  p: Preset;
  seed?: number;
}): Voyage {
  const minutes = opts.minutes ?? 40;
  const world = createWorld(MAP, SLOOP);
  const trade = world.trade;
  trade.captain.gold = opts.p.startGold;
  for (const [k, n] of Object.entries(BASE_GROWTH))
    GROWTH_TO_LEVEL[Number(k) as 2 | 3 | 4] = Math.round(n * opts.p.growth);
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
  let lastCost = 0;
  let t = 0;
  let next = 0;
  while (t < minutes * 60) {
    trade.dockedAt = at;
    if (opts.relaxed) {
      const r = repairHull(trade);
      if (r.ok) {
        const extra = Math.round(r.points * (opts.p.repair - 2));
        trade.captain.gold -= extra;
        v.repairGold += r.gold + extra;
      }
    }
    if (opts.contracts) {
      const r = deliverContract(trade, MAP);
      if (r.ok) {
        const bonus = Math.round(r.gold * (opts.p.income - 1));
        trade.captain.gold += bonus;
        v.contractGold += r.gold + bonus;
      }
    }
    const before = trade.captain.gold;
    sellAll(trade, MAP);
    const sold = trade.captain.gold - before;
    const bonus = Math.round(Math.max(0, sold - lastCost) * (opts.p.income - 1));
    trade.captain.gold += bonus;
    v.marketGold += sold + bonus;

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
    const g0 = trade.captain.gold;
    if (leg.good && leg.qty > 0) expect(buy(trade, leg.good, leg.qty).ok).toBe(true);
    lastCost = g0 - trade.captain.gold;
    const key = `${at}>${leg.to}`;
    v.routes[key] = (v.routes[key] ?? 0) + 1;
    trade.dockedAt = null;
    const seconds = leg.seconds * (opts.relaxed ? 1.4 : 1);
    if (opts.relaxed && rng() < 0.2) damageHull(trade, (20 + rng() * 30) * opts.p.damage);
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

const PRESETS: Preset[] = [
  { name: 'Fair winds', income: 1.2, damage: 0.5, repair: 1, growth: 0.75, startGold: 250 },
  { name: 'Captain', income: 1, damage: 1, repair: 2, growth: 1, startGold: 150 },
  { name: 'Old salt', income: 0.85, damage: 1.5, repair: 3, growth: 1.25, startGold: 100 },
];

const fmt = (m: number | undefined) => (m === undefined ? '-' : m.toFixed(1));

// Preview only (docs/reviews/difficulty): run with FWT_DIFFICULTY_SIM=1 npx vitest run tests/difficulty-preview.test.ts
it.runIf(process.env.FWT_DIFFICULTY_SIM)('difficulty presets: pace', () => {
  const rows: string[] = [];
  for (const p of PRESETS)
    for (const relaxed of [false, true]) {
      const seeds = relaxed ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [7];
      const runs = seeds.map((seed) => sail({ contracts: true, relaxed, minutes: 150, p, seed }));
      const median = (f: (v: Voyage) => number | undefined) => {
        const xs = runs.map((v) => f(v) ?? Infinity).sort((a, b) => a - b);
        const m = xs[Math.floor(xs.length / 2)]!;
        return isFinite(m) ? m : undefined;
      };
      const firstTown = (v: Voyage) => {
        const ms = Object.entries(v.levels)
          .filter(([k]) => k.endsWith(' 3'))
          .map(([, m]) => m);
        return ms.length ? Math.min(...ms) : undefined;
      };
      rows.push(
        [
          p.name,
          relaxed ? 'relaxed' : 'sharp',
          fmt(median((v) => v.bought['sloop hold'])),
          fmt(median((v) => v.bought.cutter)),
          fmt(median((v) => v.boughtAt.filter(([n]) => n === 'cutter hull')[1]?.[1])),
          fmt(median(firstTown)),
          fmt(median((v) => v.levels['saltmere 3'])),
          `${median((v) => Math.round((100 * v.repairGold) / (v.marketGold + v.contractGold)))} %`,
        ].join(' | '),
      );
    }
  for (const [k, n] of Object.entries(BASE_GROWTH)) GROWTH_TO_LEVEL[Number(k) as 2 | 3 | 4] = n;
  console.log(
    'preset | captain | 1st upgrade | cutter | cutter maxed | 1st town (L3) | Saltmere L3 | repairs\n' +
      rows.join('\n'),
  );
  expect(rows.length).toBe(6);
});
