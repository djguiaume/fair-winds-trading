import { GOODS, GOOD_DEFS, type GoodAmounts, type GoodId, emptyAmounts } from './goods';
import type { PortDef } from './map';
import { type Rng, range } from './rng';
import { clamp } from './math';

/**
 * Supply and demand at one port (decision 0015). Each good has a stock that drifts back toward an
 * equilibrium set by the port's role (makes it: big stock, cheap; wants it: small stock, dear).
 * Price follows stock, so buying raises the price and selling lowers it, unit by unit, and a
 * route you hammer pays less until the port recovers.
 */

/** Stock at which a good trades at its base price. */
export const REFERENCE_STOCK = 30;
/** Equilibrium stock by role: what the port settles at when nobody trades. */
export const EQUILIBRIUM: Record<GoodRole, number> = { produces: 100, wants: 15, neutral: 30 };
/** How strongly price reacts to stock: mid = base × (reference / stock) ^ elasticity. */
export const PRICE_ELASTICITY = 0.8;
/** Mid price stays within these multiples of the base price. */
export const PRICE_FLOOR = 0.35;
export const PRICE_CEILING = 3;
/** The port's cut: you buy a bit above the mid price and sell a bit below it. */
export const SPREAD = 0.08;
/** Seconds for a stock to close ~63 % of the gap back to equilibrium. */
export const RECOVERY_SECONDS = 75;

export type GoodRole = 'produces' | 'wants' | 'neutral';

export interface Market {
  portId: string;
  stock: GoodAmounts;
  equilibrium: GoodAmounts;
}

export function goodRole(port: PortDef, good: GoodId): GoodRole {
  if (port.produces.includes(good)) return 'produces';
  if (port.wants.includes(good)) return 'wants';
  return 'neutral';
}

/** A port's market at equilibrium, with a little seeded variety so ports don't look identical. */
export function createMarket(port: PortDef, rng?: Rng): Market {
  const equilibrium = emptyAmounts();
  const stock = emptyAmounts();
  for (const g of GOODS) {
    equilibrium[g] = EQUILIBRIUM[goodRole(port, g)];
    stock[g] = equilibrium[g] * (rng ? range(rng, 0.85, 1.15) : 1);
  }
  return { portId: port.id, stock, equilibrium };
}

/** Mid price of one unit of `good` when the port holds `stock` of it. */
export function midPrice(good: GoodId, stock: number): number {
  const factor = Math.pow(REFERENCE_STOCK / Math.max(stock, 1), PRICE_ELASTICITY);
  return GOOD_DEFS[good].basePrice * clamp(factor, PRICE_FLOOR, PRICE_CEILING);
}

/** What the player pays for the next unit (whole gold). */
export function unitBuyPrice(good: GoodId, stock: number): number {
  return Math.max(1, Math.ceil(midPrice(good, stock) * (1 + SPREAD)));
}

/** What the player gets for the next unit (whole gold). */
export function unitSellPrice(good: GoodId, stock: number): number {
  return Math.max(1, Math.floor(midPrice(good, stock) * (1 - SPREAD)));
}

/** Whole units the port can sell right now. */
export function available(market: Market, good: GoodId): number {
  return Math.max(0, Math.floor(market.stock[good]));
}

/** Total cost of buying `qty` units, pricing each unit after the previous one left the stock. */
export function quoteBuy(market: Market, good: GoodId, qty: number): number {
  let total = 0;
  const stock = market.stock[good];
  for (let i = 0; i < qty; i++) total += unitBuyPrice(good, stock - i - 1);
  return total;
}

/** Total paid for selling `qty` units, each unit landing on the stock before the next is priced. */
export function quoteSell(market: Market, good: GoodId, qty: number): number {
  let total = 0;
  const stock = market.stock[good];
  for (let i = 0; i < qty; i++) total += unitSellPrice(good, stock + i + 1);
  return total;
}

/** Stocks drift back toward equilibrium (production refills, the town consumes). */
export function stepMarket(market: Market, dt: number): void {
  const k = 1 - Math.exp(-dt / RECOVERY_SECONDS);
  for (const g of GOODS) {
    market.stock[g] += (market.equilibrium[g] - market.stock[g]) * k;
  }
}
