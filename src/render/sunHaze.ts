import * as THREE from 'three';
import { TUNING } from '../data/tuning';
import { DEG, clamp } from '../sim/math';
import type { SkyFrame } from './atmosphere';
import { WORLD_FROM_EYE, chainCompile } from './materialChain';

/**
 * Haze that takes the sun's colour toward the sun (issue #550): the far sea, land and ground fade
 * into the fog warmed by the same glow the drawn sky has round its sun, so the horizon runs on
 * without a seam and a low sun gilds the air in its quarter. One shared set of uniforms, written
 * once a frame; each material only changes how it mixes in its fog. `graphics.json` › `sunlight.haze`
 * scales it (1 = the sky's own glow, 0 = off).
 */

/** The sky's glow round its sun now, the moon's at night, and its warm band along the horizon. */
export interface SunGlow {
  /** The glow's strength and radius (radians). */
  strength: number;
  width: number;
  /** The low sun's warm band on the horizon: strength and half-width (radians). */
  band: number;
  bandWidth: number;
}

/** The drawn sky's sun glow for this frame (`graphics.json` › `sky.sun`), into `out`. */
export function sunGlow(sky: Readonly<SkyFrame>, out: SunGlow): SunGlow {
  const sun = TUNING.graphics.sky.sun;
  const toMoon = (day: number, night: number) => day + (night - day) * sky.night;
  // A storm hides the sun; its glow goes a little slower.
  out.strength = toMoon(sun.glow, sun.moonGlow) * (1 - 0.8 * sky.gloom);
  out.width = toMoon(sun.glowDeg, sun.moonGlowDeg) * DEG;
  out.band = sun.horizonGlow * sunLowness(sky) * (1 - sky.night) * (1 - sky.gloom);
  out.bandWidth = Math.max(sun.horizonGlowDeg, 1) * DEG;
  return out;
}

/** 1 with the sun (or moon) on the horizon, 0 from `sky.sun.lowDeg` up. */
export function sunLowness(sky: Readonly<SkyFrame>): number {
  const elevation = Math.asin(clamp(sky.disc.y, -1, 1)) / DEG;
  return 1 - clamp(elevation / TUNING.graphics.sky.sun.lowDeg, 0, 1);
}

const glow: SunGlow = { strength: 0, width: 1, band: 0, bandWidth: 1 };

const SUN_HAZE = {
  uSunHazeDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunHazeColor: { value: new THREE.Color(0, 0, 0) },
  uSunHazeWidth: { value: 1 },
  /** The horizon band's colour (strength in it) and half-width (radians). */
  uSunHazeBand: { value: new THREE.Color(0, 0, 0) },
  uSunHazeBandWidth: { value: 1 },
};

/**
 * Top level: `sunHazed`, the fog's colour looking along `worldDir` (from the eye). The glow is the
 * dome's, measured at the horizon below the look, so sea and sky meet in one colour.
 */
export const sunHazeFunctions = /* glsl */ `
uniform vec3 uSunHazeDir;
uniform vec3 uSunHazeColor;
uniform float uSunHazeWidth;
uniform vec3 uSunHazeBand;
uniform float uSunHazeBandWidth;
vec3 sunHazed(vec3 fog, vec3 worldDir) {
  vec2 across = worldDir.xz;
  float len = length(across);
  if (len < 1e-4) return fog;
  vec2 flatDir = across / len;
  float apart = length(vec3(flatDir.x, 0.0, flatDir.y) - uSunHazeDir);
  float around = length(flatDir - normalize(uSunHazeDir.xz + vec2(1e-5, 0.0))) / uSunHazeBandWidth;
  return fog + uSunHazeColor * exp(-apart * apart / (uSunHazeWidth * uSunHazeWidth))
    + uSunHazeBand * exp(-around * around);
}
`;

/** The uniforms for a custom shader (the sea): the shared objects themselves. */
export const sunHazeUniforms = () => SUN_HAZE;

/** A Lambert material's fog warmed toward the sun; chains any `onBeforeCompile` it already has. */
export function withSunHaze<M extends THREE.MeshLambertMaterial>(material: M): M {
  return chainCompile(material, 'sunHaze', (shader) => {
    Object.assign(shader.uniforms, SUN_HAZE);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <fog_pars_fragment>', `#include <fog_pars_fragment>\n${sunHazeFunctions}`)
      .replace(
        '#include <fog_fragment>',
        `#ifdef USE_FOG
  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, sunHazed(fogColor, ${WORLD_FROM_EYE}), fogFactor);
#endif`,
      );
  });
}

/** This frame's haze from the drawn sky's sun or moon; `on` false (or `haze` 0) turns it off. */
export function setSunHaze(sky: Readonly<SkyFrame>, on: boolean) {
  sunGlow(sky, glow);
  const amount = on ? TUNING.graphics.sunlight.haze : 0;
  SUN_HAZE.uSunHazeDir.value.copy(sky.disc);
  SUN_HAZE.uSunHazeColor.value.copy(sky.discColor).multiplyScalar(amount * glow.strength);
  SUN_HAZE.uSunHazeWidth.value = Math.max(glow.width, 1e-3);
  SUN_HAZE.uSunHazeBand.value.copy(sky.discColor).multiplyScalar(amount * glow.band);
  SUN_HAZE.uSunHazeBandWidth.value = glow.bandWidth;
}
