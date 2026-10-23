import type { GoodId } from './goods';
import type { WindConfig } from './wind';

/**
 * A map is plain data (decision 0008): Phase 0 ships one handmade JSON file in `src/data/`; a
 * seeded generator can later produce the same shape without touching the simulation.
 */
export type LandmarkKind = 'lighthouse' | 'ruins' | 'wreck' | 'beacon';

export interface IslandDef {
  id: string;
  name?: string;
  x: number;
  y: number;
  /** Collision radius of the beach line (units). */
  radius: number;
  /** Visual hints for the island model; the simulation ignores them. */
  look?: {
    /**
     * Island file id in `src/data/islands/` (decision 0101): coasts, ground, town and props.
     * Islands without one keep the generated look.
     */
    design?: string;
    /**
     * Producer style of a designed island, set by `prepareMap` (from the island file); an island
     * with only a style is built from that style's shipped island file.
     */
    profile?: 'fish' | 'timber' | 'grain' | 'stone';
    /** Harbour bearing in radians, shared with coastline transforms. */
    harbourBearing?: number;
    /**
     * What the island's props show it produces (decision 0016): 'fish', 'timber', 'grain' or
     * 'stone'. Defaults to the first good its port produces; anything else draws a plain island.
     * A plain string so map JSON type-checks.
     */
    kind?: string;
    landmark?: LandmarkKind;
    /** Optional scenic cliff tiers, 1–4; existing ports retain their normal profile. */
    layers?: number;
    houses?: number;
    trees?: number;
    rock?: boolean;
    dock?: boolean;
  };
}

/** A coastline shared by rendering and collision; coordinates are world x east / y north.
 * Sandbanks are permanently above-water obstacles for now, not a new depth/damage system.
 * Reefs are rocks and coral just awash: solid to the hull like a shore, drawn without land
 * (decision 0031).
 */
export interface TerrainDef {
  id: string;
  /** Shown on the sea chart. */
  name?: string;
  kind: 'island' | 'sandbank' | 'reef';
  outline: [number, number][];
  look?: {
    trees?: number;
    landmark?: LandmarkKind;
    /**
     * Where the landmark stands, set by hand (decision 0130); left out, the first spot its seeded
     * details take. Pins a wreck the prologue sails to when the outline is reshaped.
     */
    landmarkAt?: { x: number; y: number };
  };
  /** Seeds its rocks, coral and trees; left out, its place in the list does (decision 0110). */
  seed?: number;
}

export interface WaypointDef {
  /** Name shown in the HUD ("Sail to …"). */
  label: string;
  x: number;
  y: number;
}

/** A settlement you can dock at and trade with (decision 0015). It sits on one island. */
export interface PortDef {
  id: string;
  name: string;
  islandId: string;
  /** Goods made here: plentiful and cheap. */
  produces: GoodId[];
  /** Goods the town needs: scarce and dear. */
  wants: GoodId[];
  /** Ship classes its shipwright builds (decision 0048). */
  builds?: string[];
  /** Off the chart until the boat sails near it (decision 0048). */
  hidden?: boolean;
  /** Settlement level at the start of a voyage, 1 (hamlet) to 4 (port town); default 2, a village (decision 0059). */
  level?: number;
  /** Extra goods the town wants once it reaches a level, keyed by level ("2" up to the top level) (decision 0059). */
  levelWants?: Partial<Record<string, GoodId[]>>;
  /** Specialized goods its workshop starts making at a level, keyed like `levelWants` (decision 0063). */
  levelProduces?: Partial<Record<string, GoodId[]>>;
  /** Specialized goods the town buys once some town makes them (decision 0063). */
  wantsMade?: GoodId[];
  /**
   * What the town trades once a quest is done (decision 0130), by quest id: each field given takes
   * the place of the port's own (e.g. `levelProduces` with its specialty a level earlier).
   */
  afterQuest?: Record<string, PortTradeChange>;
}

/** The trade fields a quest can change in a port (decision 0130). */
export type PortTradeChange = Partial<
  Pick<PortDef, 'produces' | 'wants' | 'levelProduces' | 'levelWants' | 'wantsMade'>
>;

/** The kinds of sea mark (decision 0130): channel buoys, a boat at work, a light on the chart. */
export const SEA_MARK_TYPES = ['buoy-red', 'buoy-green', 'fishing-boat', 'light'] as const;
export type SeaMarkType = (typeof SEA_MARK_TYPES)[number];

/**
 * Something at sea that is not on an island (decision 0130): a channel buoy, a fishing boat, a
 * light drawn on the chart. Not solid. Its `tags` (`after:<quest>`, `before:<quest>`) show and
 * hide it like an island prop's; `chart` also draws it on the sea chart (a `light` is chart only).
 */
export interface SeaMarkDef {
  type: SeaMarkType;
  x: number;
  y: number;
  /** Heading in degrees, 0 = north, clockwise (a boat's bow). */
  turn?: number;
  tags?: string[];
  chart?: boolean;
}

export interface MapDef {
  name: string;
  /** Explicit compatible predecessor maps; never accept arbitrary other-map saves. */
  compatibleSaveMaps?: string[];
  seed: number;
  /** The playable sea is a disc of this radius around (0, 0). */
  boundsRadius: number;
  wind: WindConfig;
  start: { x: number; y: number; headingDeg: number };
  islands: IslandDef[];
  terrain?: TerrainDef[];
  /** Phase 0 practice course: buoys to reach in order, looping. */
  course: WaypointDef[];
  /** Opt-in prototype practice only; normal trading has no assigned course. */
  practiceCourse?: boolean;
  /** Trading ports (Phase 1). */
  ports: PortDef[];
  /** Port id of the home port: upgrades and ship changes (decision 0048). Default: nearest the start. */
  homePort?: string;
  /**
   * Island id of the captain's own island (decision 0126): fixed build spots in its file, a pier
   * to dock at, no market. Not to be confused with `homePort`.
   */
  homeIsland?: string;
  /**
   * The tutorial's prologue (decision 0127): where a voyage that takes it begins, and the terrain
   * feature whose wreck landmark is the boat to rescue. Without it the tutorial starts at the chart.
   */
  prologue?: { start: { x: number; y: number; headingDeg: number }; wreck: string };
  /** Buoys, boats and lights at sea (decision 0130). */
  marks?: SeaMarkDef[];
}
