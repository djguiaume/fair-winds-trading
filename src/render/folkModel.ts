import * as THREE from 'three';
import { lifeClock } from './lifeModels';
import { mergeAll } from './models/geometry';
import { buildProp } from './models/propRecipe';

/*
 * The town folk's drawing pieces (issue #477): one person model from its prop recipe, and the
 * material that walks it on the graphics card, so sixty people cost one draw call and no
 * per-frame work on the CPU beyond their places.
 */

const RECIPE_ARGS = { R: 1, style: 'fish', variant: 0, shape: 0.5, size: 1 };

/** The model's hip and shoulder heights and its height, reference units (the recipe's). */
const HIP = 0.28;
const SHOULDER = 0.54;
const HEIGHT = 0.74;
/** How far a foot swings forward at full stride, as a share of the leg's length. */
const SWING = 0.9;

/** A person's gait, each instance's `aWalk.z`. */
export const GAIT = { stand: 0, walk: 1, fish: 2, carry: 3 } as const;
export type Gait = (typeof GAIT)[keyof typeof GAIT];

/**
 * A person from a recipe whose parts are tagged `coat` (tinted per instance), `arm`, `rod` (a
 * fisherman's) and `load` (a worker's): each vertex carries those as `aFolk`, so one model
 * draws every kind of person.
 */
export function folkModel(recipe: string): THREE.BufferGeometry {
  const parts = buildProp(recipe, RECIPE_ARGS);
  for (const part of parts) {
    const tags = part.userData as Record<string, boolean | undefined>;
    const flags = [tags.coat, tags.rod, tags.load, tags.arm].map((on) => (on ? 1 : 0));
    const n = part.attributes.position!.count;
    const data = new Float32Array(n * 4);
    for (let k = 0; k < n; k++) data.set(flags, k * 4);
    part.setAttribute('aFolk', new THREE.BufferAttribute(data, 4));
  }
  return mergeAll(parts);
}

/**
 * Lit, flat-shaded people whose legs and arms swing in the vertex shader: each instance's
 * `aWalk` is its phase, steps a second and gait. A rod shows only in a fisherman's hand and a
 * load only on a worker's way out; the coat takes the instance's colour.
 */
export function walkingMaterial(): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLifeTime = lifeClock;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uLifeTime;
attribute vec3 aWalk;
attribute vec4 aFolk;`,
      )
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
vColor.rgb = mix(vec3(color), instanceColor.xyz, aFolk.x);`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
  float t = uLifeTime * aWalk.y * 6.2832 + aWalk.x;
  float walking = (aWalk.z == ${GAIT.walk}.0 || aWalk.z == ${GAIT.carry}.0) ? 1.0 : 0.0;
  float carrying = aWalk.z == ${GAIT.carry}.0 ? 1.0 : 0.0;
  float fishing = aWalk.z == ${GAIT.fish}.0 ? 1.0 : 0.0;
  transformed *= mix(1.0, fishing, aFolk.y) * mix(1.0, carrying, aFolk.z);
  float side = sign(transformed.x);
  float leg = (1.0 - aFolk.y) * (1.0 - aFolk.z) * (1.0 - aFolk.w) * step(transformed.y, ${HIP});
  float swing = sin(t) * walking * ${SWING};
  transformed.z += swing * side * (${HIP} - transformed.y) * leg;
  float arm = aFolk.w * (1.0 - carrying);
  transformed.z -= swing * side * (${SHOULDER} - transformed.y) * arm;
  float held = aFolk.w * carrying;
  transformed.z += (${SHOULDER} - transformed.y) * 0.9 * held;
  transformed.y += (${SHOULDER} - transformed.y) * 0.45 * held;
  transformed.y += abs(sin(t)) * 0.02 * walking * (1.0 - leg);
  transformed.z += sin(t) * 0.025 * (1.0 - walking) * transformed.y / ${HEIGHT};
}`,
      );
  };
  material.customProgramCacheKey = () => 'town-folk-walk';
  return material;
}
