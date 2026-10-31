import { ISLAND_DESIGNS, type IslandDesign } from '../data/islands';
import { BakeError, bakeCoast, type BakeResult } from './coastBake';
import type { IslandCheckKit } from './islandChecks';
import { coastMapChecks } from './mapCoast';
import { berthChecks } from './mapChecks';
import type { MapDef } from './map';

/**
 * The map checks that a baked coast can break (issue #352): `berths` (every port still docks only
 * at its harbour) and `harbour-water` (no ground drawn in dock water), for the ports of the
 * island the design is on, with the design in place of its file. Empty when it is fine, or when
 * the island is on no port of the map.
 */
export function bakeMapProblems(map: MapDef, design: IslandDesign): string[] {
  const islands = map.islands.filter((i) => i.look?.design === design.id).map((i) => i.id);
  const ports = map.ports.filter((p) => islands.includes(p.islandId));
  if (!ports.length) return [];
  const own = ISLAND_DESIGNS[design.id];
  ISLAND_DESIGNS[design.id] = design;
  try {
    const only = { ...map, ports };
    return [...berthChecks(only), ...coastMapChecks(only)]
      .filter((c) => !c.ok && c.severity === 'error')
      .map((c) => c.message);
  } finally {
    if (own) ISLAND_DESIGNS[design.id] = own;
  }
}

/**
 * The bake the island builder and `npm run island -- <id> bake-coast` share: the island with the
 * coast of its sculpted ground, refused (with the reason) when a map check it can break fails.
 */
export function bakeIsland(
  design: IslandDesign,
  kit: IslandCheckKit,
  map: MapDef,
): BakeResult & { design: IslandDesign } {
  const result = bakeCoast(design, kit);
  const problems = bakeMapProblems(map, result.design);
  if (problems.length) throw new BakeError(`the map checks fail: ${problems.join('; ')}`);
  return result;
}
