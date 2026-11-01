import * as THREE from 'three';
import { BOAT_LOOK } from './boatLook';

/**
 * The sails' material: vertex colours plus a flat white glow, so canvas reads pale in any light
 * (`boat-look.json` › `sails.glow`; damage colours are written for it, 0208), scaled per vertex
 * by the cloth's `glow` attribute (1 on canvas). The upgrade bands (decision 0259) glow less, so their class colour is
 * not washed to grey, day or night. One shader edit, no extra material or draw call.
 */
export function sailCanvasMaterial() {
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    flatShading: true,
    emissive: '#ffffff',
    emissiveIntensity: BOAT_LOOK.sails.glow,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float glow;\nvarying float vGlow;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace(
        'vec3 totalEmissiveRadiance = emissive;',
        'vec3 totalEmissiveRadiance = emissive * vGlow;',
      );
  };
  material.customProgramCacheKey = () => 'sail-canvas-glow';
  return material;
}
