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
  /** Where her damage shows (decision 0208); left out, `DEFAULT_DAMAGE` places it. */
  damage?: ShipDamageData;
}

/**
 * Where a ship's visible damage sits (decision 0208). Stations along the hull are fractions of her
 * length, -0.5 at the stern to 0.5 at the bow, like the hull `outline`; `side` is 1 or -1 (the
 * outline's +x or -x side). Below `seamanship.damage.scuffedBelow` the `scuffs` show; below
 * `patchedBelow` the sails are patched and the rail at `rail` is broken; below `tornBelow` the
 * sails have holes at `tears` (u along the foot, v up the luff, 0 to 1) and she lists `listDeg`
 * toward `listSide`.
 */
export interface ShipDamageData {
  scuffs: { z: number; side: number }[];
  rail: { z: number; side: number };
  tears: { u: number; v: number }[];
  listDeg: number;
  listSide: number;
}

/** Damage for a ship file without its own `damage` block. */
export const DEFAULT_DAMAGE: ShipDamageData = {
  scuffs: [
    { z: 0.3, side: 1 },
    { z: -0.1, side: -1 },
    { z: -0.32, side: 1 },
  ],
  rail: { z: 0.12, side: 1 },
  // One big hole, four panels, in the middle of the sail: small sails lose several small ones.
  tears: [
    { u: 0.45, v: 0.4 },
    { u: 0.6, v: 0.4 },
    { u: 0.45, v: 0.55 },
    { u: 0.6, v: 0.55 },
  ],
  listDeg: 6,
  listSide: 1,
};

/** What is wrong with a ship file's `damage` block (decision 0208), for `npm run check`. */
export function shipDamageProblems(file: ShipFile): string[] {
  const d = file.model.damage;
  if (!d) return [];
  const out: string[] = [];
  const where = `src/data/ships/${file.id}.json model.damage`;
  const station = (what: string, p: { z: number; side: number } | undefined) => {
    if (!p || !(p.z >= -0.5 && p.z <= 0.5)) out.push(`${where}: ${what} z must be -0.5 to 0.5`);
    if (p && p.side !== 1 && p.side !== -1) out.push(`${where}: ${what} side must be 1 or -1`);
  };
  (d.scuffs ?? []).forEach((s, i) => station(`scuffs[${i}]`, s));
  station('rail', d.rail);
  if (d.listSide !== 1 && d.listSide !== -1) out.push(`${where}: listSide must be 1 or -1`);
  for (const [i, t] of (d.tears ?? []).entries())
    if (!(t.u >= 0 && t.u <= 1 && t.v >= 0 && t.v <= 1))
      out.push(`${where}: tears[${i}] u and v must be 0 to 1`);
  if (!(d.listDeg >= 0 && d.listDeg <= 10)) out.push(`${where}: listDeg must be 0 to 10`);
  return out;
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
