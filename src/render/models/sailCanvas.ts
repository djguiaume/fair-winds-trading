import * as THREE from 'three';
import { BOAT_LOOK } from './boatLook';

/**
 * The sails' material: vertex colours plus a flat white glow, so canvas reads pale in any light
 * (`boat-look.json` › `sails.glow`; damage colours are written for it, 0208), scaled per vertex
 * by the cloth's `glow` attribute (1 on canvas). The upgrade bands (decision 0259) glow less, so their class colour is
 * not washed to grey, day or night. One shader edit, no extra material or draw call.
 *
 * Painted marks (sailMarks.ts, `mark` ±1) are drawn `marks.lift` toward the camera, so the
 * curved cloth between their corners never covers them. Each copy is wound to face the side it
 * reads from and shows only from there. A sail filling to the other side is mirrored (a negative
 * scale), which swaps which face three.js calls front, so the test follows the model matrix's
 * handedness.
 */
export function sailCanvasMaterial() {
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    flatShading: true,
    emissive: '#ffffff',
    emissiveIntensity: BOAT_LOOK.sails.glow,
  });
  const lift = BOAT_LOOK.marks.lift.toFixed(4);
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float glow;\nattribute float mark;\nvarying float vGlow;\nvarying float vMark;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        // Each copy faces its reading side; mirrored, the front face is the other side's.
        vMark = abs(mark) * sign(determinant(mat3(modelMatrix)));
        if (mark != 0.0) {
          vec4 lifted = mvPosition;
          lifted.xyz -= normalize(lifted.xyz) * ${lift};
          gl_Position = projectionMatrix * lifted;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;\nvarying float vMark;')
      .replace(
        'void main() {',
        'void main() {\n  if (vMark > 0.5 != gl_FrontFacing && abs(vMark) > 0.5) discard;',
      )
      .replace(
        'vec3 totalEmissiveRadiance = emissive;',
        'vec3 totalEmissiveRadiance = emissive * vGlow;',
      );
  };
  material.customProgramCacheKey = () => 'sail-canvas-glow-marks';
  return material;
}
