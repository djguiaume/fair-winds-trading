import type * as THREE from 'three';
import type { LandmarkKind } from '../../sim/map';
import { buildProp } from './propRecipe';

type Parts = THREE.BufferGeometry[];

/**
 * Small recognisable silhouettes, built from the same matte low-poly palette as B2 islands. Each
 * is a prop recipe (`src/data/props/<kind>.json`, decision 0135) that takes its size itself.
 */
export function landmarkParts(kind: LandmarkKind, scale = 1, variant = 0): Parts {
  return buildProp(kind, { R: 1, style: 'fish', variant, shape: 0.5, size: scale });
}
