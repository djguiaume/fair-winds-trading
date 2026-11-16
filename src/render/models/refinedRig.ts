import * as THREE from 'three';
import { SLOOP_HULL, type HullShape } from '../../sim/hullShape';
import type { FigureheadMount, ShipDamageData } from '../../data/ships';
import type { BoatCargo, BoatDetails } from './boatDetails';
import { STYLE_D as ST } from './boatStyle';
import { paint } from './geometry';
import type { ShipUpgrades } from './types';

/*
 * What the shared refined builder (refinedBoat.ts) is given for one ship class, and the deck
 * helpers its parts share: the deck outline, its width at a station and a spar between two points.
 */

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Normalized hull sections, authored independently of rig dimensions and palette. */
export type { HullShape } from '../../sim/hullShape';

/** Dimensions and hull sections are authored per class. */
export interface RefinedRig {
  /** The ship file's id ("sloop"), when built from one. */
  id?: string;
  name: string;
  length: number;
  beam: number;
  depth: number;
  hullShape?: HullShape;
  mastZ: number;
  mastHeight: number;
  band: string;
  /** The sail bands' class colour (decision 0259), before any cosmetic look. */
  sailBand: string;
  hull: string;
  stockJibs: number;
  cargoExtra: number;
  boom: number;
  gaff: number;
  /** Optional shorter forward mast; only the aft main carries the upgraded topsail. */
  foremast?: { z: number; height: number; boom: number; gaff: number };
  /** Third fore-and-aft mast for the swift-line clipper, with its own upgraded topsail. */
  mizzen?: { z: number; height: number; boom: number; gaff: number };
  hatchZ?: number;
  cargoZ?: number;
  cargoX?: number;
  maxJibs?: number;
  /** Square-rigged masts (hauler line, decision 0079): stacked courses hang from yards that
   * brace round together; the top course is added at sails 3. The jibs stay on the foremost. */
  squareMasts?: ReadonlyArray<SquareMast>;
  /** Raised stern deck of the big square riggers, in reference units. Masts, sheets and the
   * tiller standing on it start from its top. */
  castle?: { length: number; height: number };
  /** The main gaff carries the sails-3 topsail (default true). */
  mainTopsail?: boolean;
  /** The fluyt's only gaff is its aft mizzen. */
  mainName?: 'Mainsail' | 'Mizzen';
  /** Boom height above the deck at the mast (default 0.7); raised to clear tall deck cargo. */
  gooseneck?: number;
  /** Class-specific fittings (leeboards, hatch coamings…) merged into the hull mesh, so they
   * cost no extra draw call. Receives the deck sheer and the upgrade levels. */
  details?: (ctx: HullDetailContext) => THREE.BufferGeometry[];
  /** Extra geometry fitted onto the finished hull mesh (the indiaman's gun ports are cast onto
   * its sides); merged into it, so it costs no extra draw. */
  hullFinish?: (
    hull: THREE.BufferGeometry,
    deckAt: (z: number) => number,
  ) => THREE.BufferGeometry[];
  /** Class-authored deck fittings, including window panes tagged with glowing(). */
  boatDetails?: BoatDetails;
  replaceDeckDetails?: boolean;
  cargo?: BoatCargo;
  /** Where her damage shows (decision 0208), from the ship file. */
  damage?: ShipDamageData;
  /** Where a figurehead sits; left out, she carries none. */
  figureheadMount?: FigureheadMount;
  /** Authored quarterdeck and rear rig heights; foot is above the original main deck. */
  sternLayout?: { deck: number; foot: number; aft: number; sheet: { z: number; y: number } };
}

/** A mast's foot height, height and station along the deck. */
export interface MastSpot {
  base: number;
  height: number;
  z: number;
}

export interface HullDetailContext {
  /** Deck height at a station along the hull (bow +Z before the model's final turn). */
  deckAt: (z: number) => number;
  /** Half the scaled beam at the deck. */
  halfBeam: number;
  /** Scaled hull depth, deck to keel. */
  depth: number;
  upgrades: ShipUpgrades;
}

export interface SquareMast {
  /** Mesh names: `${name}Yards` and `${name}Courses`, e.g. Fore / Main. */
  name: string;
  z: number;
  height: number;
  /** Courses at sails 3; one fewer below. */
  courses: number;
}

/** Deck height at station `z` (bow +Z) for a rig's hull, before the model's final turn. */
export function deckHeight(rig: Pick<RefinedRig, 'length' | 'depth'>) {
  const L = rig.length;
  const DECK = rig.depth * ST.H * 0.55;
  return (z: number) => DECK + ST.sheer * (L / 5) ** 0.5 * (z / (L / 2)) ** 2;
}

/** Deck outline in ship-local coordinates (+Z bow), shared by the hull and the stern castle. */
export function deckOutline(rig: RefinedRig) {
  const L = rig.length;
  const B = rig.beam * ST.B;
  const deckAt = deckHeight(rig);
  return (rig.hullShape ?? SLOOP_HULL).outline.map(([x, z]) => V(x * B, deckAt(z * L), z * L));
}

/** Half the deck's width at `z`, read from the authored outline (for shrouds and sheets). */
export function halfBeamAt(outline: THREE.Vector3[], z: number) {
  let best = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    if ((a.z - z) * (b.z - z) > 0 || a.z === b.z) continue;
    best = Math.max(best, Math.abs(a.x + ((b.x - a.x) * (z - a.z)) / (b.z - a.z)));
  }
  return best;
}

/** A spar between two actual attachment points. */
export function spar(a: THREE.Vector3, b: THREE.Vector3, radius = 0.045) {
  const d = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(radius, radius, d.length(), 5);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return paint(g, ST.mast);
}
