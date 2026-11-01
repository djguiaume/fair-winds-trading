import * as THREE from 'three';
import { PROP_RECIPES } from '../../data/props';
import type { FigureheadMount } from '../../data/ships';
import type { BoatLook } from './boatLook';
import { buildProp } from './propRecipe';

/**
 * A figurehead (docs/v1.4/customisation.md): its prop recipe (decision 0135, seated at its
 * origin, leaning forward toward +Z and up) scaled so its longest reach seen from the side is
 * the mount's `size` times the item's, then set at the stem head, `drop` below the deck at
 * `stem`. Every carving thus reads the same at the bow whatever its recipe's units. Merged into
 * the hull mesh by the caller, so it heaves, pitches, rolls and heels with her for no extra draw
 * call. No mount, no figurehead or an unknown recipe: nothing.
 */
export function figureheadParts(
  figurehead: BoatLook['figurehead'],
  mount: FigureheadMount | undefined,
  stem: THREE.Vector3,
): THREE.BufferGeometry[] {
  if (!figurehead || !mount || !PROP_RECIPES[figurehead.recipe]) return [];
  const parts = buildProp(figurehead.recipe, {
    R: 1,
    style: 'timber',
    variant: 0,
    shape: 0,
    size: 1,
  });
  const reach = sideReach(parts);
  if (!(reach > 0)) return [];
  const k = (mount.size * figurehead.size) / reach;
  for (const g of parts) g.scale(k, k, k).translate(stem.x, stem.y - mount.drop, stem.z);
  return parts;
}

/** The longest of a set of parts' height and length (y and z), as seen from the side. */
function sideReach(parts: THREE.BufferGeometry[]) {
  const box = new THREE.Box3();
  for (const g of parts) {
    g.computeBoundingBox();
    box.union(g.boundingBox!);
  }
  const size = box.getSize(new THREE.Vector3());
  return Math.max(size.y, size.z);
}
