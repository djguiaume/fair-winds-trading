import type { IslandDef } from '../sim/map';
import { PROP_RECIPES } from './props';

/**
 * Island files (decisions 0096 and 0101): one JSON per designed port island in
 * `src/data/islands/<id>.json`. Coordinates are island-radius units with the harbour toward +z
 * and x to the right seen from the sea, so a file scales with the radius set in the map. Heights
 * (`height`, `y`, `base`) are radius units too.
 */
/** An island style: a key of `palette.json` › `styles` (walls, roofs, grounds; decision 0168). */
export type IslandStyle = string;
export type Point = [number, number];

/**
 * Raised ground: every edge is a cliff unless it is sloped (decision 0096 §4). Low ground that is
 * a coast's beach inset names the coast.
 */
export interface GroundDef {
  /** Index of a coast whose outline, inset by the beach width, this ground covers. */
  coast?: number;
  /** With `coast`: the beach's width in radius units (default `BEACH`); a narrow stony shore. */
  beach?: number;
  outline?: Point[];
  holes?: Point[][];
  height: number;
  /** A ground of `palette.json` › `grounds`, which the style may swap (decision 0168). */
  material: string;
  /** A rock cone over the outline instead of a flat top, rising from `base`. */
  shape?: 'peak';
  base?: number;
  /**
   * A peak's open top (a volcano, decision 0171): the crater's radius as a share of the peak's
   * size, 0.05 to 0.8. A ground that glows fills it with lava.
   */
  crater?: number;
  /** A ramp of this width (radius units) down from the edges, outward, instead of a cliff. */
  slope?: number;
  /** Which edges slope, as runs of edge indices [first, last]; left out, every edge. */
  slopeEdges?: [number, number][];
  /**
   * How much the new look smooths it (decision 0222, issue #269), 0 to 1; left out, 1. At 0 it
   * stays faceted, drawn crisp over the rolling ground: sea stacks, signature cliffs, crater rims.
   */
  smooth?: number;
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
  /** Lanes and paths: width in radius units (default `LANE_WIDTH`, a path 0.055); narrow village lanes (0173). */
  width?: number;
}

/** A lane's or path's width when its file gives none (radius units). */
export const LANE_WIDTH = 0.04;

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
  material: string;
  from?: number;
  to?: number;
}

/**
 * A river (decision 0176): a ribbon `width` wide along `points`, source first, mouth last, that
 * lies on the ground (plateaus, ramps, slopes, mountains). Where the ground drops at a cliff it
 * falls as a sheet to the ground below; a mouth past the coast falls into the sea. `water` is
 * drawn in the lake's colour; `lava` glows at night like lit windows, with a dark crust and steam
 * where it meets the sea. Points are [x, z] in radius units, or [x, z, width] for a point that
 * is wider or narrower than `width`: the river widens and narrows smoothly between points.
 */
export interface RiverDef {
  kind?: 'water' | 'lava';
  points: number[][];
  width: number;
  from?: number;
  to?: number;
  /** `after:<quest>` and `before:<quest>`, like props (decision 0130). */
  tags?: string[];
}

/** A sculpting operation (decision 0230): see `src/sim/sculpt.ts` for what each one does. */
export type SculptOp = 'raise' | 'lower' | 'flatten' | 'smooth' | 'slope';

/**
 * One hand edit of the ground, laid over the island's generated ground (decision 0230). Edits are
 * replayed in file order, on the same canonical grid at every quality level and settlement level.
 * Places, sizes and heights are radius units in this file's frame, so an edit follows the island
 * when the map moves, turns or resizes it.
 */
export interface SculptEdit {
  op: SculptOp;
  /**
   * The brush's dabs [x, z], in order: one drag is one edit. A slope's two ends [x, z, height]:
   * the ground ramps evenly from one height to the other between them.
   */
  points: number[][];
  /** The brush's radius; a slope's half width. */
  radius: number;
  /**
   * `raise` and `lower`: the height each dab adds or takes at the brush's centre. The others: the
   * share of the way, 0 to 1, each dab pulls the ground toward its target.
   */
  strength: number;
  /** The share of the radius, 0 to 1, over which the brush fades out at its rim; 0 = a hard edge. */
  falloff: number;
  /** `flatten`: the height the ground is pulled to. */
  height?: number;
  /**
   * Edits the protected ground round buildings too; the island checks then make sure every
   * building still stands level. Left out, that ground is never touched.
   */
  override?: boolean;
}

