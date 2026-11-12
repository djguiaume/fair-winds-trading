import * as THREE from 'three';
import { atLevel, designOf } from '../../data/islands';
import { PROP_RECIPES } from '../../data/props';
import { islandLayout, islandPoint } from '../../sim/islandLayout';
import { ISLAND_SCALE } from '../../sim/islandUnits';
import type { IslandDef } from '../../sim/map';
import type { Parts } from './props';
import { type Stand, standHeight } from './townProps';
import type { TownLevel } from './towns';
import type { Crater } from './types';

/** Where each crater's pool of an island's parts sits in the scene, for the smoke (0178). */
export function partCraters(islandId: string, parts: Parts): Crater[] {
  const craters: Crater[] = [];
  const box = new THREE.Box3();
  for (const g of parts) {
    if (!g.userData.crater) continue;
    g.computeBoundingBox();
    box.copy(g.boundingBox!);
    craters.push({
      island: islandId,
      x: (box.min.x + box.max.x) / 2,
      y: box.max.y,
      z: (box.min.z + box.max.z) / 2,
      r: Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2,
      slope: (g.userData.crater as { slope: number }).slope,
    });
  }
  return craters;
}

/** The steam vent props of an island's file at its town level (decision 0181): small plumes. */
export function islandVents(island: IslandDef, level: TownLevel, stand?: Stand): Crater[] {
  const design = designOf(island);
  const R = island.radius / ISLAND_SCALE;
  const vents: Crater[] = [];
  for (const prop of design?.props ?? []) {
    const vent = PROP_RECIPES[prop.type]?.vent;
    if (!vent || !atLevel(prop, level)) continue;
    const p = islandPoint(island, prop.x, prop.z);
    const ground =
      prop.y !== undefined
        ? prop.y * R
        : (stand?.(prop.x, prop.z) ?? standHeight(islandLayout(design!, level), prop.x, prop.z, R));
    const size = prop.size ?? 1;
    vents.push({
      island: island.id,
      x: p.x,
      y: (ground + vent.y * size) * ISLAND_SCALE,
      z: -p.y,
      r: 0.4 * size,
      slope: 0,
      vent: true,
    });
  }
  return vents;
}
