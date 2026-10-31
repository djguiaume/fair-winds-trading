import { shoreShader } from './shoreTexture';
import { seabedShader, seabedUniforms } from './seabedTexture';
import { surfOpenShader } from './shoreWash';

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
 * The GPU half of the wave contract: `uWave[i]` = (k.x, k.z, phase, drawn height),
 * `uWaveShift[i]` = Gerstner shift (x, z) and `uWaveFine[i]` = the height the grid can't hold
 * (`drawCells`), in scene space (z = -sim y), filled by `SeaWaves.writeUniforms` (`seaWaves.ts`).
 * `bandShare` is a component's band's share `calm` (`SWELL_END`, `CHOP_END`: where each band ends).
 */
const waveUniformsShader = /* glsl */ `
uniform vec4 uWave[WAVE_COUNT];
uniform vec2 uWaveShift[WAVE_COUNT];
uniform float uWaveFine[WAVE_COUNT];

float bandShare(int i, vec3 calm) {
  return i < SWELL_END ? calm.x : (i < CHOP_END ? calm.y : calm.z);
}
`;

/**
 * Returns the offset (x, height, z) of the rest point `p` (scene x, z): the same sum as the CPU's
 * `waveOffsetAt`, plus the cosmetic bands. Leaves `seaNormal` with the drawn surface's normal
 * there (not normalized), the cross of its two tangents as the CPU's `waveNormalAt`, and
 * `seaFine` with the undrawn waves' slope (x, z) and height (y), which only shade: all of them on
 * Low, the swell's and chop's under `FANCY` (the fragment adds the ripples per pixel).
 */
const gerstnerShader = /* glsl */ `
${waveUniformsShader}
vec3 seaNormal = vec3(0.0, 1.0, 0.0);
vec3 seaFine = vec3(0.0);

vec3 waveOffset(vec2 p, vec3 calm) {
  vec3 o = vec3(0.0);
  // The displaced surface's tangents along rest x and rest z.
  vec3 tx = vec3(1.0, 0.0, 0.0), tz = vec3(0.0, 0.0, 1.0);
  seaFine = vec3(0.0);
  for (int i = 0; i < WAVE_COUNT; i++) {
    vec2 k = uWave[i].xy;
    float theta = dot(k, p) + uWave[i].z;
    float share = bandShare(i, calm);
    float s = sin(theta), c = cos(theta);
    float a = uWave[i].w * share;
    vec2 shift = uWaveShift[i] * share;
    o.xz += shift * c;
    o.y += a * s;
    vec3 slope = vec3(-shift.x * s, a * c, -shift.y * s);
    tx += slope * k.x;
    tz += slope * k.y;
#ifdef FANCY
    if (i >= CHOP_END) continue;
#endif
    float f = uWaveFine[i] * share;
    seaFine += vec3(k.x * f * c, f * s, k.y * f * c);
  }
  seaNormal = cross(tz, tx);
  return o;
}
`;

/**
 * Fragment side (Medium and up): the undrawn ripples' slope (x, z) and height (y) at the rest
 * point `p`, per pixel: the few waves short enough to fall between a fine grid's points.
 */
export const waveFineShader = /* glsl */ `
${waveUniformsShader}
vec3 waveFine(vec2 p, float calm) {
  vec3 o = vec3(0.0);
  for (int i = CHOP_END; i < WAVE_COUNT; i++) {
    float theta = dot(uWave[i].xy, p) + uWave[i].z;
    float f = uWaveFine[i] * calm;
    float c = cos(theta);
    o += vec3(uWave[i].x * f * c, f * sin(theta), uWave[i].y * f * c);
  }
  return o;
}
`;

/**
 * The coast's calm (issue #281, `sim/coastWaves.ts`): each band's share of its waves from the
 * bake's depth (red) and exposure (green), the same bytes and formula as the CPU's `bandCalm`.
 * `uCoast` = (floor, sheltered, shelteredAt, openAt), `uCoastReach` = each band's reach.
 * `seaSurf` is left with how much of the swell the seabed breaks here (open water only), for foam,
 * and `seaBake` with the bake here.
 */