/** The island's hand edits, after its generated ground (decision 0230). */
export interface SculptDef {
  /** The replay rules the edits were made with; a file from a newer game version will not load. */
  version: number;
  edits: SculptEdit[];
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
/**
 * How the harbour screen pictures this island's port (decision 0211); left out, the camera stands
 * off the harbour pier and the accent is the town style's first roof colour.
 */
export interface HarbourViewDef {
  /** Where the camera stands, in this file's coordinates. */
  from?: Point;
  /** Where it looks. */
  look?: Point;
  /** Camera height, in radius units. */
  height?: number;
  /** Height of the point it looks at, in radius units. */
  lookHeight?: number;
  /** The port's signature colour: the accent line under the header. */
  accent?: string;
}

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
  /** Painted circles [x, z, r] of woods only the new look's forest grows (decision 0236). */
  groves?: [number, number, number][];
  /**
   * The new look's forest (issue #275): a multiplier on its biome's cover (`forests.json`), 0 for
   * none; left out, 1. The biome picks the trees; `tree`, `tries` and `spacing` are the classic
   * look's, but woods off (`tries` 0) grow no forest either.
   */
  density?: number;
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
  /** Rivers of water or lava (decision 0176); left out, none. */
  rivers?: RiverDef[];
  /** Ramps that climb along their length (decision 0123); left out, none. */
  ramps?: RampDef[];
  /** Hand edits of the ground (decision 0230), replayed in order; left out, none. */
  sculpt?: SculptDef;
  piers: PierDef[];
  props: PropDef[];
  /** The home island's build spots (decision 0126); props tagged `home:<building>` stand on them. */
  homeSpots?: HomeSpotDef[];
  woods: WoodsDef;
  /** The harbour screen's picture and accent (decision 0211); left out, the defaults. */
  harbourView?: HarbourViewDef;
}

/** Every file in src/data/islands/, by id: one per island (decision 0110). */
export const ISLAND_DESIGNS: Record<string, IslandDesign> = Object.fromEntries(
  Object.values(
    import.meta.glob<IslandDesign>('./islands/*.json', { eager: true, import: 'default' }),
  ).map((d) => [d.id, d]),
);

/** Islands and tests that only name a producer style get that style's shipped island. */
const DESIGN_FOR_STYLE: Record<string, string> = {
  timber: 'calda',
  fish: 'saltmere',
  grain: 'westholm',
  stone: 'south-cay',
  // The south sea's palm islands (decision 0152).
  tropic: 'sunreach',
};

/** A design by id, or the shipped design of a style ('timber' is Port Calda). */
export function islandDesign(idOrStyle: string): IslandDesign {
  const design = ISLAND_DESIGNS[idOrStyle] ?? ISLAND_DESIGNS[DESIGN_FOR_STYLE[idOrStyle] ?? ''];
  if (!design) throw new Error(`No island file for "${idOrStyle}"`);
  return design;
}

/** The design an island of the map is built from, if it has one. */
export function designOf(island: IslandDef): IslandDesign | null {
  const id = island.look?.design ?? island.look?.profile;
  return id ? islandDesign(id) : null;
}

/** An island's landmark: its look's, or the first landmark prop of its file (decision 0110). */
export function landmarkOf(island: IslandDef): string | undefined {
  // Any prop of the `landmarks` group counts: a broch, a foghorn tower, a cairn (decision 0173).
  return (
    island.look?.landmark ??
    designOf(island)?.props.find((p) => PROP_RECIPES[p.type]?.group === 'landmarks')?.type
  );
}

/** A volcano you steer by: a peak with a crater on the island's file (decision 0171). */
export const hasVolcano = (island: IslandDef) =>
  !!designOf(island)?.ground.some((g) => g.shape === 'peak' && g.crater);

/** A sea stack you steer by: ground at least twice the island's radius tall (decision 0181). */
export const isSeaStack = (island: IslandDef) =>
  !!designOf(island)?.ground.some((g) => (g.height ?? 0) >= 2);

/** Is this element present at a level? */
export const atLevel = (e: { from?: number; to?: number }, level: number) =>
  (e.from ?? 1) <= level && level <= (e.to ?? 4);

/**
 * Shown with these quests done (decision 0130)? A tag `after:<quest>` needs that quest done,
 * `before:<quest>` needs it not done; other tags do not matter. Island props, sea marks and the
 * lights on them all follow this one rule. Islands and shapes (decision 0166) also take
 * `during:<quest>` (only while it runs) and `except:<quest>` (not while it runs), read from
 * `running`, the quests started and not done.
 */
export function questShown(
  e: { tags?: readonly string[] },
  done: ReadonlySet<string>,
  running: ReadonlySet<string> = NONE,
): boolean {
  for (const tag of e.tags ?? []) {
    if (tag.startsWith('after:') && !done.has(tag.slice('after:'.length))) return false;
    if (tag.startsWith('before:') && done.has(tag.slice('before:'.length))) return false;
    if (tag.startsWith('during:') && !running.has(tag.slice('during:'.length))) return false;
    if (tag.startsWith('except:') && running.has(tag.slice('except:'.length))) return false;
  }
  return true;
}
const NONE: ReadonlySet<string> = new Set();

/** Tags that follow a running quest (decision 0166): islands and shapes only. */
export const runningTag = (tag: string) => /^(during|except):/.test(tag);

/** The quests an element's `after:` and `before:` tags name. */
export function questTagIds(e: { tags?: readonly string[] }): string[] {
  return (e.tags ?? []).flatMap((tag) => {
    const m = /^(after|before|during|except):(.+)$/.exec(tag);
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

/** The quests an island file's props and rivers name in `after:` and `before:` tags. */
export function designQuestIds(design: IslandDesign): string[] {
  return [...design.props, ...(design.rivers ?? [])].flatMap(questTagIds);
}

/** The island file as it stands with these quests done: props and rivers by `questShown`. */
export function questDesign(design: IslandDesign, done: ReadonlySet<string>): IslandDesign {
  if (!designQuestIds(design).length) return design;
  return {
    ...design,
    props: design.props.filter((p) => questShown(p, done)),
    ...(design.rivers && { rivers: design.rivers.filter((r) => questShown(r, done)) }),
  };
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
