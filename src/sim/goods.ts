/**
 * Trade goods. Phase 1 has four bulk goods; each settlement produces one and wants others
 * (decision 0015). Base prices are the "fair" price at a port that neither makes nor needs the
 * good; supply and demand move it from there (see `market.ts`).
 */
export const GOODS = ['fish', 'grain', 'timber', 'stone'] as const;
export type GoodId = (typeof GOODS)[number];

export interface GoodDef {
  id: GoodId;
  name: string;
  /** Mid price (gold per unit) at the reference stock level. */
  basePrice: number;
}

export const GOOD_DEFS: Record<GoodId, GoodDef> = {
  fish: { id: 'fish', name: 'Fish', basePrice: 8 },
  grain: { id: 'grain', name: 'Grain', basePrice: 10 },
  timber: { id: 'timber', name: 'Timber', basePrice: 14 },
  stone: { id: 'stone', name: 'Stone', basePrice: 18 },
};

/** Icons shared by the chart and harbour views. */
export const GOOD_ICONS: Record<GoodId, string> = {
  fish: '🐟',
  grain: '🌾',
  timber: '🪵',
  stone: '🪨',
};

export function isGood(id: unknown): id is GoodId {
  return typeof id === 'string' && (GOODS as readonly string[]).includes(id);
}

/** A cargo hold or any per-good amount. */
export type GoodAmounts = Record<GoodId, number>;

export function emptyAmounts(): GoodAmounts {
  return { fish: 0, grain: 0, timber: 0, stone: 0 };
}

export function totalAmount(amounts: GoodAmounts): number {
  return GOODS.reduce((sum, g) => sum + amounts[g], 0);
}
