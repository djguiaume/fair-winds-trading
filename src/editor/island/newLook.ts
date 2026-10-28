import type * as THREE from 'three';
import type { IslandDesign } from '../../data/islands';
import { designHeightfield } from '../../sim/heightfield';
import { ISLAND_SCALE } from '../../sim/islandUnits';
import type { IslandDef } from '../../sim/map';
import { designPalette, fieldGround } from '../../render/models/fieldGround';
import { type Stand, fieldStand } from '../../render/models/townProps';
import { type TerrainLook, terrainLook } from '../../render/terrainLook';

/** `editor.html?look=v2`: the island builder draws the new look's ground, like the game. */
export const builderLook: TerrainLook =
  typeof location === 'undefined' ? 'v1' : terrainLook(location.search);

/** The island the builder shows: the file at the origin, harbour toward +z, as the game sees it. */
export function previewIsland(design: IslandDesign, R: number, harbour: boolean): IslandDef {
  return {
    id: design.id,
    x: 0,
    y: 0,
    radius: R * ISLAND_SCALE,
    look: { design: design.id, harbourBearing: Math.PI, dock: harbour },
  };
}

/**
 * The new look's ground of an island file in the builder's units (reference units round the
 * origin), from the game's own height field and mesh, and the stand its props take on it.
 */
export function newLookGround(
  design: IslandDesign,
  R: number,
  level: number,
  harbour: boolean,
): { stand: Stand; ground: THREE.BufferGeometry } {
  const island = previewIsland(design, R, harbour);
  const field = designHeightfield(island, design, level);
  const ground = fieldGround(field, designPalette(design.style));
  ground.scale(1 / ISLAND_SCALE, 1 / ISLAND_SCALE, 1 / ISLAND_SCALE);
  return { stand: fieldStand(island, field), ground };
}
