// `npm run island -- <id> bake-coast` (decision 0255): the island builder's "Bake coast" button.
// The bake itself is src/sim/coastBake.ts; this only runs it and the map checks it can break.
import { GAME_MAP } from '../../src/data/maps';
import type { IslandDesign } from '../../src/data/islands';
import { islandCheckKit } from '../../src/render/models/towns';
import { bakeSummary } from '../../src/sim/coastBake';
import { bakeIsland } from '../../src/sim/coastBakeMap';

export const BAKE_HELP = `bake-coast (decision 0255): trace the sculpted ground's coast (its height-zero line) and write it as the
  island file's coast outline, so boats, berths and the chart follow what was sculpted. The sculpt edits stay.
  Refused, nothing written: edits that do not replay, land that runs off the ground, an outline that parts from
  the ground, a new island check error, or a berths / harbour-water map check broken. Ponds and tiny islets are
  left out and reported; piers whose tip moved off the shore are reported. Undo: the file history (git).
  Limits: terrain.json › coast › bake. Check the result with: npm run chart -- --coast`;

/** Bakes the coast into the design (its `coasts` are replaced) and says what was done. */
export function bakeFile(design: IslandDesign, R: number, harbour: boolean): string[] {
  const result = bakeIsland(design, islandCheckKit(design, R, harbour), GAME_MAP);
  design.coasts = result.coasts;
  return bakeSummary(result);
}
