import { TUNING } from '../data/tuning';

/**
 * Trade goods. Four bulk goods (Phase 1): each settlement produces one and wants others
 * (decision 0015). Four specialized goods (decision 0063): a town's workshop makes one from its
 * bulk good. Rare goods (decision 0065) are made only at the far shipyards and bought across the
 * map. Specialized and rare goods trade only where they are made or wanted. Base prices are the "fair" price
 * at a port that neither makes nor needs the good; supply and demand move it from there (see
 * `market.ts`).
 */
export const RAW_GOODS = ['fish', 'grain', 'timber', 'stone'] as const;
export const SPECIALTY_GOODS = ['smokedFish', 'bread', 'planks', 'cutStone'] as const;
export const RARE_GOODS = ['honey', 'lampOil'] as const;
export const GOODS = [...RAW_GOODS, ...SPECIALTY_GOODS, ...RARE_GOODS] as const;
export type GoodId = (typeof GOODS)[number];
export type SpecialtyGood = (typeof SPECIALTY_GOODS)[number];
export type RareGood = (typeof RARE_GOODS)[number];

/** The bulk good each specialty is made from (decision 0063), from `goods.json`. */
export const MADE_FROM = Object.fromEntries(
  SPECIALTY_GOODS.map((g) => [g, TUNING.goods[g]!.madeFrom]),
) as Record<SpecialtyGood, GoodId>;

export function isSpecialty(good: GoodId): good is SpecialtyGood {
  return (SPECIALTY_GOODS as readonly string[]).includes(good);
}

export function isRare(good: GoodId): good is RareGood {
  return (RARE_GOODS as readonly string[]).includes(good);
}

/** Made goods (specialties and rare goods) trade only where some port makes or wants them. */
export function isMadeGood(good: GoodId): boolean {
  return isSpecialty(good) || isRare(good);
}

export interface GoodDef {
  id: GoodId;
  name: string;
  /** Mid price (gold per unit) at the reference stock level. */
  basePrice: number;
}

/** Live goods of `src/data/tuning/goods.json` (decision 0094). */
export const GOOD_DEFS = TUNING.goods as Record<GoodId, GoodDef>;

/** Icons shared by the chart and harbour views. */
export const GOOD_ICONS = Object.fromEntries(
  GOODS.map((g) => [g, TUNING.goods[g]!.icon]),
) as Record<GoodId, string>;

export function isGood(id: unknown): id is GoodId {
  return typeof id === 'string' && (GOODS as readonly string[]).includes(id);
}

/** A cargo hold or any per-good amount. */
export type GoodAmounts = Record<GoodId, number>;

export function emptyAmounts(): GoodAmounts {
  return Object.fromEntries(GOODS.map((g) => [g, 0])) as GoodAmounts;
}

export function totalAmount(amounts: GoodAmounts): number {
  return GOODS.reduce((sum, g) => sum + amounts[g], 0);
}
