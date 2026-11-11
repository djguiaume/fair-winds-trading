/**
 * Detailed island ground mockup (thread "Compare Saltline's look with our game", 2026-11-11).
 * Not game code: patches the field ground material (fieldGroundShader.ts) in the running game.
 * Adds, inside each zone only (zone edges untouched): grass tufts and patches, sand ripples and
 * grit, rock relief, and cliff ledges, as colour variation AND bumps that catch the sun.
 * Everything fades out where it would be smaller than two pixels.
 */
type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const HEAD = /* glsl */ `
vec3 gBump = vec3(0.0);

// Height of the small relief at p (world units), per kind of ground, already faded by distance.
float reliefAt(vec2 p, float height, vec4 kind, vec4 fade) {
  // grass: tufts (~0.3 m) on soft clumps (~1.5 m)
  float tufts = groundNoise(p * 3.1) * 0.55 + groundNoise(p * 6.7 + 3.1) * 0.45;
  float clumps = groundNoise(p * 0.7 + 9.2);
  float mid = groundNoise(p * 1.8 + 5.5);
  float grass = tufts * fade.x * 0.05 + mid * fade.y * 0.09 + clumps * 0.28;
  // sand: wind ripples across the beach, wobbled
  float wob = groundNoise(p * 0.35) * 2.5;
  float ripples = sin(dot(p, vec2(1.9, 0.8)) * 1.5 + wob) * fade.y * 0.018;
  // rock (flat): ridged lumps
  float lumps = (1.0 - abs(groundNoise(p * 1.3 + 4.4))) * 0.22 * fade.y + groundNoise(p * 4.1) * 0.04 * fade.x;
  // cliffs: ledges by height, broken along the face
  float ledges = pow(0.5 + 0.5 * sin(6.2831853 * (height / 2.2 + groundNoise(p * 0.12) * 0.35)), 3.0) * 0.16;
  return grass * kind.x + ripples * kind.y + lumps * kind.z + ledges * kind.w;
}
`;

const BODY = /* glsl */ `
  colour *= 1.0 + detail * (1.0 - steep);
  {
    vec3 c = colour;
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    float kGrass = smoothstep(0.015, 0.08, c.g - max(c.r, c.b)) * (1.0 - steep);
    float kSand = smoothstep(0.04, 0.12, c.r - c.b) * smoothstep(0.42, 0.6, lum) * (1.0 - kGrass) * (1.0 - steep);
    float kCliff = steep;
    float kRock = clamp(1.0 - kGrass - kSand - kCliff, 0.0, 1.0);
    vec4 kind = vec4(kGrass, kSand, kRock, kCliff);
    vec4 fade = vec4(groundResolved(6.7, unitsPerPixel), groundResolved(2.4, unitsPerPixel), 0.0, 0.0);
    // colour: grass patches (lighter, yellower) and darker clumps; sand grit; rock stains
    float dryPatch = groundNoise(p * 0.22 + 1.7);
    float clump = groundNoise(p * 0.7 + 9.2);
    vec3 dry = c * vec3(1.12, 1.05, 0.82);
    c = mix(c, dry, smoothstep(0.15, 0.8, dryPatch) * 0.45 * kGrass);
    c *= 1.0 + (clump * 0.10 + groundNoise(p * 1.8 + 5.5) * 0.06 * fade.y + groundNoise(p * 3.1) * 0.05 * fade.x) * kGrass;
    c *= 1.0 + (groundHash(floor(p * 9.0)) - 0.5) * 0.10 * groundResolved(9.0, unitsPerPixel) * kSand;
    c *= 1.0 + groundNoise(p * 0.5 + 2.2) * 0.10 * (kRock + kCliff);
    colour = c;
    // the bump: the relief's slope by finite differences
    float e = 0.06;
    float h0 = reliefAt(p, height, kind, fade);
    float hx = reliefAt(p + vec2(e, 0.0), height, kind, fade);
    float hz = reliefAt(p + vec2(0.0, e), height, kind, fade);
    float hy = reliefAt(p, height + e, kind, fade);
    gBump = vec3(hx - h0, (hy - h0) * kCliff, hz - h0) / e;
  }`;

const NORMAL = /* glsl */ `#include <normal_fragment_maps>
  normal = normalize(normal - (viewMatrix * vec4(gBump * GROUND_BUMP, 0.0)).xyz);`;

function patchMaterial(m: Any, strength: number) {
  if (m.userData.groundDetailMock) return false;
  const original = m.onBeforeCompile;
  m.onBeforeCompile = (shader: Any, renderer: Any) => {
    original.call(m, shader, renderer);
    const anchor = '  colour *= 1.0 + detail * (1.0 - steep);';
    if (!shader.fragmentShader.includes(anchor)) throw new Error('ground shader changed');
    shader.fragmentShader = shader.fragmentShader
      .replace('vec3 groundColour() {', `${HEAD}\nvec3 groundColour() {`)
      .replace(anchor, BODY)
      .replace('#include <normal_fragment_maps>', NORMAL)
      .replace('void main() {', `#define GROUND_BUMP ${strength.toFixed(2)}\nvoid main() {`);
  };
  m.customProgramCacheKey = () => 'ground-detail-mock';
  m.userData.groundDetailMock = true;
  m.needsUpdate = true;
  return true;
}

export function apply(fwt: Any) {
  const strength = (window as Any).__groundBump ?? 1;
  let n = 0;
  fwt.view.scene.traverse((o: Any) => {
    const m = o.material;
    if (m && m.userData && m.userData.ground && patchMaterial(m, strength)) n++;
  });
  return n;
}
