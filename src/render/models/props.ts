import * as THREE from 'three';
import type { Rng } from '../../sim/rng';
import { PALETTE, PROP_RECIPES, type PropGroup, type PropRecipe } from '../../data/props';
import { paint } from './geometry';
import { buildProp, prepareProp, type Parts, type PropBuildArgs } from './propRecipe';

/**
 * The prop catalogue (decisions 0101, 0135): the low-poly buildings and props of the port towns,
 * and the type ids island files place them by. Each type is a recipe file in
 * `src/data/props/<id>.json` with its colours from `src/data/palette.json`; models are in
 * reference units, front toward +Z. The functions below are the old town code's names for them.
 */
export type { Parts, PropGroup };
export type Kind = 'fish' | 'timber' | 'grain' | 'stone' | 'yard';

/** The named colours of `palette.json` (terrain, wood, trees, crops…). */
export const C = PALETTE.colors as unknown as Record<ColorName, string> &
  Record<'pine' | 'leaves' | 'crops', string[]>;
type ColorName =
  | 'sand'
  | 'grass'
  | 'meadow'
  | 'rock'
  | 'rock2'
  | 'cut'
  | 'wood'
  | 'post'
  | 'plank'
  | 'stone'
  | 'stoneDark'
  | 'chimney'
  | 'trunk'
  | 'furrow'
  | 'hay'
  | 'lamp'
  | 'flag'
  | 'sail'
  | 'cream'
  | 'dark';

/** Walls and roofs per port kind: the fishing town, the timber town, the farm and the quarry. */
export const STYLE = PALETTE.styles as Record<Kind, { walls: string[]; roofs: string[] }>;

// ---------------------------------------------------------------- geometry helpers

export const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: string) =>
  paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);

export const cyl = (
  rt: number,
  rb: number,
  h: number,
  x: number,
  y: number,
  z: number,
  c: string,
  n = 6,
) => paint(new THREE.CylinderGeometry(rt, rb, h, n).translate(x, y, z), c);

/** Moves parts to (x, y, z), turned by rotY and scaled. */
export function put(out: Parts, parts: Parts, x: number, y: number, z: number, rotY = 0, s = 1) {
  for (const g of parts) out.push(g.scale(s, s, s).rotateY(rotY).translate(x, y, z));
}

// ---------------------------------------------------------------- the old town code's pieces

/** A recipe built with the old town code's arguments: a seeded stream and set vars. */
const piece = (id: string, o: Partial<PropBuildArgs> = {}) =>
  buildProp(id, { R: 1, style: 'fish', variant: 0, shape: 0.5, size: 1, ...o });

export const fishHouse = (i: number, rng: Rng) => piece('fish-house', { variant: i, rng });
export const cabin = (i: number, rng: Rng) => piece('cabin', { variant: i, rng });
export const farmhouse = (i: number) => piece('farmhouse', { variant: i });
export const barn = () => piece('barn');
export const stoneHouse = (i: number) => piece('stone-house', { variant: i });
export const yardHouse = (i: number) => piece('yard-house', { variant: i });
export const pine = (rng: Rng) => piece('pine', { rng });
export const broadleaf = (rng: Rng) => piece('broadleaf', { rng });
export const windmill = (bare = false) => piece(bare ? 'windmill-bare' : 'windmill');
export const rack = () => piece('rack');
export const smokehouse = () => piece('smokehouse');
export const marketHall = () => piece('market-hall');
/** A small fishing boat at its mooring, mast up (also the sea marks' boats). */
export const fishingBoat = () => piece('fishing-boat');
export const logPile = () => piece('log-pile');
/** The old town code's sawmill shed with its wheel on the side. */
export const sawmill = () => piece('sawmill-shed');
export const lumber = () => piece('lumber');
/** A ship on the stocks: keel and ribs, then a planked hull. */
export const slip = (planked: boolean) => piece('slip', { vars: { planked: +planked } });
export const bakery = () => piece('bakery');
export const masons = () => piece('masons');
export const haystack = () => piece('haystack');
export const granary = () => piece('granary');
export const spireChurch = () => piece('spire-church');
export const keep = () => piece('keep');
export const derrick = () => piece('derrick');
export const blocks = (n: number) => piece('stone-blocks', { vars: { n } });
export const crates = (n: number) => piece('crates', { vars: { n } });
/** A warehouse under the second roof colour of a port kind. */
export const warehouseOf = (kind: Kind) => piece('warehouse', { style: kind, vars: { roof: 1 } });
export const lampPost = () => piece('lamp-post');

// ---------------------------------------------------------------- the catalogue

export interface PropArgs {
  /** The island's radius in reference units, for props sized in radius units. */
  R: number;
  style: string;
  variant: number;
  shape: number;
  size: number;
  length?: number;
}

export interface PropType {
  group: PropGroup;
  /** Its name in the island builder, when the file gives one. */
  name?: string;
  build: (a: PropArgs) => Parts;
  /** A residence: numbered in file order, lanes grow near it, it clears woods round it. */
  home?: boolean;
  /** Buildings must not overlap each other (a warning in the checks). */
  building?: boolean;
  /** Stands in the sea, outside every coast. */
  water?: boolean;
  /** The model takes `size` itself rather than being scaled (the landmarks). */
  sizedInModel?: boolean;
  /** Footprint radius in reference units at size 1, where it is not the model's own extent. */
  fit?: number;
  /** Footprint radius in island-radius units, for props sized by the island (fields). */
  fitRadius?: number;
  /** May overhang a ledge or the water (slipways, rails, paving): only its centre is checked. */
  edge?: boolean;
}

const typeOf = (r: PropRecipe): PropType => ({
  group: r.group,
  name: r.name,
  build: (a) => buildProp(r.id, a),
  home: r.home,
  building: r.building,
  water: r.water,
  sizedInModel: r.sizedInModel,
  fit: r.fit,
  fitRadius: r.fitRadius,
  edge: r.edge,
});

/** Every type an island file can place, by id: the recipe files not marked `internal`. */
export const PROP_TYPES: Record<string, PropType> = Object.fromEntries(
  Object.values(PROP_RECIPES)
    .filter((r) => !r.internal)
    .map((r) => [r.id, typeOf(r)]),
);

/** Woodland model preparers draw seeded size and colour without building rejected candidates. */
export const WOODLAND_TREES: Record<string, (rng: Rng) => () => Parts> = Object.fromEntries(
  // Every `woodland-*` recipe is a tree an island file's woods can grow (the palms, 0152).
  Object.keys(PROP_RECIPES)
    .filter((id) => id.startsWith('woodland-'))
    .map((id) => [
      id,
      (rng: Rng) => prepareProp(id, { R: 1, style: 'fish', variant: 0, shape: 0.5, size: 1, rng }),
    ]),
);
