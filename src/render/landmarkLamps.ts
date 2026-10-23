import * as THREE from 'three';
import type { IslandDef } from '../sim/map';
import { islandLayout, islandPoint } from '../sim/islandLayout';
import { designOf, type PropDef } from '../data/islands';
import { ISLAND_SCALE } from './models/highlandIslands';
import { standHeight } from './models/towns';

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
): LandmarkLamp[] {
  const out: LandmarkLamp[] = [];
  for (const island of islands) {
    const design = designOf(island);
    if (!design) continue;
    const R = island.radius / ISLAND_SCALE;
    for (const prop of design.props) {
      if (prop.type !== type) continue;
      const p = islandPoint(island, prop.x, prop.z),
        layout = islandLayout(design, prop.from ?? 1),
        ground = prop.y !== undefined ? prop.y * R : standHeight(layout, prop.x, prop.z, R),
        y = (ground + LAMP_Y[type] * (prop.size ?? 1)) * ISLAND_SCALE;
      out.push({ position: new THREE.Vector3(p.x, y, -p.y), island, prop });
    }
  }
  return out;
}
