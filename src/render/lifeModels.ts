import * as THREE from 'three';
import { mergeAll } from './models/geometry';
import { buildProp } from './models/propRecipe';

/*
 * The sea life's shared drawing pieces (issue #476): models from their prop recipes, a clock the
 * shaders share, and the two materials that move vertices on the graphics card (wings that beat,
 * fish that swirl), so nothing is rebuilt or allocated per frame.
 */

const RECIPE_ARGS = { R: 1, style: 'fish', variant: 0, shape: 0.5, size: 1 };

/** A sea-life model from its recipe in `src/data/props/` (vertex colours, nose to -z). */
export function lifeModel(recipe: string): THREE.BufferGeometry {
  return mergeAll(buildProp(recipe, RECIPE_ARGS));
}

/**
 * A shoal's model: each part (a fish) carries its own middle as `aFish` (x, z), so the swirl
 * turns every fish whole round the shoal's middle instead of tearing it apart.
 */
export function shoalModel(recipe: string): THREE.BufferGeometry {
  const fish = buildProp(recipe, RECIPE_ARGS);
  const middle = new THREE.Vector3();
  for (const part of fish) {
    part.computeBoundingBox();
    part.boundingBox!.getCenter(middle);
    const n = part.attributes.position!.count;
    const at = new Float32Array(n * 2);
    for (let k = 0; k < n; k++) at.set([middle.x, middle.z], k * 2);
    part.setAttribute('aFish', new THREE.BufferAttribute(at, 2));
  }
  return mergeAll(fish);
}

/** A shoal's half width and half depth at size 1, model units: it fades out towards them. */
const SHOAL_RIM = ['2.2', '1.5'];

/** Seconds, shared by every sea-life shader. */
export const lifeClock = { value: 0 };

/** A model's vertices this far or less from its middle line are the body; past it, the wings. */
const BODY_HALF_WIDTH = 0.15;
/** How far a wing tip one unit out lifts and dips at full beat. */
const BEAT = 0.7;

/**
 * Lit, flat-shaded birds whose wings beat in the vertex shader: each instance's `aFlap` is its
 * phase, wing beats a second and glide share. Vertices lift by how far out from the body they
 * lie, so any bird recipe flaps.
 */
export function flappingMaterial(): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLifeTime = lifeClock;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uLifeTime;
attribute vec3 aFlap;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
  float wing = max(0.0, abs(transformed.x) - ${BODY_HALF_WIDTH.toFixed(2)});
  float beat = sin(uLifeTime * aFlap.y * 6.2832 + aFlap.x);
  float drift = 0.5 + 0.5 * sin(uLifeTime * 0.37 + aFlap.x * 1.7);
  float flapping = 1.0 - 0.85 * smoothstep(1.0 - aFlap.z - 0.12, 1.0 - aFlap.z + 0.12, drift);
  transformed.y += beat * wing * ${BEAT.toFixed(2)} * flapping;
}`,
      );
  };
  material.customProgramCacheKey = () => 'sea-life-flap';
  return material;
}

/**
 * Dark fish under the surface, see-through, turning slowly round each shoal's middle (inner fish
 * faster, each whole: `shoalModel`); `aPhase` sets each shoal apart. The shoal fades out towards
 * its rim, a soft shadow in the water. Unlit: not a lit thing.
 */
export function swirlingMaterial(
  color: THREE.ColorRepresentation,
  opacity: number,
  swirl: number,
): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLifeTime = lifeClock;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uLifeTime;
attribute float aPhase;
attribute vec2 aFish;
varying float vRim;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
  vRim = length(transformed.xz / vec2(${SHOAL_RIM.join(', ')}));
  float a = uLifeTime * ${swirl.toFixed(3)} / (0.6 + 0.4 * length(aFish)) + aPhase;
  float c = cos(a), s = sin(a);
  transformed.xz = mat2(c, s, -s, c) * transformed.xz;
}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vRim;')
      .replace(
        '#include <alphamap_fragment>',
        '#include <alphamap_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(0.45, 1.0, vRim);',
      );
  };
  material.customProgramCacheKey = () => `sea-life-swirl-${swirl}`;
  return material;
}
