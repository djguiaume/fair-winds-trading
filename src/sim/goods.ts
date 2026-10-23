import { TUNING } from '../data/tuning';

import shippedGoods from '../data/tuning/goods.json';

/**
 * Trade goods, all defined in `src/data/tuning/goods.json` (decisions 0094 and 0108): adding a good
 * there is enough for it to exist, trade and be saved. Each has a `kind`:
 * - `raw`: bulk goods (Phase 1); each settlement produces one and wants others (decision 0015).
 * - `made`: a town's workshop makes it from the raw good in `madeFrom` (decision 0063).
 * - `rare`: made only at the far shipyards and bought across the map (decision 0065).
 * Made and rare goods trade only where they are made or wanted. Base prices are the "fair" price
 * at a port that neither makes nor needs the good; supply and demand move it from there (see
 * `market.ts`). Which port makes or wants a good is set per port in the map file.
 */
export type GoodId = keyof typeof shippedGoods;
export type GoodKind = 'raw' | 'made' | 'rare';
/** Every good, in the file's order (the order of the harbour and chart lists). */
export const GOODS = Object.keys(shippedGoods) as [GoodId, ...GoodId[]];
const ofKind = (kind: GoodKind) => GOODS.filter((g) => shippedGoods[g].kind === kind);
export const RAW_GOODS = ofKind('raw');
export const SPECIALTY_GOODS = ofKind('made');
export const RARE_GOODS = ofKind('rare');
export type SpecialtyGood = GoodId;
export type RareGood = GoodId;

/** The bulk good each specialty is made from (decision 0063), from `goods.json`. */
export const MADE_FROM = Object.fromEntries(
  SPECIALTY_GOODS.map((g) => [g, TUNING.goods[g]!.madeFrom]),
) as Record<SpecialtyGood, GoodId>;

export function isSpecialty(good: GoodId): boolean {
  return SPECIALTY_GOODS.includes(good);
}

export function isRare(good: GoodId): boolean {
  return RARE_GOODS.includes(good);
}

/** Made goods (specialties and rare goods) trade only where some port makes or wants them. */
export function isMadeGood(good: GoodId): boolean {
  return isSpecialty(good) || isRare(good);
}

export interface GoodDef {
  id: GoodId;
  /** English name; the game shows the translation (`good.<id>` in `src/i18n/*.json`) if any. */
  name: string;
  kind: GoodKind;
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
  return typeof id === 'string' && (GOODS as string[]).includes(id);
}

/** A cargo hold or any per-good amount. */
export type GoodAmounts = Record<GoodId, number>;

export function emptyAmounts(): GoodAmounts {
  return Object.fromEntries(GOODS.map((g) => [g, 0])) as GoodAmounts;
}

export function totalAmount(amounts: GoodAmounts): number {
  return GOODS.reduce((sum, g) => sum + amounts[g], 0);
}
