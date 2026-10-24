import {
  GOODS,
  GOOD_DEFS,
  type GoodAmounts,
  type GoodId,
  emptyAmounts,
  CRAFTED_FROM,
  isCrafted,
  isFar,
  isMadeGood,
  isRare,
} from './goods';
import type { PortDef } from './map';
import { type Rng, range } from './rng';
import { clamp } from './math';
import { TUNING } from '../data/tuning';
import { knobs } from './difficulty';
import { clampLevel, portProduces, portWants, startLevel } from './settlement';

/**
 * Supply and demand at one port (decision 0015). Each good has a stock that drifts back toward an
 * equilibrium set by the port's role (makes it: big stock, cheap; wants it: small stock, dear).
 * Price follows stock, so buying raises the price and selling lowers it, unit by unit, and a
 * route you hammer pays less until the port recovers.
 */

/*
 * The numbers (reference stock, equilibrium by role, elasticity, floor and ceiling, recovery time)
 * are in `src/data/tuning/economy.json` › `market` (decision 0094): the stock at which a good trades
 * at its base price; the equilibrium stock by role for a village (level 2, other levels scale wants
 * and produces, decision 0059, `equilibriumFor`); mid = base × (reference / stock) ^ elasticity,
 * kept within floor and ceiling multiples of the base price; seconds for a stock to close ~63 % of
 * the gap back to equilibrium. The port's cut (spread) is set by the difficulty level.
 */
const marketTuning = () => TUNING.economy.market;

/** `none`: a specialized good the port neither makes nor buys; it is not traded there (0063). */
export type GoodRole = 'produces' | 'wants' | 'neutral' | 'none';

export interface Market {
  portId: string;
  stock: GoodAmounts;
  equilibrium: GoodAmounts;
  /** The port's cut at the voyage's difficulty level (decision 0083); none = Captain's. */
  spread?: number;
  /**
   * Units of each far good the port's workshop has crafted and not yet sold (decision 0146): one
   * per raw unit received. Only the goods it crafts are listed; you can buy no more than this.
   */
  workshop?: Partial<Record<GoodId, number>>;
}

/** What `good` is to the port at settlement `level` (default: the level it starts at). */
export function goodRole(
  port: PortDef,
  good: GoodId,
  level: number = startLevel(port),
  made: ReadonlySet<GoodId> = new Set(),
): GoodRole {
  if (portProduces(port, clampLevel(level)).includes(good)) return 'produces';
  if (portWants(port, clampLevel(level), made).includes(good)) return 'wants';
  return isMadeGood(good) ? 'none' : 'neutral';
}

/** Equilibrium stock for a role at a settlement level (decision 0059). */
export function equilibriumFor(role: GoodRole, level: number, good?: GoodId): number {
  const towns = TUNING.economy.towns;
  const i = Math.min(Math.max(Math.round(level), 1), towns.wantsEquilibrium.length) - 1;
  if (role === 'wants') return towns.wantsEquilibrium[i]!;
  if (role === 'produces') {
    // An outpost gathers its raw far good like bulk (0146); crafted far goods stock like rare ones.
    if (!good || !isMadeGood(good) || (isFar(good) && !isCrafted(good)))
      return towns.producesEquilibrium[i]!;
    const share = isRare(good) || isCrafted(good) ? towns.rareShare : towns.specialtyShare;
    return Math.round(towns.producesEquilibrium[i]! * share);
  }
  return marketTuning().equilibrium[role];
}

/** A port's market at equilibrium, with a little seeded variety so ports don't look identical. */
export function createMarket(
  port: PortDef,
  rng?: Rng,
  level: number = startLevel(port),
  made: ReadonlySet<GoodId> = new Set(),
): Market {
  const equilibrium = emptyAmounts();
  const stock = emptyAmounts();
  for (const g of GOODS) {
    equilibrium[g] = equilibriumFor(goodRole(port, g, level, made), level, g);
    // Untraded goods draw nothing, so the seeded variety of the other goods stays as it was.
    stock[g] = equilibrium[g] > 0 ? equilibrium[g] * (rng ? range(rng, 0.85, 1.15) : 1) : 0;
  }
  const market: Market = { portId: port.id, stock, equilibrium };
  syncWorkshop(market, port, level);
  return market;
}

/**
 * List the far goods the port's workshop crafts at `level` (decision 0146). A workshop that just
 * opened has crafted nothing yet; one that stopped (a quest changed the port) is dropped.
 */
function syncWorkshop(market: Market, port: PortDef, level: number): void {
  const crafts = portProduces(port, clampLevel(level)).filter(isCrafted);
  const was = market.workshop ?? {};
  const now: Partial<Record<GoodId, number>> = {};
  for (const g of crafts) now[g] = was[g] ?? 0;
  if (crafts.length) market.workshop = now;
  else delete market.workshop;
}

/**
 * Raw goods arrived (sold or delivered): each unit of a raw far good becomes one unit of what the
 * workshop crafts from it (decision 0146). No raw goods, no crafting.
 */
export function workshopReceives(market: Market, good: GoodId, qty: number): void {
  if (!market.workshop || qty <= 0) return;
  for (const g of Object.keys(market.workshop) as GoodId[])
    if (CRAFTED_FROM[g] === good) market.workshop[g]! += qty;
}

