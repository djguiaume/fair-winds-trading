/**
 * The ocean's foam on the Gerstner waves (issue #281), for its fragment shader (`oceanShader.ts`,
 * soft-foam looks with the coast's calm): the classic shore ring and its thin outer line, which
 * widen a little as the sea gets up; on Medium and up, thin breaking lines that travel in to the
 * beach (`shoreWash.ts`, issue #397); surf where the seabed breaks the swell further out (reefs,
 * banks, an open shelf, never a closed harbour), streaked along the crests and thinner in the
 * lee; small soft whitecaps streaked downwind on the highest crests of a rough open sea. Never
 * whiter than `foam.cap`.
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
 * In `main`: reads `d` (to the shore), `ripple`, `vWorld`, `height` (with the waves the grid only
 * shades), `vSea` (highest crest, surf, swell share), `uSeaFoam` (how rough, ring widening, surf,
 * whitecaps: `waves.json` › `foam`), `uSeaWind` (the swell's way), `uFoamBreakup`, `uFoamCap`,
 * `uFoamNight`, `uFoamLook` and the surf lines (`uSurfLines`); writes `col`. A calm sea keeps the
 * classic ring.
 */
export const seaFoamShader = /* glsl */ `
  float rough = uSeaFoam.x;
  float grain = foamGrain(vWorld.xz, uTime);
  float lift = height / max(vSea.x, 0.05);
  float crest = smoothstep(0.0, 0.6, lift);
  float reach = uFoamLook.x + uFoamLook.y * (1.0 + uSeaFoam.y * rough);
  float soft = 1.0 - smoothstep(uFoamLook.x, reach, d + 0.5 * ripple);
  float beyond = d - reach - 1.0 - 0.8 * sin(uTime * 0.9 + d * 0.4);
  float line = (1.0 - smoothstep(0.0, 1.2, abs(beyond))) * uFoamLook.w;
  float broken = smoothstep(0.3, 0.6, grain + 0.3 * crest - 0.1);
  float ring = soft * soft * uFoamLook.z * mix(1.0, broken, rough * uFoamBreakup);
  // Along and across the swell, for foam streaked along its crests or downwind.
  vec2 along = vec2(dot(vWorld.xz, uSeaWind.xy), dot(vWorld.xz, vec2(-uSeaWind.y, uSeaWind.x)));
#ifdef FANCY
  float breakers = surfLines(vWorld.xz, d) * vSurfOpen;
  float offshore = smoothstep(uSurfLines.y, uSurfLines.y + uSurfLines.x, d);
#else
  float breakers = 0.0;
  float offshore = 1.0;
#endif
  float crestLine = foamNoise(vec2(along.x * 0.5, along.y * 0.08) + uTime * 0.05);
  float surf = vSea.y * smoothstep(0.45, 0.85, lift) * rough * smoothstep(0.45, 0.7, crestLine)
    * uSeaFoam.z * offshore;
  float streak = 0.7 * foamNoise(vec2(along.x * 0.3 - uTime * 0.5, along.y * 1.6))
               + 0.3 * foamNoise(vec2(along.x * 0.7, along.y * 3.1) + uTime * 0.1);
  float caps = smoothstep(0.4, 0.8, lift) * rough * vSea.z * smoothstep(0.52, 0.8, streak)
    * uSeaFoam.w;
  col = mix(col, min(uFoam, uFoamCap),
    clamp(ring + line + breakers + surf + caps, 0.0, 1.0) * uFoamNight);
`;
