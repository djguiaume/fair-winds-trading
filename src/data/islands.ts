import calda from './islands/calda.json';
import saltmere from './islands/saltmere.json';
import southCay from './islands/south-cay.json';
import westholm from './islands/westholm.json';
import type { IslandDef } from '../sim/map';

/**
 * Island files (decisions 0096 and 0097): one JSON per designed port island in
 * `src/data/islands/<id>.json`. Coordinates are island-radius units with the harbour toward +z
 * and x to the right seen from the sea, so a file scales with the radius set in the map. Heights
 * (`height`, `y`, `base`) are radius units too.
 */
export type IslandStyle = 'fish' | 'timber' | 'grain' | 'stone';
export type Point = [number, number];

/** Raised ground: every edge is a cliff. Low ground that is a coast's beach inset names the coast. */
export interface GroundDef {
  /** Index of a coast whose outline, inset by the beach width, this ground covers. */
  coast?: number;
  outline?: Point[];
  holes?: Point[][];
  height: number;
  material: 'grass' | 'rock';
  /** A rock cone over the outline instead of a flat top, rising from `base`. */
  shape?: 'peak';
  base?: number;
  from?: number;
  to?: number;
}

export interface LaneDef {
  /** `lane` (default) shows its pieces near homes that stand; `path` always; `stairs` climb. */
  kind?: 'lane' | 'path' | 'stairs';
  /** [x, z], or [x, z, height] for stairs. */
  points: number[][];
  /** Paths: the height they lie at. Stairs: the ground their masonry stands on. */
  y?: number;
  base?: number;
}

/** A side pier from a level; the arrival pier stays the simulation's (x 0.08). */
export interface PierDef {
  x: number;
  z: number;
  length: number;
  from: number;
}

export interface PropDef {
  /** An id from the prop catalogue (src/render/models/props.ts). */
  type: string;
  x: number;
  z: number;
  /** Degrees about the vertical, 0 = the model's front toward the harbour (+z). */
  turn?: number;
  size?: number;
  /** Colour or count, per type (a house's colours, how many crates or blocks, a field's crop). */
  variant?: number;
  /** 0 to 1: the proportion a type varies (a fish house's height, a cabin's length). */
  shape?: number;
  /** Ground props sized in radius units (rails, paving): their length. */
  length?: number;
  /** Height in radius units; left out, the prop stands on the ground, the sand or the sea. */
  y?: number;
  /** Footprint radius the checks use (radius units); left out, the model's own. */
  fit?: number;
  /** How far round it the woods are cleared (radius units); left out, its footprint + 0.1. */
  clear?: number;
  /** First level it stands at, 1 to 4, and the last one (left out: to the end). */
  from: number;
  to?: number;
  /** Game hooks: workshop, windmill, log-yard:shore, log-yard:upland, outbuilding. */
  tags?: string[];
}

/** The seeded scatter of woodland trees, cleared by homes, lanes, props and fields. */
export interface WoodsDef {
  tree: string;
  tries: number;
  /** Where trees are tried: [x0, z0, x1, z1]. */
  area: [number, number, number, number];
  size: number;
  /** How far a tree keeps from cliff edges, the beach and the lake. */
  margin: number;
  /** Closest two trees, and per ground height an override. */
  spacing: number;
  spacingAt?: [number, number][];
  /** Circles [x, z, r] kept clear of trees. */
  clear?: [number, number, number][];
}

export interface IslandDesign {
  id: string;
  name: string;
  style: IslandStyle;
  /** Seeds what stays generated: the woods. */
  seed: number;
  /** First the main island, then islets. */
  coasts: Point[][];
  lake?: Point[];
  ground: GroundDef[];
  lanes: LaneDef[];
  piers: PierDef[];
  props: PropDef[];
  woods: WoodsDef;
}

export const ISLAND_DESIGNS: Record<string, IslandDesign> = Object.fromEntries(
  ([calda, saltmere, westholm, southCay] as unknown as IslandDesign[]).map((d) => [d.id, d]),
);

/** Islands and tests that only name a producer style get that style's shipped island. */
const DESIGN_FOR_STYLE: Record<IslandStyle, string> = {
  timber: 'calda',
  fish: 'saltmere',
  grain: 'westholm',
  stone: 'south-cay',
};

/** A design by id, or the shipped design of a style ('timber' is Port Calda). */
export function islandDesign(idOrStyle: string): IslandDesign {
  const design =
    ISLAND_DESIGNS[idOrStyle] ?? ISLAND_DESIGNS[DESIGN_FOR_STYLE[idOrStyle as IslandStyle]];
  if (!design) throw new Error(`No island file for "${idOrStyle}"`);
  return design;
}

/** The design an island of the map is built from, if it has one. */
export function designOf(island: IslandDef): IslandDesign | null {
  const id = island.look?.design ?? island.look?.profile;
  return id ? islandDesign(id) : null;
}

/** Is this element present at a level? */
export const atLevel = (e: { from?: number; to?: number }, level: number) =>
  (e.from ?? 1) <= level && level <= (e.to ?? 4);
