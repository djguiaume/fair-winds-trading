import type * as THREE from 'three';
import type { IslandDesign } from '../../data/islands';
import { designHeightfield } from '../../sim/heightfield';
import { ISLAND_SCALE } from '../../sim/islandUnits';
import type { IslandDef } from '../../sim/map';
import { designPalette, fieldGround, fieldGroundTextures } from '../../render/models/fieldGround';
import { fieldGroundMaterial } from '../../render/models/fieldGroundShader';
import { type Stand, fieldStand } from '../../render/models/townProps';
import { type TerrainLook, terrainLook } from '../../render/terrainLook';

/** The new look's ground as the builder's views draw it (each view its own mesh). */
export interface NewLookGround {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshLambertMaterial;
}

/** The island builder draws the new look's ground like the game; `editor.html?look=v1` the classic one. */
export const builderLook: TerrainLook = terrainLook(
  typeof location === 'undefined' ? '' : location.search,
);

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
): { stand: Stand; ground: NewLookGround } {
  const island = previewIsland(design, R, harbour);
  const field = designHeightfield(island, design, level);
  const geometry = fieldGround(field);
  geometry.scale(1 / ISLAND_SCALE, 1 / ISLAND_SCALE, 1 / ISLAND_SCALE);
  // The game's material at High, told the mesh is scaled down so its bands and noises match.
  const textures = fieldGroundTextures(field, designPalette(design.style));
  const material = fieldGroundMaterial(textures, 'high', ISLAND_SCALE);
  return { stand: fieldStand(island, field), ground: { geometry, material } };
}
