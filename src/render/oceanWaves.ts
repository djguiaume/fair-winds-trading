import { shoreShader } from './shoreTexture';
import { seabedShader } from './seabedTexture';

/** The waves' (amplitude, wavenumber), as in the shaders' `wave`. */
const WAVES: readonly [number, number][] = [
  [0.32, Math.hypot(0.12, 0.07)],
  [0.24, Math.hypot(-0.05, 0.15)],
  [0.12, Math.hypot(0.21, -0.17)],
];

/** CPU copy of the vertex shader's wave height, so boats and wakes ride the same waves. */
export function waveHeight(x: number, z: number, t: number): number {
  return (
    Math.sin(x * 0.12 + z * 0.07 + t * 1.1) * 0.32 +
    Math.sin(x * -0.05 + z * 0.15 + t * 0.8) * 0.24 +
    Math.sin(x * 0.21 + z * -0.17 + t * 1.7) * 0.12
  );
}

/**
 * How far an ocean grid's flat triangles can part from the true waves between points `cell`
 * apart (a cell's diagonal): a chord's sag, at most the wave's full height. On Low's coarse grid
 * they stand over a low beach and poke through the calm water (issue #277).
 */
export function waveSag(cell: number) {
  const span = cell * Math.SQRT2;
  return WAVES.reduce((sum, [a, k]) => sum + Math.min(2 * a, (a * (k * span) ** 2) / 8), 0);
}

/**
 * The GPU half of the wave contract: `uWave[i]` = (k.x, k.z, phase, height) and `uWaveShift[i]`
 * = Gerstner shift (x, z), in scene space (z = -sim y), filled by `SeaWaves.writeUniforms` (`seaWaves.ts`).
 * Returns the offset (x, height, z) of the rest point `p` (scene x, z): the same sum as the CPU's
 * `waveOffsetAt`, plus the cosmetic bands.
 */
const gerstnerShader = /* glsl */ `
uniform vec4 uWave[WAVE_COUNT];
uniform vec2 uWaveShift[WAVE_COUNT];

vec3 waveOffset(vec2 p) {
  vec3 o = vec3(0.0);
  for (int i = 0; i < WAVE_COUNT; i++) {
    float theta = dot(uWave[i].xy, p) + uWave[i].z;
    o.xz += uWaveShift[i] * cos(theta);
    o.y += uWave[i].w * sin(theta);
  }
  return o;
}
`;

/** The ocean's waves, calmed near the shore on a coarse grid (`uShoreCalm`). */
export const oceanVertexShader = /* glsl */ `
uniform float uTime;
// How much the waves calm toward the shore (x), over this many units (y): a coarse grid's flat
// triangles would otherwise stand over a low beach between its points (issue #277).
uniform vec2 uShoreCalm;
${shoreShader}
#ifdef VERTEX_SHORES
varying float vShoreDistance;
#ifdef DEPTH
${seabedShader}
varying float vDepth;
#endif
#endif
varying vec3 vWorld;
varying float vHeight;
varying float vFogDepth;

#ifdef GERSTNER
${gerstnerShader}
#else
vec3 waveOffset(vec2 p) {
  return vec3(0.0,
    sin(dot(p, vec2(0.12, 0.07)) + uTime * 1.1) * 0.32
      + sin(dot(p, vec2(-0.05, 0.15)) + uTime * 0.8) * 0.24
      + sin(dot(p, vec2(0.21, -0.17)) + uTime * 1.7) * 0.12,
    0.0);
}
#endif

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  float shore = shoreDistance(world.xz);
  vec3 offset = waveOffset(world.xz) * mix(1.0, smoothstep(0.0, uShoreCalm.y, shore), uShoreCalm.x);
  float h = offset.y;
  world.xyz += offset;
  vWorld = world.xyz;
#ifdef VERTEX_SHORES
  vShoreDistance = shore;
#ifdef DEPTH
  vDepth = seabedDepth(world.xz);
#endif
#endif
  vHeight = h;
  vec4 mv = viewMatrix * world;
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
