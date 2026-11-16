import * as THREE from 'three';
import { TUNING } from '../data/tuning';

/**
 * The sun's glitter path (issue #550): a broad lobe of light on the sea toward the sun (the moon at
 * night), made of twinkling points close by that blend into a smooth bright path far off, where a
 * point would be smaller than a pixel. Drawn by the ocean shader on the levels with `REFLECT`
 * (High and Ultra), after the shadows, so a boat's shade breaks the path. Numbers in
 * `graphics.json` › `water.glitter`.
 */

export const glitterUniforms = () => ({
  /** x: strength, y: the lobe's sharpness, z: points per unit, w: share of points lit. */
  uGlitter: { value: new THREE.Vector4() },
  /** x, y: view heights (sines) between which a steep view loses it; z: twinkle speed. */
  uGlitterFade: { value: new THREE.Vector3(0.8, 1, 6) },
});

/**
 * Top level, after `uTime`, `uSunDir`: `seaGlitter`, the path's light at a point of the sea. Reads
 * the pixel's normal `n` and the way to the eye `toEye`.
 */
export const glitterFunctions = /* glsl */ `
uniform vec4 uGlitter;
uniform vec3 uGlitterFade;
float glitterHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
float seaGlitter(vec3 world, vec3 n, vec3 toEye) {
  if (uGlitter.x <= 0.0) return 0.0;
  float lobe = pow(max(dot(reflect(-toEye, n), uSunDir), 0.0), uGlitter.y);
  lobe *= 1.0 - smoothstep(uGlitterFade.x, uGlitterFade.y, toEye.y);
  if (lobe < 0.002) return 0.0;
  vec2 p = world.xz * uGlitter.z;
  vec2 cell = floor(p);
  float h = glitterHash(cell);
  float point = step(1.0 - uGlitter.w, h)
    * (1.0 - smoothstep(0.06, 0.2, length(fract(p) - 0.5)))
    * (0.5 + 0.5 * sin(uTime * uGlitterFade.z + h * 40.0));
  // A point under two pixels shimmers: there the path is its average light instead.
  float pixels = 1.0 / max(length(fwidth(p)), 1e-4);
  float mean = uGlitter.w * 0.15;
  return lobe * mix(mean, point, smoothstep(1.5, 4.0, pixels));
}
`;

type GlitterUniforms = Partial<ReturnType<typeof glitterUniforms>>;

/**
 * This frame's glitter: the data's while the sun or moon stands over the horizon (`shown`, 0..1),
 * none when the reflections are switched off.
 */
export function writeGlitter(uniforms: GlitterUniforms, on: boolean, shown: number) {
  if (!uniforms.uGlitter) return;
  const g = TUNING.graphics.water.glitter;
  uniforms.uGlitter.value.set(on ? g.strength * shown : 0, g.lobe, g.points, g.share);
  uniforms.uGlitterFade!.value.set(g.fadeFrom, g.fadeTo, g.twinkle);
}
