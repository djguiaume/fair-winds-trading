/**
 * GLSL for the soft surface patterns (issue #572): planks, stone, plaster, roof tiles, slate,
 * thatch and sail canvas, drawn from the model's own position in world units, never from an image.
 * Each returns a lightness shift around 0 (its tones about -1 to 1, seams to -1.5) that `surfaceDetail.ts` scales by the
 * pattern's contrast, so a pattern only lightens or darkens the face's own colour, never its hue.
 * The order of `SURFACE_KINDS` is the shader's kind numbers (1 = the first, 0 = none).
 */

/** The patterns, in the order the shader numbers them from 1. */
export const SURFACE_KINDS = [
  'planks',
  'stone',
  'plaster',
  'tiles',
  'slate',
  'thatch',
  'canvas',
] as const;

export type SurfaceKind = (typeof SURFACE_KINDS)[number];

/** The shader's number for a kind; 0 is plain. */
export const surfaceKindNumber = (kind: SurfaceKind | undefined) =>
  kind ? SURFACE_KINDS.indexOf(kind) + 1 : 0;

/** Hash, value noise and an anti-aliased seam line, shared by every pattern. */
const HELPERS = /* glsl */ `
float sdHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float sdNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = sdHash(i);
  float b = sdHash(i + vec2(1.0, 0.0));
  float c = sdHash(i + vec2(0.0, 1.0));
  float d = sdHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
// 1 on a thin line where x is a whole number, softened over the pixel's footprint.
float sdSeam(float x, float width) {
  float d = abs(fract(x + 0.5) - 0.5);
  float w = fwidth(x);
  return 1.0 - smoothstep(width, width + w * 1.5, d);
}
`;

/**
 * The patterns. `uv` runs along the face (x across, y up the slope or along a deck), in units of
 * the pattern's size; `size` is that size in world units.
 */
const PATTERNS = /* glsl */ `
// Boards: one shade per board, long grain, dark seams between rows and at staggered butt ends.
float sdPlanks(vec2 uv) {
  float row = floor(uv.y);
  float along = uv.x / 9.0 + sdHash(vec2(row, 7.0));
  float board = sdHash(vec2(row, floor(along))) * 2.0 - 1.0;
  float grain = sdNoise(vec2(uv.x * 0.7, uv.y * 6.0)) - 0.5;
  float seam = max(sdSeam(uv.y, 0.05), sdSeam(along, 0.006));
  return board + grain * 0.5 - seam * 1.5;
}
// Dressed stone in a running bond: a shade per block, a little grain, soft mortar lines.
float sdStone(vec2 uv) {
  float row = floor(uv.y);
  float bond = uv.x / 1.8 + 0.5 * mod(row, 2.0);
  float block = sdHash(vec2(row, floor(bond))) * 2.0 - 1.0;
  float grain = sdNoise(uv * 3.0) - 0.5;
  float seam = max(sdSeam(uv.y, 0.05), sdSeam(bond, 0.03));
  return block + grain * 0.5 - seam * 1.4;
}
// Lime plaster: broad soft clouds with a fine grain over them.
float sdPlaster(vec2 uv) {
  float broad = sdNoise(uv) * 0.7 + sdNoise(uv * 2.3 + 17.0) * 0.3;
  float fine = sdNoise(uv * 7.0) - 0.5;
  return (broad - 0.5) * 2.5 + fine * 0.6;
}
// Clay tiles: courses with a shadow under each lip, staggered joints, a shade per tile.
float sdTiles(vec2 uv, float joint) {
  float row = floor(uv.y);
  float across = uv.x / joint + 0.5 * mod(row, 2.0);
  float tile = sdHash(vec2(row, floor(across))) * 2.0 - 1.0;
  float slope = fract(uv.y) - 0.5;
  float lip = sdSeam(uv.y, 0.07);
  return tile * 0.8 + slope * 0.8 - lip * 1.4 - sdSeam(across, 0.035) * 0.8;
}
// Thatch: straw streaks down the slope, a course line now and then.
float sdThatch(vec2 uv) {
  float straw = sdNoise(vec2(uv.x * 6.0, uv.y * 0.6)) - 0.5;
  float tuft = sdNoise(vec2(uv.x * 1.5, uv.y * 1.5) + 5.0) - 0.5;
  return straw * 2.0 + tuft * 0.8 - sdSeam(uv.y / 2.5, 0.04) * 1.0;
}
// Sail cloth: cross-cut panels with a stitched seam, the faintest weave.
float sdCanvas(vec2 uv) {
  float panel = sdHash(vec2(floor(uv.y), 3.0)) * 2.0 - 1.0;
  float weave = sdNoise(uv * vec2(9.0, 9.0)) - 0.5;
  return panel * 0.6 + weave * 0.5 - sdSeam(uv.y, 0.025) * 1.5;
}
`;

/** Fragment functions: `surfaceShift(kind, pos)` from the pattern's place and face. */
export const surfaceFragment = (kinds: number) => /* glsl */ `
uniform vec4 uSurfaceKinds[${kinds}];
uniform vec2 uSurface;
uniform vec4 uSurfaceFade;
varying vec3 vSurfacePos;
varying float vSurfaceKind;
${HELPERS}
${PATTERNS}
// The face's own axes: across it (the stronger sideways axis) and up it (height, or the deck's
// other axis). Boxes in the models are axis-aligned in their own space, so a box projection
// keeps the rows straight; roofs count height along their slope.
vec2 surfaceAxes(vec3 p, vec3 n, bool slope) {
  vec3 a = abs(n);
  if (a.y > 0.85) return p.zx;
  float across = a.x > a.z ? p.z : p.x;
  float up = slope ? p.y / max(length(n.xz), 0.35) : p.y;
  return vec2(across, up);
}
float surfaceShift(int kind, vec3 p, vec3 n) {
  vec4 k = uSurfaceKinds[kind - 1];
  bool slope = kind >= 4 && kind <= 6;
  vec2 uv = surfaceAxes(p, n, slope) / k.x;
  // Fade a pattern that has grown finer than a few pixels, before it can shimmer.
  float fine = 1.0 - smoothstep(0.2, 0.55, length(fwidth(uv)));
  if (fine <= 0.0) return 0.0;
  float t;
  if (kind == 1) t = sdPlanks(uv);
  else if (kind == 2) t = sdStone(uv);
  else if (kind == 3) t = sdPlaster(uv);
  else if (kind == 4) t = sdTiles(uv, 1.3);
  else if (kind == 5) t = sdTiles(uv * vec2(1.0, 0.8), 1.8);
  else if (kind == 6) t = sdThatch(uv);
  else t = sdCanvas(uv);
  return clamp(t, -2.0, 1.5) * k.y * fine;
}
`;
