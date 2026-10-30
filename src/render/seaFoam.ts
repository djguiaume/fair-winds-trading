/**
 * The ocean's foam on the Gerstner waves (issue #281), for its fragment shader (`oceanShader.ts`,
 * soft-foam looks with the coast's calm): the shore ring of the calm sea, which grows wider,
 * breaks up under a drifting grain and lifts with each crest as the sea gets up; surf where the
 * seabed breaks the swell (reefs, banks, an open shelf, never a closed harbour); whitecaps on the
 * highest crests of a rough open sea.
 */

/** Top level: `foamGrain`, a drifting value noise (0..1) that breaks the foam into patches. */
export const seaFoamFunctions = /* glsl */ `
float foamHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float foamNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(foamHash(i), foamHash(i + vec2(1.0, 0.0)), f.x),
             mix(foamHash(i + vec2(0.0, 1.0)), foamHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float foamGrain(vec2 p, float t) {
  return 0.65 * foamNoise(p * 0.45 + vec2(t * 0.11, -t * 0.08))
       + 0.35 * foamNoise(p * 1.1 - vec2(t * 0.17, t * 0.05));
}
`;

/**
 * In `main`: reads `d` (to the shore), `ripple`, `vWorld`, `vHeight`, `vSea` (crest height, surf,
 * swell share), `uSeaFoam` (how rough, ring widening, surf, whitecaps: `waves.json` › `foam`),
 * `uFoamNight` and `uFoamLook`; writes `col`. A calm sea keeps the classic ring.
 */
export const seaFoamShader = /* glsl */ `
  float rough = uSeaFoam.x;
  float grain = foamGrain(vWorld.xz, uTime);
  float lift = vHeight / max(vSea.x, 0.05);
  float crest = smoothstep(0.0, 0.6, lift);
  float reach = uFoamLook.x + uFoamLook.y * (1.0 + uSeaFoam.y * rough);
  float soft = 1.0 - smoothstep(uFoamLook.x, reach, d + 0.5 * ripple);
  float beyond = d - reach - 1.0 - 0.8 * sin(uTime * 0.9 + d * 0.4);
  float line = (1.0 - smoothstep(0.0, 1.2, abs(beyond))) * uFoamLook.w * mix(1.0, crest, rough);
  float broken = smoothstep(0.3, 0.6, grain + 0.3 * crest - 0.1);
  float ring = soft * soft * uFoamLook.z * mix(1.0, broken * (0.4 + 0.6 * crest), rough);
  float surf = vSea.y * crest * rough * smoothstep(0.5, 0.75, grain) * uSeaFoam.z;
  float caps = smoothstep(0.5, 0.8, lift) * rough * vSea.z * smoothstep(0.55, 0.8, grain) * uSeaFoam.w;
  col = mix(col, uFoam, clamp(ring + line + surf + caps, 0.0, 1.0) * uFoamNight);
`;
