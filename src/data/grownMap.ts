import type { ChartAreaDef } from '../sim/fog';
import type { MapDef } from '../sim/map';
import type { Sectors } from '../sim/seaSectors';
import grown from './seas/grown.json';

/**
 * Local storage prefix of the voyages sailed at `?map=phase4` while the grown sea was a dev sea
 * (decision 0152). The address still opens them (decision 0198).
 */
export const PHASE4_PREFIX = 'fwt.phase4.';

/** The name the grown sea's dev voyages were saved under (decision 0152): they still load. */
const DEV_SEA_NAME = (ring: string) => `${ring} (Phase 4 sea)`;

/**
 * The radius the sea grows to in Phase 4, from `seas/grown.json`: five times today's area
 * (decisions 0115, 0137).
 */
export const GROWN_SEA_RADIUS = grown.boundsRadius;

/** Each sea's slice of the outer ring, compass bearings `[from, to]` (decision 0179). */
export const SEA_SECTORS = grown.sectors as unknown as Sectors;

/**
 * One of the Phase 4 seas (decision 0137): the islands, shapes, ports, buoys and wind zones a
 * biome adds around the Windward Ring, kept in its own file in `src/data/seas/`.
 */
export type SeaDef = Pick<MapDef, 'islands' | 'ports' | 'course'> &
  Partial<Pick<MapDef, 'terrain' | 'marks' | 'currents' | 'windZones' | 'edges' | 'traffic'>> & {
    id: string;
    name: string;
    /** The sea's named areas, each charted at once when sailed into (decision 0156). */
    chartAreas?: ChartAreaDef[];
  };

/** Every sea file in `src/data/seas/` but `grown.json`, by file name (decision 0161). */
export const SEA_FILES: Record<string, SeaDef> = Object.fromEntries(
  Object.entries(
    import.meta.glob<SeaDef>(['./seas/*.json', '!./seas/grown.json'], {
      eager: true,
      import: 'default',
    }),
  ).map(([path, sea]) => [path.slice('./seas/'.length, -'.json'.length), sea]),
);

/**
 * The seas laid out so far, in the order they open (decision 0147): the south first. The order is
 * `seas` in `grown.json`, so a new sea is a data file and one line there (decision 0161).
 */
export const SEAS: SeaDef[] = grown.seas.map((id) => {
  const sea = SEA_FILES[id];
  if (!sea) throw new Error(`grown.json lists sea "${id}" but seas/${id}.json is missing`);
  return sea;
});

/**
 * The grown sea (decisions 0152, 0198): today's Windward Ring unchanged in the middle, the sea
 * grown to its Phase 4 radius and each sea file added round it. The game's own sea since 0198.
 * It keeps the ring's name, so a ring voyage resumes where it was with every port and quest
 * (the new waters start fogged), and the grown sea's dev voyages still load.
 */
export function grownMap(source: MapDef, seas: readonly SeaDef[] = SEAS): MapDef {
  const map = structuredClone(source);
  map.compatibleSaveMaps = [...(source.compatibleSaveMaps ?? []), DEV_SEA_NAME(source.name)];
  map.boundsRadius = GROWN_SEA_RADIUS;
  // The new waters start uncharted; the ring stays charted (decisions 0137, 0156).
  map.fog = { chartedRadius: grown.chartedRadius, areas: [] };
  for (const sea of seas) {
    const add = structuredClone(sea);
    map.islands.push(...add.islands);
    map.ports.push(...add.ports);
    map.course.push(...add.course);
    (map.terrain ??= []).push(...(add.terrain ?? []));
    (map.marks ??= []).push(...(add.marks ?? []));
    (map.currents ??= []).push(...(add.currents ?? []));
    (map.windZones ??= []).push(...(add.windZones ?? []));
    (map.traffic ??= []).push(...(add.traffic ?? []));
    map.fog.areas.push(...(add.chartAreas ?? []));
    // A section sticking out of the round sea moves its edge (decision 0202).
    if (add.edges?.length) (map.edges ??= []).push(...add.edges);
  }
  return map;
}
