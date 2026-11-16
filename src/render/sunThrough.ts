import type * as THREE from 'three';
import { TUNING } from '../data/tuning';

/**
 * Sunlight through the sails (issue #550): canvas looked at against the sun glows with its light,
 * warm at the golden hour, a rim of light round the boat's shape. One edit of the sails' Lambert
 * shader, no extra pass; the strength is shared and 0 below High (`graphics.json` › `sunlight`).
 */

const SUN_THROUGH = { value: { x: 0, y: 1 } as { x: number; y: number } };

/** Adds the glow to a Lambert shader, inside a material's `onBeforeCompile`. */
export function addSunThrough(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.uniforms.uSunThrough = SUN_THROUGH;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform vec2 uSunThrough;')
    .replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
  // Looking toward the light through the cloth: it glows with the light's colour.
  float through = pow(max(dot(normalize(-vViewPosition), directionalLights[0].direction), 0.0), uSunThrough.y);
  reflectedLight.directDiffuse += diffuseColor.rgb * directionalLights[0].color * (uSunThrough.x * through);
#endif`,
    );
}

/** A plain sail material with the glow. */
export function withSunThrough<M extends THREE.MeshLambertMaterial>(material: M, key: string): M {
  material.onBeforeCompile = addSunThrough;
  material.customProgramCacheKey = () => key;
  return material;
}

/** This frame's glow: the data's on the levels that draw shadows, else none. */
export function setSunThrough(on: boolean) {
  const s = TUNING.graphics.sunlight;
  SUN_THROUGH.value.x = on ? s.sailThrough : 0;
  SUN_THROUGH.value.y = s.sailFocus;
}
