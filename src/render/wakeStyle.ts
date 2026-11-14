import * as THREE from 'three';
import boatLookFile from '../data/boat-look.json';
import { QUALITY_LEVELS, type QualityLevel } from './quality';

/**
 * Wake styles (issue #418, `boat-look.json` › `wakes`): a cosmetic on the player's one wake mesh,
 * as uniforms only (no extra draw call, particle or length change). Dashes along the trail, a thin
 * double line on each edge, soft twinkles toward the tail and an item's tint. The twinkles only
 * thin or fill the foam's own alpha, so nothing glows above the foam. Below High, tint only.
 */
export interface WakeLook {
  dash: number;
  duty: number;
  lines: number;
  sparkle: number;
  tint: number;
}

const LOOKS = boatLookFile.wakes as unknown as Record<string, WakeLook>;
/** Patterns and sparkle from this quality level up; tint on every level. */
const PATTERNS_FROM = QUALITY_LEVELS.indexOf('high');

export const wakeStyleUniforms = () => ({
  uTint: { value: new THREE.Color('#ffffff') },
  uTintMix: { value: 0 },
  /** dash repeats per unit, dash duty, double line (0 to 1), sparkle (0 to 1). */
  uStyle: { value: new THREE.Vector4(0, 1, 0, 0) },
});

/** GLSL declarations, before `main`. */
export const WAKE_STYLE_HEAD = `uniform vec3 uTint;
  uniform float uTintMix;
  uniform vec4 uStyle;
  // Smooth value noise 0..1: blobs, never squares, however close the camera.
  float wakeHash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }
  float wakeNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = p - i;
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(wakeHash(i), wakeHash(i + vec2(1.0, 0.0)), f.x),
               mix(wakeHash(i + vec2(0.0, 1.0)), wakeHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }`;

/**
 * GLSL in `main`: `alpha` and `col` are the plain foam's; `vFoam` is (across -1..1, along,
 * strength, edge 1 / centre 0); `edge` the across fade.
 */
export const WAKE_STYLE_BODY = `
  float across = abs(vFoam.x);
  if (uStyle.x > 0.0) {
    // Round blobs in lanes: the drawn share of each repeat along, a lane's middle across.
    float along = (fract(vFoam.y * uStyle.x) - 0.5) / uStyle.y;
    float lane = (fract(across * 2.5) - 0.5) * 1.25;
    alpha *= 1.0 - smoothstep(0.36, 0.5, length(vec2(along, lane)));
  }
  float lines = max(1.0 - smoothstep(0.0, 0.1, abs(across - 0.15)),
                    1.0 - smoothstep(0.0, 0.1, abs(across - 0.55)));
  alpha *= mix(1.0, lines, uStyle.z * vFoam.w);
  float seed = wakeNoise(vec2(vFoam.y * 4.0, vFoam.x * 3.0));
  float twinkle = smoothstep(0.7, 0.9, seed) * (0.5 + 0.5 * sin(uTime * 5.0 + vFoam.y * 3.0));
  float tail = smoothstep(0.0, 0.06, vFoam.z) * (1.0 - smoothstep(0.08, 0.4, vFoam.z));
  alpha = max(alpha, uStyle.w * twinkle * tail * edge * vFoam.w);
  col = mix(col, uTint, uTintMix);`;

/** Sets a style on a wake's uniforms; `null` (or the Settings switch off) is the plain wake. */
export function applyWakeStyle(
  material: THREE.ShaderMaterial,
  style: { style: string; tint: string | null } | null,
  level: QualityLevel,
) {
  const u = material.uniforms as ReturnType<typeof wakeStyleUniforms>;
  const look = (style && LOOKS[style.style]) || LOOKS.plain!;
  const full = QUALITY_LEVELS.indexOf(level) >= PATTERNS_FROM;
  u.uStyle.value.set(
    full ? look.dash : 0,
    look.duty,
    full ? look.lines : 0,
    full ? look.sparkle : 0,
  );
  if (style?.tint) u.uTint.value.set(style.tint);
  u.uTintMix.value = style?.tint ? look.tint : 0;
}
