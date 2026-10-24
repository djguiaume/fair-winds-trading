import type { IslandDef, LandmarkKind } from '../sim/map';

/**
 * Island files (decisions 0096 and 0101): one JSON per designed port island in
 * `src/data/islands/<id>.json`. Coordinates are island-radius units with the harbour toward +z
 * and x to the right seen from the sea, so a file scales with the radius set in the map. Heights
 * (`height`, `y`, `base`) are radius units too.
 */
export type IslandStyle = 'fish' | 'timber' | 'grain' | 'stone' | 'tropic';
export type Point = [number, number];

/**
 * Raised ground: every edge is a cliff unless it is sloped (decision 0096 §4). Low ground that is
 * a coast's beach inset names the coast.
 */
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
  /** A ramp of this width (radius units) down from the edges, outward, instead of a cliff. */
  slope?: number;
  /** Which edges slope, as runs of edge indices [first, last]; left out, every edge. */
  slopeEdges?: [number, number][];
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

/**
 * A ramp (decision 0123): a band `width` wide along `points` (straight runs, at least two), rising
 * evenly from `start` at the first point to `end` at the last, so it can curl round raised ground.
 * Heights are radius units, like ground.
 */
export interface RampDef {
  points: Point[];
  width: number;
  start: number;
  end: number;
  material: 'grass' | 'rock';
  from?: number;
  to?: number;
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
  /**
   * Game hooks: workshop, windmill, log-yard:shore, log-yard:upland, outbuilding; `after:<quest>`
   * (stands once that quest is done) and `before:<quest>` (gone once it is done, decision 0130).
   */
  tags?: string[];
}

/**
 * A fixed build spot of the home island (decision 0126). An arc spot takes one building of its
 * `pair` (src/data/buildings.json); a spot without a pair is a spare, for a building passed over.
 */
export interface HomeSpotDef {
  id: string;
  x: number;
  z: number;
  /** Height in radius units, for a spot on raised ground. */
  y?: number;
  pair?: string;
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
  /** Painted circles [x, z, r] where trees may grow; left out or empty, anywhere in `area`. */
  areas?: [number, number, number][];
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
  /** Ramps that climb along their length (decision 0123); left out, none. */
  ramps?: RampDef[];
  piers: PierDef[];
  props: PropDef[];
  /** The home island's build spots (decision 0126); props tagged `home:<building>` stand on them. */
  homeSpots?: HomeSpotDef[];
  woods: WoodsDef;
}

/** Every file in src/data/islands/, by id: one per island (decision 0110). */
export const ISLAND_DESIGNS: Record<string, IslandDesign> = Object.fromEntries(
  Object.values(
    import.meta.glob<IslandDesign>('./islands/*.json', { eager: true, import: 'default' }),
  ).map((d) => [d.id, d]),
);

/** Islands and tests that only name a producer style get that style's shipped island. */
const DESIGN_FOR_STYLE: Record<IslandStyle, string> = {
  timber: 'calda',
  fish: 'saltmere',
  grain: 'westholm',
  stone: 'south-cay',
  // The south sea's palm islands (decision 0151).
  tropic: 'sunreach',
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

/** An island's landmark: its look's, or the first landmark prop of its file (decision 0110). */
export function landmarkOf(island: IslandDef): LandmarkKind | undefined {
  const landmarks: string[] = ['lighthouse', 'ruins', 'wreck', 'beacon'] satisfies LandmarkKind[];
  return (
    island.look?.landmark ??
    (designOf(island)?.props.find((p) => landmarks.includes(p.type))?.type as LandmarkKind)
  );
}

/** Is this element present at a level? */
export const atLevel = (e: { from?: number; to?: number }, level: number) =>
  (e.from ?? 1) <= level && level <= (e.to ?? 4);

/**
 * Shown with these quests done (decision 0130)? A tag `after:<quest>` needs that quest done,
 * `before:<quest>` needs it not done; other tags do not matter. Island props, sea marks and the
 * lights on them all follow this one rule.
 */
export function questShown(e: { tags?: readonly string[] }, done: ReadonlySet<string>): boolean {
  for (const tag of e.tags ?? []) {
    if (tag.startsWith('after:') && !done.has(tag.slice('after:'.length))) return false;
    if (tag.startsWith('before:') && done.has(tag.slice('before:'.length))) return false;
  }
  return true;
}

/** The quests an element's `after:` and `before:` tags name. */
export function questTagIds(e: { tags?: readonly string[] }): string[] {
  return (e.tags ?? []).flatMap((tag) => {
    const m = /^(after|before):(.+)$/.exec(tag);
    return m ? [m[2]!] : [];
  });
}

/** Two elements that never stand together: one is `before:` a quest the other is `after:`. */
export function questApart(a: { tags?: readonly string[] }, b: { tags?: readonly string[] }) {
  const has = (e: { tags?: readonly string[] }, tag: string) => e.tags?.includes(tag) ?? false;
  return questTagIds(a).some(
    (q) =>
      (has(a, `before:${q}`) && has(b, `after:${q}`)) ||
      (has(a, `after:${q}`) && has(b, `before:${q}`)),
  );
}

/** The island file as it stands with these quests done: its props filtered by `questShown`. */
export function questDesign(design: IslandDesign, done: ReadonlySet<string>): IslandDesign {
  if (!design.props.some((p) => questTagIds(p).length)) return design;
  return { ...design, props: design.props.filter((p) => questShown(p, done)) };
}

/**
 * The island builder's play-test (decision 0105): an edited island file takes the shipped one's
 * place for this page only. Islands are looked up by id, so the map and every model follow.
 */
export function useIslandDesign(design: IslandDesign) {
  ISLAND_DESIGNS[design.id] = design;
}

/** Enough of an island file's shape to load it (the builder's checks then say what is wrong). */
export function isIslandShape(raw: unknown): raw is IslandDesign {
  const d = raw as IslandDesign | null;
  return (
    !!d &&
    typeof d === 'object' &&
    typeof d.id === 'string' &&
    typeof d.style === 'string' &&
    Array.isArray(d.coasts) &&
    Array.isArray(d.ground) &&
    Array.isArray(d.lanes) &&
    Array.isArray(d.piers) &&
    Array.isArray(d.props) &&
    !!d.woods &&
    typeof d.woods === 'object'
  );
}
