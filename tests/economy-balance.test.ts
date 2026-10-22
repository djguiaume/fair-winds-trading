import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { KNOT_TO_UNITS } from '../src/sim/boat';
import { deliverContract, stepContracts } from '../src/sim/contracts';
import { GOODS, type GoodId } from '../src/sim/goods';
import { damageHull, repairHull } from '../src/sim/hazards';
import { quoteBuy, quoteSell, stepMarket } from '../src/sim/market';
import { DEG } from '../src/sim/math';
import { createRng } from '../src/sim/rng';
import { stepSettlements } from '../src/sim/settlement';
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
export function legSeconds(ship: ShipClass, from: string, to: string): number {
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

function sail(opts: { contracts: boolean; relaxed: boolean; minutes?: number }): Voyage {
  const minutes = opts.minutes ?? 40;
  const world = createWorld(MAP, SLOOP);
  const trade = world.trade;
  const rng = createRng(7);
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
    if (opts.relaxed && rng() < 0.2) damageHull(trade, 20 + rng() * 30);
    for (const m of Object.values(trade.markets)) stepMarket(m, seconds);
    stepContracts(trade.contracts, seconds);
    t += seconds;
    for (const up of stepSettlements(trade, seconds, MAP))
      v.levels[`${up.portId} ${up.level}`] = t / 60;
    syncMarketLevels(trade, MAP);
    at = leg.to;
    v.legs++;
  }
  return v;
}

function report(name: string, v: Voyage) {
  const income = v.marketGold + v.contractGold;
  console.log(
    `${name}: ${v.legs} legs, ${income} gold earned (${Math.round((100 * v.contractGold) / income)} % orders), repairs ${v.repairGold}\n  ` +
      v.boughtAt.map(([n, m]) => `${m.toFixed(1)} min ${n}`).join(', ') +
      '\n  levels: ' +
      Object.entries(v.levels)
        .map(([n, m]) => `${m.toFixed(1)} min ${n}`)
        .join(', '),
  );
}

describe('economy balance (0046)', () => {
  const sharp = sail({ contracts: true, relaxed: false });
  const sharpMarket = sail({ contracts: false, relaxed: false });
  const relaxed = sail({ contracts: true, relaxed: true });
  report('sharp captain', sharp);
  report('sharp, market only', sharpMarket);
  report('relaxed captain', relaxed);

  it('legs between ports take about a minute', () => {
    for (const a of PORTS)
      for (const b of PORTS) {
        if (a === b) continue;
        const s = legSeconds(SLOOP, a.id, b.id);
        expect(s).toBeGreaterThan(30);
        expect(s).toBeLessThan(130);
      }
  });

  it('a sharp captain gets a first upgrade in minutes and the cutter in about a quarter hour', () => {
    expect(sharp.bought['sloop hold']).toBeLessThanOrEqual(5);
    expect(sharp.bought.cutter).toBeGreaterThanOrEqual(9);
    expect(sharp.bought.cutter).toBeLessThanOrEqual(16);
    // A fully upgraded cutter is a long-run goal, not a first-session one.
    const maxed = sharp.boughtAt.filter(([n]) => n === 'cutter hull')[1]?.[1] ?? Infinity;
    expect(maxed).toBeGreaterThanOrEqual(25);
  });

  it('a relaxed captain still gets there within a couple of sessions', () => {
    expect(relaxed.bought['sloop hold']).toBeLessThanOrEqual(8);
    expect(relaxed.bought.cutter).toBeLessThanOrEqual(32);
  });

  it('delivery orders help a lot but market trading still carries the game', () => {
    const share = sharp.contractGold / (sharp.contractGold + sharp.marketGold);
    expect(share).toBeGreaterThan(0.3);
    expect(share).toBeLessThan(0.65);
    // Market trading alone reaches the cutter too, just later.
    expect(sharpMarket.bought.cutter).toBeGreaterThan(sharp.bought.cutter!);
    expect(sharpMarket.bought.cutter).toBeLessThanOrEqual(25);
  });

  it('no single route is the only good one', () => {
    for (const v of [sharp, sharpMarket]) {
      const top = Math.max(...Object.values(v.routes));
      expect(top / v.legs).toBeLessThan(0.3);
      expect(Object.keys(v.routes).length).toBeGreaterThanOrEqual(6);
    }
  });

  it('repairs sting but do not stall a careless captain', () => {
    const income = relaxed.marketGold + relaxed.contractGold;
    expect(relaxed.repairGold).toBeGreaterThan(0);
    expect(relaxed.repairGold / income).toBeLessThan(0.1);
  });
});
