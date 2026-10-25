import type { TrafficDef } from './traffic';
import type { FogDef } from './fog';
import type { GoodId } from './goods';
import type { SeaEdgeDef } from './seaEdge';
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
  /**
   * `after:<quest>`: the island rises once that quest is done; `before:<quest>`: it stands until
   * then (decision 0166, the rule of 0130). It swaps only out of the boat's sight.
   */
  tags?: string[];
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
    profile?: string;
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
 * (decision 0031). Shallows are a sandy passage under water: ships of draft `maxDraft` or less
 * sail across, slowed a little, and deeper ships are refused, softly, as by a sandbank
 * (decisions 0137, 0152). Ice is a field of floes, pack ice or grounded bergs (the north sea,
 * decision 0170): solid to every ship, a knock like running aground. A `bergs` shape is open
 * water where `count` icebergs drift (0170, `src/sim/bergs.ts`): the shape is not solid, its
 * bergs are, and Settings › Drifting icebergs off removes them.
 */
export interface TerrainDef {
  id: string;
  /** Shown on the sea chart. */
  name?: string;
  kind: 'island' | 'sandbank' | 'reef' | 'shallows' | 'ice' | 'bergs';
  outline: [number, number][];
  /** Shallows only: the deepest draft that crosses (a ship file's `draft`). */
  maxDraft?: number;
  /** Bergs only: how many drift in it, and their radius range in map units. */
  count?: number;
  size?: [number, number];
  /** Bergs only: which way they drift round the field, `ccw` (the default) or `cw` (0170). */
  spin?: 'cw' | 'ccw';
  /** Bergs only: how many loops, each inside the last and turning the other way (0170). */
  loops?: number;
  /** Bergs only: how far they sway either side of their loop, units (else `weather.json`). */
  sway?: number;
  look?: {
    trees?: number;
    landmark?: LandmarkKind;
    /**
     * Where the landmark stands, set by hand (decision 0130); left out, the first spot its seeded
     * details take. Pins a wreck the prologue sails to when the outline is reshaped.
     */
    landmarkAt?: { x: number; y: number };
    /** A sandbank's colour, `#rrggbb` (decision 0171: pumice grey); left out, sand. */
    color?: string;
    /**
     * A palette style (`src/data/palette.json`) whose `reefRock` and `coral` colours its rocks
     * take: the east sea's basalt skerries with weed instead of coral. Left out, the warm rocks
     * and coral of the ring.
     */
    style?: string;
  };
  /** Seeds its rocks, coral and trees; left out, its place in the list does (decision 0110). */
  seed?: number;
  /** `after:<quest>` / `before:<quest>`: the shape rises or clears with a quest (decision 0166). */
  tags?: string[];
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
  /**
   * The person on its harbour screen, a `characters.json` id (decision 0211); left out, nobody
   * (Abbey Head, Skerry). An outpost's keeper is its settler.
   */
  keeper?: string;
  /** Off the chart until the boat sails near it (decision 0048). */
  hidden?: boolean;
  /**
   * An empty island to found (decision 0157): not a port until a quest reward `found` names it.
   * Until then it has no pier, market or place on the chart, and she cannot dock there; then it
   * opens at its `level` and grows like any town.
   */
  site?: boolean;
  /** Settlement level at the start of a voyage, 1 (hamlet) to 4 (port town); default 2, a village (decision 0059). */
  level?: number;
  /** Extra goods the town wants once it reaches a level, keyed by level ("2" up to the top level) (decision 0059). */
  levelWants?: Partial<Record<string, GoodId[]>>;
  /** Specialized goods its workshop starts making at a level, keyed like `levelWants` (decision 0063). */
  levelProduces?: Partial<Record<string, GoodId[]>>;
  /** Specialized goods the town buys once some town makes them (decision 0063). */
  wantsMade?: GoodId[];
  /**
   * Made goods the town buys from a level on, once some port makes them, keyed like `levelWants`:
   * the ring's port towns buy the far goods crafted in the biomes (decision 0146).
   */
  levelWantsMade?: Partial<Record<string, GoodId[]>>;
  /** The highest level the town grows to; default the top level. Outposts stop at 3 (0146). */
  maxLevel?: number;
  /**
   * What the town trades once a quest is done (decision 0130), by quest id: each field given takes
   * the place of the port's own (e.g. `levelProduces` with its specialty a level earlier).
   */
  afterQuest?: Record<string, PortTradeChange>;
}

