import * as THREE from 'three';
import type { IslandDef } from '../sim/map';
import { islandLayout, islandPoint } from '../sim/islandLayout';
import { designOf, type PropDef } from '../data/islands';
import { PROP_RECIPES } from '../data/props';
import { ISLAND_SCALE } from '../sim/islandUnits';
import { fieldStand, standHeight } from './models/townProps';
import { islandHeightfield } from '../sim/heightfield';
import type { TerrainLook } from './terrainLook';

/** Height of each landmark's lamp above the model's foot, at size 1 (see landmarks.ts). */
const LAMP_Y = { lighthouse: 4.8, beacon: 5.15 } as const;

export interface LandmarkLamp {
  /** Scene position of the lamp. */
  position: THREE.Vector3;
  island: IslandDef;
  prop: PropDef;
}

/** Every lighthouse or beacon placed in the island files, with its lamp's scene position. */
export function landmarkLamps(
  islands: readonly IslandDef[],
  type: keyof typeof LAMP_Y,
  /** Under the new look (decision 0222) props stand on the shared height field. */
  look: TerrainLook = 'v1',
): LandmarkLamp[] {
  const out: LandmarkLamp[] = [];
  for (const island of islands) {
    const design = designOf(island);
    if (!design) continue;
    const R = island.radius / ISLAND_SCALE;
    for (const prop of design.props) {
      // Any prop whose recipe has a lamp shines with the beacons (decision 0170).
      const lamp = type === 'beacon' ? PROP_RECIPES[prop.type]?.lamp : undefined;
      if (prop.type !== type && !lamp) continue;
      const p = islandPoint(island, prop.x, prop.z),
        level = prop.from ?? 1,
        stand =
          look === 'v2'
            ? fieldStand(island, islandHeightfield(island, level))
            : (x: number, z: number) => standHeight(islandLayout(design, level), x, z, R),
        ground = prop.y !== undefined ? prop.y * R : stand(prop.x, prop.z),
        y = (ground + (lamp?.y ?? LAMP_Y[type]) * (prop.size ?? 1)) * ISLAND_SCALE;
      out.push({ position: new THREE.Vector3(p.x, y, -p.y), island, prop });
    }
  }
  return out;
}
