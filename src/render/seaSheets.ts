import * as THREE from 'three';
import type { Ocean } from './ocean';
import { shoreShader } from './shoreTexture';
import { seaSurfaceShader } from './oceanWaves';
import { gerstnerUniforms } from './seaWaves';

/**
 * The sheets that ride the sea (calm, rough and current water, the shallows): one vertex shader
 * head and one per-frame link to the ocean drawn now, so every sheet moves with the very surface
 * the ocean draws (classic or Gerstner waves, the coast's calm, a coarse grid's shore calm) and
 * only floats clear of the two grids' sag (issue #281: on the classic sines they stood still
 * while the Gerstner sea rose through them).
 */

/** The ocean's uniforms the surface reads, shared by reference. */
const SHARED = [
  'uShoreMap',
  'uShoreBounds',
  'uShoreCalm',
  'uWave',
  'uWaveShift',
  'uDepthMap',
  'uDepthBounds',
  'uCoast',
  'uCoastReach',
] as const;

/** The ocean's defines that pick the surface. */
const DEFINES = ['GERSTNER', 'WAVE_COUNT', 'SWELL_END', 'CHOP_END', 'COAST'] as const;

/**
 * A sheet's vertex shader head: `seaSurfaceShader` (declares `uTime`), and `uLift`. In `main`:
 * `world.xyz += seaOffset(world.xz, shoreDistance(world.xz)); world.y += uLift;`.
 */
export const sheetSurfaceShader = /* glsl */ `
${shoreShader}
${seaSurfaceShader}
uniform float uLift;
`;

/** The uniforms a sheet adds for its surface, until the first `rideSea` links them. */
export function sheetSurfaceUniforms() {
  const { uWave, uWaveShift, uCoast, uCoastReach } = gerstnerUniforms();
  return {
    uLift: { value: 0 },
    uShoreMap: { value: null as THREE.Texture | null },
    uShoreBounds: { value: new THREE.Vector4(0, 0, 1, 1) },
    uShoreCalm: { value: new THREE.Vector2() },
    uDepthMap: { value: null as THREE.Texture | null },
    uDepthBounds: { value: new THREE.Vector4(0, 0, 1, 1) },
    uWave,
    uWaveShift,
    uCoast,
    uCoastReach,
  };
}

/**
 * Once a frame: ride `ocean`'s surface, `base` units over it, on a grid of `cell` units. Compiles
 * again only when the ocean's waves change kind (never in play).
 */
export function rideSea(material: THREE.ShaderMaterial, ocean: Ocean, base: number, cell: number) {
  const from = ocean.mesh.material;
  const u = material.uniforms;
  for (const name of SHARED) u[name]!.value = from.uniforms[name]?.value ?? u[name]!.value;
  u.uLift!.value = ocean.sheetLift(base, cell);
  let changed = false;
  for (const name of DEFINES) {
    const want = from.defines[name] as string | undefined;
    if (material.defines[name] === want) continue;
    if (want === undefined) delete material.defines[name];
    else material.defines[name] = want;
    changed = true;
  }
  if (changed) material.needsUpdate = true;
}