const coastShader = /* glsl */ `
${seabedUniforms()}
uniform vec4 uCoast;
uniform vec3 uCoastReach;
float seaSurf = 0.0;
vec2 seaBake = vec2(1.0);

float calmStep(float a, float b, float x) {
  float t = clamp((x - a) / max(b - a, 1e-4), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

vec2 coastBake(vec2 p) {
  vec2 uv = (p - uDepthBounds.xy) / uDepthBounds.zw;
  if (all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0))))
    return texture2D(uDepthMap, uv).rg;
  return vec2(1.0);
}

vec3 coastCalm(vec2 p) {
  vec2 bake = coastBake(p);
  seaBake = bake;
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
  float calm = mix(1.0, smoothstep(0.0, uShoreCalm.y, shore), uShoreCalm.x);
#ifdef GERSTNER
  seaNormal.xz *= calm;
  seaFine *= calm;
#endif
  return o * calm;
}
`;

/**
 * What the ocean's fragment shades the Gerstner waves by (not Ultra-low's plain water): the drawn
 * surface's slope with the waves the grid can't hold, per vertex, and the ripples per pixel from
 * the rest point (Medium and up). `uWaveLook` = (how faceted, where the detail starts and ends
 * fading with distance, how much steeper the slopes shade than they stand); `uWaveTone` = (how
 * much the sun shades the slopes, how much lighter a crest is than a trough, the sea's highest
 * crest now). Where no glint needs a true normal per pixel, the sky's Fresnel share comes per
 * vertex too (`VERTEX_SKY`).
 */
export const waveShadingVaryings = /* glsl */ `
uniform vec4 uWaveLook;
uniform vec3 uWaveTone;
// The slope (x, z: the normal's over its y), the undrawn waves' height, the detail left here.
varying vec4 vWave;
#ifdef FANCY
// The rest point, and the ripples' share there.
varying vec3 vRest;
#endif
#if defined(DEPTH) && !defined(REFLECT)
#define VERTEX_SKY
varying float vSky;
#endif
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
// The bands' heights now (drawn or only shaded), so the fragment knows how near a crest it is.
uniform vec3 uBandHeight;
// The way the swell runs (scene x, z), the surf's share in a reef's lee (z), how far ahead the
// windward test looks (w).
uniform vec4 uSeaWind;
varying vec3 vSea;
#ifdef FANCY
// How strong the surf lines are on this coast (issue #397).
${surfOpenShader}
varying float vSurfOpen;
#endif
#endif
#if defined(GERSTNER) && !defined(PLAIN)
${waveShadingVaryings}
#ifdef VERTEX_SKY
uniform float uFresnelPower;
#endif
// The fine waves and facets fade out toward the horizon, so it never sparkles.
float waveDetail(float depth) {
  return 1.0 - smoothstep(uWaveLook.y, uWaveLook.z, depth);
}
#endif
varying vec3 vWorld;
varying float vHeight;
varying float vFogDepth;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec2 rest = world.xz;
  float shore = shoreDistance(rest);
  vec3 offset = seaOffset(rest, shore);
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
  // How high a crest can stand here (x), the surf (y), the swell's share (z). The surf breaks on
  // the windward edge, where the seabed rises ahead of the swell; the lee keeps a thinner share.
  float windward = smoothstep(0.0, 0.06, seaBake.x - coastBake(rest + uSeaWind.xy * uSeaWind.w).x);
  vSea = vec3(dot(uBandHeight, seaShare), seaSurf * mix(uSeaWind.z, 1.0, windward), seaShare.x);
#ifdef FANCY
  vSurfOpen = surfOpen(seaBake.y, windward);
#endif
#endif
  vHeight = h;
  vec4 mv = viewMatrix * world;
  vFogDepth = -mv.z;
#if defined(GERSTNER) && !defined(PLAIN)
  float near = waveDetail(vFogDepth);
  vec3 fine = seaFine * near;
  vWave = vec4(seaNormal.xz / max(seaNormal.y, 0.1) - fine.xz, fine.y, near);
#ifdef FANCY
  vRest = vec3(rest, seaShare.z);
#endif
#ifdef VERTEX_SKY
  vec3 toEye = normalize(cameraPosition - world.xyz);
  vSky = pow(1.0 - max(dot(normalize(seaNormal), toEye), 0.0), uFresnelPower);
#endif
#endif
  gl_Position = projectionMatrix * mv;
}
`;
