import * as THREE from 'three';
import TRAFFIC_BOATS from '../data/traffic-boats.json';
import { TUNING } from '../data/tuning';
import { HULL_SCALE } from '../sim/hullShape';
import type { TrafficKind } from '../sim/traffic';
import { mergeAll, vertexColorMaterial } from './models/geometry';
import { buildProp } from './models/propRecipe';
import type { WakeHull } from './wake';

/** A drawn kind in one home style and colour: one instanced hull, one instanced mesh per sail. */
export interface Batch {
  hulls: THREE.InstancedMesh;
  sails: THREE.InstancedMesh[];
  /** Where each sail's luff meets the boom, in model units, bow toward −Z. */
  pivots: THREE.Vector3[];
  /** Model units to scene units. */
  scale: number;
  /** Stern lantern and masthead light, in model units. */
  lights: THREE.Vector3[];
  /** The drawn hull's length and beam in scene units, for her bow waves. */
  wake: WakeHull;
  count: number;
}

const UP = new THREE.Vector3(0, 1, 0);

/** The hull and sail materials every batch shares. */
export function trafficMaterials() {
  return {
    hull: vertexColorMaterial(),
    sail: new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      flatShading: true,
      emissive: '#ffffff',
      emissiveIntensity: 0.25,
    }),
  };
}

/** A good's deck cargo in the coaster recipe; 0 is the empty deck under a tarp. */
export function cargoOf(good: string | undefined): number {
  if (!good) return 0;
  return (TRAFFIC_BOATS.cargo as Record<string, number>)[good] ?? TRAFFIC_BOATS.otherCargo;
}

/**
 * One kind's instanced meshes in one home look (style, band variant, deck cargo): a hull mesh
 * and one mesh per sail, room for `most` boats.
 */
export function trafficBatch(
  recipe: string,
  kindId: TrafficKind,
  look: { style: string; variant: number; cargo: number },
  materials: ReturnType<typeof trafficMaterials>,
  most: number,
): Batch {
  const parts = buildProp(recipe, {
    R: 1,
    style: look.style,
    variant: look.variant,
    shape: 0.5,
    size: 1,
    vars: { cargo: look.cargo },
  });
  const turn = (g: THREE.BufferGeometry) => g.rotateY(Math.PI);
  const pivots: THREE.Vector3[] = [];
  const sails: THREE.InstancedMesh[] = [];
  const hull: THREE.BufferGeometry[] = [];
  for (const g of parts) {
    const at = g.userData.sail as [number, number, number] | undefined;
    if (!at) {
      hull.push(turn(g));
      continue;
    }
    // Bow toward −Z like the ship models: the recipe's +Z turned round.
    pivots.push(new THREE.Vector3(-at[0], at[1], -at[2]));
    const sail = new THREE.InstancedMesh(turn(g), materials.sail, most);
    sail.count = 0;
    sail.frustumCulled = false;
    sails.push(sail);
  }
  const geometry = mergeAll(hull);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const hulls = new THREE.InstancedMesh(geometry, materials.hull, most);
  hulls.count = 0;
  hulls.frustumCulled = false;
  hulls.castShadow = true;
  const kind = TUNING.seamanship.traffic.kinds[kindId]!;
  const top = Math.max(box.max.y, ...pivots.map((p) => p.y));
  const batch: Batch = {
    hulls,
    sails,
    pivots,
    scale: HULL_SCALE * kind.scale,
    wake: {
      length: (box.max.z - box.min.z) * HULL_SCALE * kind.scale,
      beam: (box.max.x - box.min.x) * HULL_SCALE * kind.scale,
    },
    // A fishing boat shows one stern lamp; a coaster a stern lamp and a masthead pin.
    lights:
      kindId === 'fishing'
        ? [new THREE.Vector3(0, box.max.y * 0.9, box.max.z * 0.9)]
        : [new THREE.Vector3(0, box.max.y * 0.9, box.max.z * 0.9), new THREE.Vector3(0, top, 0)],
    count: 0,
  };
  // The masthead light over the tallest mast, at its foot's distance from the bow.
  const mast = pivots.reduce((a, p) => (p.y > a.y ? p : a), pivots[0] ?? UP);
  if (batch.lights[1]) batch.lights[1].z = mast.z;
  return batch;
}