/** The trade fields a quest can change in a port (decision 0130). */
export type PortTradeChange = Partial<
  Pick<
    PortDef,
    | 'produces'
    | 'wants'
    | 'levelProduces'
    | 'levelWants'
    | 'wantsMade'
    | 'levelWantsMade'
    | 'maxLevel'
  >
>;

/**
 * The kinds of sea mark (decisions 0130, 0131, 0152): channel buoys, a yellow practice buoy (0164),
 * cardinal danger marks (the safe water lies on the named side of the danger), boats, a light on
 * the chart.
 */
export const SEA_MARK_TYPES = [
  'buoy-red',
  'buoy-green',
  'buoy-yellow',
  'cardinal-north',
  'cardinal-east',
  'cardinal-south',
  'cardinal-west',
  'fishing-boat',
  'pilot-cutter',
  'light',
] as const;
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
  /** A charted mark's place name, written small beside it on the chart (decision 0152). */
  name?: string;
}

/**
 * A current (decision 0140): water that moves, painted in the map editor. A **lane** has a `path`
 * of control points `[x, y, width]` in flow order (the water runs from the first point to the
 * last), smoothed by `smoothPath` so the editor shows exactly what the game sails. An **area** has
 * a closed `outline` and the bearing it flows towards. The numbers every current shares (edge
 * fade, slowdown where a lane widens) live in `weather.json`, `currents`.
 */
export interface CurrentDef {
  id: string;
  /** Shown on the chart once charted. */
  name?: string;
  /** Speed in knots at the lane's narrowest point (an area's everywhere inside). */
  speedKn: number;
  /** Lane: control points `[x, y, width]` in flow order. */
  path?: [number, number, number][];
  /** Area: a closed outline… */
  outline?: [number, number][];
  /** …and the bearing the water flows towards, in degrees (0 = north, clockwise). */
  towardDeg?: number;
}

/**
 * A wind zone (decision 0140): an area painted in the editor where the wind behaves its way, on
 * top of the wandering wind. The `kind`'s numbers live in `weather.json`, `zones.kinds`; `tune`
 * overrides some of them for this zone only.
 */
export interface WindZoneDef {
  id: string;
  name?: string;
  /** A key of `weather.json` `zones.kinds`: `trade-belt`, `doldrums`, `stormy-coast`… */
  kind: string;
  /** Where the zone's wind blows from, degrees (like the map wind's `fromDeg`). */
  headingDeg?: number;
  outline: [number, number][];
  tune?: Record<string, number | [number, number] | boolean>;
}

export interface MapDef {
  name: string;
  /** Explicit compatible predecessor maps; never accept arbitrary other-map saves. */
  compatibleSaveMaps?: string[];
  seed: number;
  /** The round sea: a disc of this radius around (0, 0). */
  boundsRadius: number;
  /**
   * Open water joined to the round sea (decision 0202): the playable sea is the disc and these
   * outlines together, and the edge buoys follow its outer edge. Each sea file can bring its own.
   */
  edges?: SeaEdgeDef[];
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
  /** Currents: lanes and areas of moving water (decision 0140). */
  currents?: CurrentDef[];
  /** Wind zones on top of the wandering wind (decision 0140). */
  windZones?: WindZoneDef[];
  /** Fog of war (decision 0156): what starts uncharted, and its named areas. */
  fog?: FogDef;
  /** Other boats (decision 0214): fishing fleets, coasters and far-sea visitors. */
  traffic?: TrafficDef[];
}

/** The wind zones that go on the chart once sailed: the named ones (decision 0152). */
export const chartableZoneIds = (map: MapDef) =>
  (map.windZones ?? []).filter((z) => z.name).map((z) => z.id);
