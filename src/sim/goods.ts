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

/** The bulk good each specialty is made from (decision 0063). */
export const MADE_FROM: Record<SpecialtyGood, GoodId> = {
  smokedFish: 'fish',
  bread: 'grain',
  planks: 'timber',
  cutStone: 'stone',
};

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

export const GOOD_DEFS: Record<GoodId, GoodDef> = {
  fish: { id: 'fish', name: 'Fish', basePrice: 8 },
  grain: { id: 'grain', name: 'Grain', basePrice: 10 },
  timber: { id: 'timber', name: 'Timber', basePrice: 14 },
  stone: { id: 'stone', name: 'Stone', basePrice: 18 },
  smokedFish: { id: 'smokedFish', name: 'Smoked fish', basePrice: 20 },
  bread: { id: 'bread', name: 'Bread', basePrice: 24 },
  planks: { id: 'planks', name: 'Planks', basePrice: 32 },
  cutStone: { id: 'cutStone', name: 'Cut stone', basePrice: 40 },
  honey: { id: 'honey', name: 'Honey', basePrice: 55 },
  lampOil: { id: 'lampOil', name: 'Lamp oil', basePrice: 50 },
};

/** Icons shared by the chart and harbour views. */
export const GOOD_ICONS: Record<GoodId, string> = {
  fish: '🐟',
  grain: '🌾',
  timber: '🪵',
  stone: '🪨',
  smokedFish: '🍢',
  bread: '🍞',
  planks: '🪚',
  cutStone: '🧱',
  honey: '🍯',
  lampOil: '🪔',
};

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
