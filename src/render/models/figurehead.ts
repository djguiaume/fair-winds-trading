import type * as THREE from 'three';
import { PROP_RECIPES } from '../../data/props';
import type { FigureheadMount } from '../../data/ships';
import type { BoatLook } from './boatLook';
import { buildProp } from './propRecipe';

/**
 * A figurehead (docs/v1.4/customisation.md): its prop recipe (decision 0135, front toward +Z,
 * hanging from its origin) scaled to the class's mount and set at the stem head, `drop` below
 * the deck at `stem`. Merged into the hull mesh by the caller, so it heaves, pitches, rolls and
 * heels with her for no extra draw call. No mount, no figurehead or an unknown recipe: nothing.
 */
export function figureheadParts(
  figurehead: BoatLook['figurehead'],
  mount: FigureheadMount | undefined,
  stem: THREE.Vector3,
): THREE.BufferGeometry[] {
  if (!figurehead || !mount || !PROP_RECIPES[figurehead.recipe]) return [];
  const k = mount.size * figurehead.size;
  const parts = buildProp(figurehead.recipe, {
    R: 1,
    style: 'timber',
    variant: 0,
    shape: 0,
    size: 1,
  });
  for (const g of parts) g.scale(k, k, k).translate(stem.x, stem.y - mount.drop, stem.z);
  return parts;
}
