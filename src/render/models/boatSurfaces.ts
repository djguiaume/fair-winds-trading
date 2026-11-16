import type * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TUNING } from '../../data/tuning';
import { chainCompile } from '../materialChain';
import { SMOOTH_HULLS, withSurface, withSurfaceDetail } from '../surfaceDetail';
import { vertexColorMaterial } from './geometry';
import { sailCanvasMaterial } from './sailCanvas';

/**
 * The boats' soft look up close (issue #572): planked hulls and decks, and a hull shaded round
 * between its strakes instead of in flat facets on the levels with `softEdges`. Sharp edges (the
 * rail, the keel, the transom) stay crisp: only faces closer than `surface.hullCreaseDeg` blend.
 * Every other part of the boat keeps its flat face normals, so it looks as before.
 */

/** The boats' wood: smooth hulls where the level allows them, patterns near the camera. */
export function boatWoodMaterial() {
  const material = vertexColorMaterial();
  material.flatShading = false;
  chainCompile(material, 'smoothHull', (shader) => {
    shader.uniforms.uSmoothHulls = SMOOTH_HULLS;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSmoothHulls;')
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
  // Flat facets, as the plain levels draw every boat.
  if (uSmoothHulls < 0.5) {
    normal = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
    nonPerturbedNormal = normal;
  }`,
      );
  });
  return withSurfaceDetail(material);
}

/** The sails' canvas with its cross-cut seams near the camera. */
export const boatSailMaterial = () => withSurfaceDetail(sailCanvasMaterial(), 'canvas');

/** A built hull, planked, its normals smoothed across its gentle bends. */
export function plankedHull(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const crease = (TUNING.graphics.surface.hullCreaseDeg * Math.PI) / 180;
  // Smoothed in place when the hull is already unindexed (it is), else a new copy.
  const hull = toCreasedNormals(geometry, crease);
  if (hull !== geometry) geometry.dispose();
  return withSurface(hull, 'planks');
}
