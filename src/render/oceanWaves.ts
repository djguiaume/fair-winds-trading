import { shoreShader } from './shoreTexture';
import { seabedShader, seabedUniforms } from './seabedTexture';

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
 * Returns the offset (x, height, z) of the rest point `p` (scene x, z), each band (`SWELL_END`,
 * `CHOP_END`: where its components end) times its share `calm`: the same sum as the CPU's
 * `waveOffsetAt`, plus the cosmetic bands.
 */
const gerstnerShader = /* glsl */ `
uniform vec4 uWave[WAVE_COUNT];
uniform vec2 uWaveShift[WAVE_COUNT];

vec3 waveOffset(vec2 p, vec3 calm) {
  vec3 o = vec3(0.0);
  for (int i = 0; i < WAVE_COUNT; i++) {
    float theta = dot(uWave[i].xy, p) + uWave[i].z;
    float share = i < SWELL_END ? calm.x : (i < CHOP_END ? calm.y : calm.z);
    o.xz += uWaveShift[i] * (cos(theta) * share);
    o.y += uWave[i].w * share * sin(theta);
  }
  return o;
}
`;

/**
 * The coast's calm (issue #281, `sim/coastWaves.ts`): each band's share of its waves from the
 * bake's depth (red) and exposure (green), the same bytes and formula as the CPU's `bandCalm`.
 * `uCoast` = (floor, sheltered, shelteredAt, openAt), `uCoastReach` = each band's reach.
 * `seaSurf` is left with how much of the swell the seabed breaks here (open water only), for foam.
 */
const coastShader = /* glsl */ `
${seabedUniforms()}
uniform vec4 uCoast;
uniform vec3 uCoastReach;
float seaSurf = 0.0;

float calmStep(float a, float b, float x) {
  float t = clamp((x - a) / max(b - a, 1e-4), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

vec3 coastCalm(vec2 p) {
  vec2 uv = (p - uDepthBounds.xy) / uDepthBounds.zw;
  vec2 bake = vec2(1.0);
  if (all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0))))
    bake = texture2D(uDepthMap, uv).rg;
  float shelter = mix(uCoast.y, 1.0, calmStep(uCoast.z, uCoast.w, bake.y));
  vec3 deep = vec3(
    calmStep(0.0, uCoastReach.x, bake.x),
    calmStep(0.0, uCoastReach.y, bake.x),
    calmStep(0.0, uCoastReach.z, bake.x));
  seaSurf = (1.0 - deep.x) * (1.0 - deep.x) * shelter;
  return mix(vec3(uCoast.x), vec3(1.0), deep) * shelter;
}
`;

/**
 * The sea's surface, shared by the ocean and every sheet riding it (calm, rough and current
 * water, the shallows): `seaOffset(p, shore)` moves the rest point `p` (scene x, z), `shore`
 * units from the nearest beach. The classic sines, or the Gerstner waves calmed by the coast
 * (`COAST`); then calmed toward the shore on a coarse grid (`uShoreCalm`: how much (x), over
 * how many units (y)), since its flat triangles would otherwise stand over a low beach (issue #277).
 * `seaShare` is left with each band's share there. Declares `uTime`.
 */
export const seaSurfaceShader = /* glsl */ `
uniform float uTime;
uniform vec2 uShoreCalm;
vec3 seaShare = vec3(1.0);
#ifdef GERSTNER
${gerstnerShader}
#ifdef COAST
${coastShader}
#endif
#else
vec3 waveOffset(vec2 p) {
  return vec3(0.0,
    sin(dot(p, vec2(0.12, 0.07)) + uTime * 1.1) * 0.32
      + sin(dot(p, vec2(-0.05, 0.15)) + uTime * 0.8) * 0.24
      + sin(dot(p, vec2(0.21, -0.17)) + uTime * 1.7) * 0.12,
    0.0);
}
#endif

vec3 seaOffset(vec2 p, float shore) {
#if defined(GERSTNER) && defined(COAST)
  seaShare = coastCalm(p);
  vec3 o = waveOffset(p, seaShare);
#elif defined(GERSTNER)
  vec3 o = waveOffset(p, vec3(1.0));
#else
  vec3 o = waveOffset(p);
#endif
  return o * mix(1.0, smoothstep(0.0, uShoreCalm.y, shore), uShoreCalm.x);
}
`;

/** The ocean's waves (`seaSurfaceShader`), with what its fragment shader colours and foams by. */
export const oceanVertexShader = /* glsl */ `
${shoreShader}
${seaSurfaceShader}
#ifdef VERTEX_SHORES
varying float vShoreDistance;
#ifdef DEPTH
${seabedShader}
varying float vDepth;
#endif
#endif
#ifdef COAST
// The bands' drawn heights now, so the fragment knows how near a crest it is.
uniform vec3 uBandHeight;
varying vec3 vSea;
#endif
varying vec3 vWorld;
varying float vHeight;
varying float vFogDepth;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  float shore = shoreDistance(world.xz);
  vec3 offset = seaOffset(world.xz, shore);
  float h = offset.y;
  world.xyz += offset;
  vWorld = world.xyz;
#ifdef VERTEX_SHORES
  vShoreDistance = shore;
#ifdef DEPTH
  vDepth = seabedDepth(world.xz);
#endif
#endif
#ifdef COAST
  // How high a crest can stand here (x), the surf (y), the swell's share (z).
  vSea = vec3(dot(uBandHeight, seaShare), seaSurf, seaShare.x);
#endif
  vHeight = h;
  vec4 mv = viewMatrix * world;
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
