import type { WindConfig } from './wind';

/**
 * A map is plain data (decision 0008): Phase 0 ships one handmade JSON file in `src/data/`; a
 * seeded generator can later produce the same shape without touching the simulation.
 */
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
     * What the island's props show it produces (decision 0012): 'fish', 'timber', 'grain' or
     * 'stone'. A plain string so map JSON type-checks; anything else draws a plain island.
     */
    kind?: string;
    houses?: number;
    trees?: number;
    rock?: boolean;
    dock?: boolean;
  };
}

export interface WaypointDef {
  /** Name shown in the HUD ("Sail to …"). */
  label: string;
  x: number;
  y: number;
}

export interface MapDef {
  name: string;
  seed: number;
  /** The playable sea is a disc of this radius around (0, 0). */
  boundsRadius: number;
  wind: WindConfig;
  start: { x: number; y: number; headingDeg: number };
  islands: IslandDef[];
  /** Phase 0 practice course: buoys to reach in order, looping. */
  course: WaypointDef[];
}
