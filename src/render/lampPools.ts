import * as THREE from 'three';
import { PALETTE } from '../data/props';
import { TUNING } from '../data/tuning';
import { WORLD_FROM_EYE, chainCompile } from './materialChain';

/**
 * Warm pools of lamplight at night (issue #547): the land, the fields and the sea round the lanterns
 * nearest the boat (her own stern lantern too) take the lamps' colour, fading over
 * `graphics.json` › `lamps.pool.radius`. One shared set of uniforms, written once a frame by the
 * lanterns; no lights, no extra pass, the same on every level. `?off=pools` turns it off.
 */

const COUNT = TUNING.graphics.lamps.pool.count;

const LAMP_POOLS = {
  /** xyz: a lantern, scene space; w: 1 lit, 0 unused. */
  uLampPools: { value: Array.from({ length: COUNT }, () => new THREE.Vector4()) },
  /** rgb: the lamps' colour times the pool's strength; w: the pool's radius. */
  uLampPoolLook: { value: new THREE.Vector4() },
  /** How much of the pool the water gives back. */
  uLampPoolSea: { value: 0 },
};

const lampColour = new THREE.Color(PALETTE.colors.lamp as string);
let switchedOn = true;
/** The chosen lanterns' indices and squared distances, kept between frames. */
const nearest = new Int32Array(COUNT);
const nearestD = new Float32Array(COUNT);

/** Top level: `lampPool`, the lamplight falling on a point of the scene. */
export const lampPoolFunctions = /* glsl */ `
#define LAMP_POOLS ${COUNT}
uniform vec4 uLampPools[LAMP_POOLS];
uniform vec4 uLampPoolLook;
vec3 lampPool(vec3 world) {
  if (uLampPoolLook.w <= 0.0) return vec3(0.0);
  float lit = 0.0;
  for (int i = 0; i < LAMP_POOLS; i++) {
    vec3 d = world - uLampPools[i].xyz;
    float k = max(1.0 - dot(d, d) / (uLampPoolLook.w * uLampPoolLook.w), 0.0);
    lit += uLampPools[i].w * k * k;
  }
  return uLampPoolLook.rgb * lit;
}
`;

/** The uniforms for a custom shader (the sea): the shared objects themselves. */
export const lampPoolUniforms = () => LAMP_POOLS;

/** A Lambert material lit by the pools; chains any `onBeforeCompile` it already has. */
export function withLampPools<M extends THREE.MeshLambertMaterial>(material: M): M {
  return chainCompile(material, 'lampPools', (shader) => {
    Object.assign(shader.uniforms, LAMP_POOLS);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${lampPoolFunctions}`)
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
  reflectedLight.indirectDiffuse += diffuseColor.rgb * lampPool(cameraPosition + ${WORLD_FROM_EYE});`,
      );
  });
}

/** Settings: the pools on or off (`?off=pools` in the device round). */
export function switchLampPools(on: boolean) {
  switchedOn = on;
}

/**
 * This frame's pools: the lanterns (`positions`, xyz in turn) nearest `centre`, lit by `glow`
 * (0 by day). Picks without allocating.
 */
export function placeLampPools(
  positions: Readonly<Float32Array>,
  centre: Readonly<THREE.Vector3>,
  glow: number,
) {
  const pool = TUNING.graphics.lamps.pool;
  const strength = switchedOn ? pool.strength * Math.min(1, glow) : 0;
  LAMP_POOLS.uLampPoolLook.value.set(
    lampColour.r * strength,
    lampColour.g * strength,
    lampColour.b * strength,
    strength > 0 ? pool.radius : 0,
  );
  LAMP_POOLS.uLampPoolSea.value = pool.sea;
  if (strength <= 0) return;
  const found = nearestLanterns(positions, centre);
  for (let i = 0; i < COUNT; i++) {
    const at = nearest[i]! * 3;
    LAMP_POOLS.uLampPools.value[i]!.set(
      positions[at]!,
      positions[at + 1]!,
      positions[at + 2]!,
      i < found ? 1 : 0,
    );
  }
}

/** Fills `nearest` with the lanterns closest to `centre`, nearest first; returns how many. */
export function nearestLanterns(
  positions: Readonly<Float32Array>,
  centre: Readonly<THREE.Vector3>,
): number {
  let found = 0;
  for (let at = 0; at < positions.length; at += 3) {
    const dx = positions[at]! - centre.x;
    const dz = positions[at + 2]! - centre.z;
    const d = dx * dx + dz * dz;
    if (found === COUNT && d >= nearestD[COUNT - 1]!) continue;
    let i = Math.min(found, COUNT - 1);
    while (i > 0 && nearestD[i - 1]! > d) {
      nearestD[i] = nearestD[i - 1]!;
      nearest[i] = nearest[i - 1]!;
      i--;
    }
    nearestD[i] = d;
    nearest[i] = at / 3;
    found = Math.min(found + 1, COUNT);
  }
  nearest.fill(0, found);
  return found;
}
