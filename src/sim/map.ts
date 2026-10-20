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
  look?: { trees?: number; landmark?: LandmarkKind };
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
}
