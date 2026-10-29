import type { IslandDesign } from '../../data/islands';
import { pierAt } from '../../sim/collision';
import { type ForestClearings, type ForestTree, filePoint, plantForest } from '../../sim/forest';
import { type Heightfield, designHeightfield } from '../../sim/heightfield';
import { islandBearing } from '../../sim/islandLayout';
import { ISLAND_SCALE } from '../../sim/islandUnits';
import type { IslandDef } from '../../sim/map';
import { harbourShot } from '../harbourView';
import { fieldStand } from './townProps';
import type { TownLevel } from './towns';
import { designedTownParts } from './towns';

/** Where the harbour screen's camera stands (decision 0211): file point and height (world). */
export function forestCamera(island: IslandDef, design: IslandDesign): [number, number, number] {
  const pier = pierAt(island, islandBearing(island));
  const shot = harbourShot(island, { x: pier.x1, y: pier.y1 }, design.harbourView);
  return [...filePoint(island, shot.from.x, shot.from.y), shot.fromHeight];
}

/** The clearings a town notes as the game builds it: none yet, the harbour camera's place. */
export const emptyClearings = (
  island: IslandDef,
  design: IslandDesign,
  harbour: boolean,
): ForestClearings => ({
  circles: [],
  homes: [],
  lanes: [],
  camera: harbour ? forestCamera(island, design) : undefined,
});

/**
 * An island file's forest at a level, its town built on the new ground to note what it keeps
 * clear, as the game does: for `npm run island -- --forest` and the tests.
 */
export function designForest(
  island: IslandDef,
  design: IslandDesign,
  level: TownLevel,
  harbour: boolean,
  field: Heightfield = designHeightfield(island, design, level),
): ForestTree[] {
  const clearings = emptyClearings(island, design, harbour);
  const R = island.radius / ISLAND_SCALE;
  const town = designedTownParts(design, R, level, harbour, fieldStand(island, field), clearings);
  for (const g of town) g.dispose();
  return plantForest({ island, design, field, level, clearings });
}
