import type { HullShape } from '../sim/hullShape';
import type { ShipClass, ShipLine } from '../sim/ship';

/**
 * Ship files (decisions 0093 and 0109): one JSON per ship class in `src/data/ships/<id>.json`,
 * holding everything about it. Adding a file adds the ship: it sails, can be bought where a map's
 * port `builds` it, and is drawn by the shared `RefinedBoat` builder from its `model`.
 * How to write one: docs/content/README.md.
 */
export interface ShipFile {
  /** Must match the file name; stored in saves, so never rename a shipped ship. */
  id: string;
  /** English name; players see the translation (`ship.<id>` in `src/i18n/*.json`) if any. */
  name: string;
  line: ShipLine;
  /** 0 for the starter, 1 to 3 within a line: the shipyard order. */
  tier: number;
  unlock: Pick<ShipClass, 'standing' | 'price' | 'upgradePrices'>;
  /** How she sails (docs/sailing-model.md), plus `heel`: how readily she leans, 1 = sloop. */
  sailing: Omit<
    ShipClass,
    'id' | 'name' | 'line' | 'tier' | 'standing' | 'price' | 'upgradePrices'
  > & {
    heel: number;
  };
  /** Hull size (reference units) and its authored sections, shared by the model and harbours. */
  hull: { length: number; beam: number; depth: number } & HullShape;
  model: ShipModelData;
}

/** A mast of the fore-and-aft rig: position along the hull, height, boom and gaff lengths. */
export interface GaffMastData {
  z: number;
  height: number;
  boom: number;
  gaff: number;
}

/** The rig and look, in the shared builder's terms (`RefinedRig` in refinedBoat.ts). */
export interface ShipModelData {
  hullColor: string;
  bandColor: string;
  mastZ: number;
  mastHeight: number;
  boom: number;
  gaff: number;
  stockJibs: number;
  maxJibs?: number;
  cargoExtra: number;
  hatchZ?: number;
  cargoZ?: number;
  cargoX?: number;
  foremast?: GaffMastData;
  mizzen?: GaffMastData;
  squareMasts?: { name: string; z: number; height: number; courses: number }[];
  castle?: { length: number; height: number };
  mainTopsail?: boolean;
  mainName?: 'Mainsail' | 'Mizzen';
  gooseneck?: number;
  /** Named pieces from the code library `src/render/models/shipParts.ts` (leeboards, gun ports…). */
  parts?: string[];
}

const LINES: ShipLine[] = ['starter', 'swift', 'hauler', 'warship'];

/** Every ship file, in shipyard order: the starter, then each line by tier. */
export const SHIP_FILES: ShipFile[] = Object.values(
  import.meta.glob<ShipFile>('./ships/*.json', { eager: true, import: 'default' }),
).sort((a, b) => LINES.indexOf(a.line) - LINES.indexOf(b.line) || a.tier - b.tier);

/** The sim's view of a ship file: one flat class (the `?tune` panel edits these values). */
export function shipClassOf(file: ShipFile): ShipClass {
  const sailing = Object.fromEntries(Object.entries(file.sailing).filter(([k]) => k !== 'heel'));
  const { id, name, line, tier, unlock } = file;
  return {
    id,
    name,
    line,
    tier,
    standing: unlock.standing,
    ...(sailing as Omit<ShipFile['sailing'], 'heel'>),
    price: unlock.price,
    upgradePrices: unlock.upgradePrices,
  };
}