/**
 * The town grew, a specialty came on the market, or a save restored its level: new wants and
 * deeper demand. Only the equilibrium moves; stocks drift there at the usual pace.
 */
export function setMarketLevel(
  market: Market,
  port: PortDef,
  level: number,
  made: ReadonlySet<GoodId> = new Set(),
): void {
  for (const g of GOODS) {
    const was = market.equilibrium[g];
    market.equilibrium[g] = equilibriumFor(goodRole(port, g, level, made), level, g);
    // A market that just opened (a new workshop, or a new buyer of its specialty) starts at its
    // usual stock rather than empty, so the first prices are not at the ceiling (0063).
    if (was <= 0 && market.equilibrium[g] > 0) market.stock[g] = market.equilibrium[g];
  }
  syncWorkshop(market, port, level);
}

/** Whether the port trades `good` at all (specialized goods only where made or wanted, 0063). */
export function trades(market: Market, good: GoodId): boolean {
  return market.equilibrium[good] > 0;
}

/** Mid price of one unit of `good` when the port holds `stock` of it. */
export function midPrice(good: GoodId, stock: number): number {
  const m = marketTuning();
  const factor = Math.pow(m.referenceStock / Math.max(stock, 1), m.elasticity);
  return GOOD_DEFS[good].basePrice * clamp(factor, m.floor, m.ceiling);
}

/** What the player pays for the next unit (whole gold). */
export function unitBuyPrice(
  good: GoodId,
  stock: number,
  spread = knobs(undefined).spread,
): number {
  return Math.max(1, Math.ceil(midPrice(good, stock) * (1 + spread)));
}

/** What the player gets for the next unit (whole gold). */
export function unitSellPrice(
  good: GoodId,
  stock: number,
  spread = knobs(undefined).spread,
): number {
  return Math.max(1, Math.floor(midPrice(good, stock) * (1 - spread)));
}

/**
 * Whole units the port can sell right now. A workshop's far goods are also capped by what it has
 * crafted from raw goods received (decision 0146): the stock sets the price, the workshop the count.
 */
export function available(market: Market, good: GoodId): number {
  const stock = Math.max(0, Math.floor(market.stock[good]));
  const crafted = market.workshop?.[good];
  return crafted === undefined ? stock : Math.min(stock, Math.max(0, Math.floor(crafted)));
}

/** The player bought `qty` units: they leave the stock, and the workshop's count (0146). */
export function takeStock(market: Market, good: GoodId, qty: number): void {
  market.stock[good] -= qty;
  if (market.workshop?.[good] !== undefined)
    market.workshop[good] = Math.max(0, market.workshop[good]! - qty);
}

/** Total cost of buying `qty` units, pricing each unit after the previous one left the stock. */
export function quoteBuy(market: Market, good: GoodId, qty: number): number {
  let total = 0;
  const stock = market.stock[good];
  for (let i = 0; i < qty; i++) total += unitBuyPrice(good, stock - i - 1, market.spread);
  return total;
}

/** Total paid for selling `qty` units, each unit landing on the stock before the next is priced. */
export function quoteSell(market: Market, good: GoodId, qty: number): number {
  let total = 0;
  const stock = market.stock[good];
  for (let i = 0; i < qty; i++) total += unitSellPrice(good, stock + i + 1, market.spread);
  return total;
}

/** Stocks drift back toward equilibrium (production refills, the town consumes). */
export function stepMarket(market: Market, dt: number): void {
  const k = 1 - Math.exp(-dt / marketTuning().recoverySeconds);
  for (const g of GOODS) {
    market.stock[g] += (market.equilibrium[g] - market.stock[g]) * k;
  }
}

/** How much a port pays for `good` right now, as a multiple of the good's base price. */
export function demand(market: Market, good: GoodId): number {
  return unitSellPrice(good, market.stock[good] + 1, market.spread) / GOOD_DEFS[good].basePrice;
}

/**
 * The port's top need (decision 0036): the good it pays most for right now, relative to that
 * good's fair price. Live, so a need you fill drops and the port's other want takes over.
 */
export function topNeed(market: Market): GoodId {
  let best: GoodId = GOODS[0];
  for (const g of GOODS) {
    if (!trades(market, g)) continue;
    const gap = demand(market, g) - demand(market, best);
    if (gap > 1e-9 || (Math.abs(gap) <= 1e-9 && GOOD_DEFS[g].basePrice > GOOD_DEFS[best].basePrice))
      best = g;
  }
  return best;
}

export interface PortQuote {
  portId: string;
  /** Next unit you buy there. */
  buy: number;
  /** Next unit you sell there. */
  sell: number;
  available: number;
}

/** One good's next-unit prices at each listed port, in the order given (market overview). */
export function quoteAcross(
  markets: Record<string, Market>,
  good: GoodId,
  portIds: readonly string[],
): PortQuote[] {
  return portIds.flatMap((portId) => {
    const market = markets[portId];
    if (!market || !trades(market, good)) return [];
    const stock = market.stock[good];
    return [
      {
        portId,
        buy: unitBuyPrice(good, stock - 1, market.spread),
        sell: unitSellPrice(good, stock + 1, market.spread),
        available: available(market, good),
      },
    ];
  });
}
