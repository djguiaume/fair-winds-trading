import * as THREE from 'three';
import { TUNING } from '../../data/tuning';
import { QUALITY, type QualityLevel } from '../quality';
import type { FieldGroundTextures } from './fieldGround';

/**
 * The new look's ground material (issue #373): a Lambert material whose colour is decided per
 * pixel, not per texel of the field. The cliff colour comes in from the interpolated slope, its
 * bands from the pixel's own height, the wet band from its height, and zone edges (grass, sand)
 * are a thin, smooth line between the colour texture's texels, so nothing shows the 0.8-unit grid.
 * A faint detail noise breaks up flat ground and faint strata streak the cliffs. Numbers live in
 * `terrain.json › draw`; the island builder uses the same material, so it shows the same ground.
 */

/** The shader's inputs, kept on the material so quality changes and disposal can reach them. */
interface GroundUniforms {
  groundShape: THREE.IUniform<THREE.Texture>;
  groundHeights: THREE.IUniform<THREE.Vector2>;
  groundSides: THREE.IUniform<THREE.Texture>;
  groundWet: THREE.IUniform<THREE.Color>;
  groundScale: THREE.IUniform<number>;
  groundCentre: THREE.IUniform<THREE.Vector2>;
  groundSlope: THREE.IUniform<THREE.Vector4>;
  groundWetBand: THREE.IUniform<THREE.Vector2>;
  groundBandHeight: THREE.IUniform<number>;
  groundBandWobble: THREE.IUniform<THREE.Vector2>;
  groundStrata: THREE.IUniform<THREE.Vector3>;
  groundDetailScale: THREE.IUniform<THREE.Vector3>;
  groundDetailAmount: THREE.IUniform<THREE.Vector3>;
  groundDetailOctaves: THREE.IUniform<number>;
  groundEdge: THREE.IUniform<THREE.Vector2>;
  groundCrisp: THREE.IUniform<boolean>;
  groundPlain: THREE.IUniform<boolean>;
}

const VERTEX_HEAD = /* glsl */ `
uniform float groundScale;
varying vec3 vGround;`;

const VERTEX_BODY = /* glsl */ `
vGround = transformed * groundScale;`;

const FRAGMENT_HEAD = /* glsl */ `
uniform sampler2D groundShape;
uniform vec2 groundHeights;
uniform sampler2D groundSides;
uniform vec3 groundWet;
uniform vec2 groundCentre;
uniform vec4 groundSlope;
uniform vec2 groundWetBand;
uniform float groundBandHeight;
uniform vec2 groundBandWobble;
uniform vec3 groundStrata;
uniform vec3 groundDetailScale;
uniform vec3 groundDetailAmount;
uniform int groundDetailOctaves;
uniform vec2 groundEdge;
uniform bool groundCrisp;
uniform bool groundPlain;
varying vec3 vGround;

// A hash without sin(), steady on phone GPUs.
float groundHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Value noise in [-1, 1].
float groundNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(groundHash(i), groundHash(i + vec2(1.0, 0.0)), f.x),
    mix(groundHash(i + vec2(0.0, 1.0)), groundHash(i + vec2(1.0, 1.0)), f.x),
    f.y
  ) * 2.0 - 1.0;
}

// 1 where a noise of this frequency still has two pixels a wave, fading to 0 below that.
float groundResolved(float frequency, float unitsPerPixel) {
  return 1.0 - smoothstep(0.25, 0.5, frequency * unitsPerPixel);
}

// A texel's ground (red, plus 128 when sharp rock), smoothed height (green and blue, 16 bits over
// groundHeights) and its ground's share there (alpha).
int groundAt(vec4 shape) {
  return int(shape.r * 255.0 + 0.5) & 127;
}

float groundSharp(vec4 shape) {
  return shape.r > 0.5 ? 1.0 : 0.0;
}

float groundHeight(vec4 shape) {
  return groundHeights.x + (shape.g * 65280.0 + shape.b * 255.0) / 65535.0 * groundHeights.y;
}

// The cliff band at a height, its edges made gently wavy by a broad noise (a fine one, like any
// fine wobble of an edge, reads as teeth).
float groundBand(vec2 p, float height) {
  return floor(height / groundBandHeight + groundNoise(p * groundBandWobble.x) * groundBandWobble.y);
}

// A ground's cliff colour in a band: its row repeats its colours to the texture's width.
vec3 groundSide(int ground, float band) {
  float width = float(textureSize(groundSides, 0).x);
  return texelFetch(groundSides, ivec2(int(mod(band, width)), ground), 0).rgb;
}

// The four texels round texel coordinate t, and their bilinear weights.
void groundCorners(vec2 t, ivec2 size, out ivec2 at[4], out float weight[4]) {
  vec2 corner = t - 0.5;
  ivec2 base = ivec2(floor(corner));
  vec2 f = fract(corner);
  for (int i = 0; i < 4; i++) {
    at[i] = clamp(base + ivec2(i & 1, i >> 1), ivec2(0), size - 1);
    weight[i] = ((i & 1) == 1 ? f.x : 1.0 - f.x) * ((i >> 1) == 1 ? f.y : 1.0 - f.y);
  }
}

// How far a ground has turned to its cliff colours: over the soft slope range, or the sharp one
// for rock grounds (sharp 1).
float groundSteep(float up, float sharp) {
  vec2 range = mix(groundSlope.xy, groundSlope.zw, sharp);
  return smoothstep(range.x, range.y, 1.0 - up);
}

// Faint streaks along a cliff: a factor round 1.
float groundStreaks(vec2 p, float level, float depth) {
  return 1.0 + groundNoise(vec2((p.x + p.y) * groundStrata.x, level * groundStrata.y)) * depth;
}

// The cliff colour at t: the four texels' bands at their smoothed height, blended; in alpha how
// sharp their grounds are.
vec4 groundCliff(vec2 t, ivec2 size, vec2 p, float streakDepth) {
  ivec2 at[4];
  float weight[4];
  groundCorners(t, size, at, weight);
  vec4 shape[4];
  float level = 0.0;
  float sharp = 0.0;
  for (int i = 0; i < 4; i++) {
    shape[i] = texelFetch(groundShape, at[i], 0);
    level += weight[i] * groundHeight(shape[i]);
    sharp += weight[i] * groundSharp(shape[i]);
  }
  float band = groundBand(p, level);
  vec3 side = vec3(0.0);
  for (int i = 0; i < 4; i++) side += weight[i] * groundSide(groundAt(shape[i]), band);
  return vec4(side * groundStreaks(p, level, streakDepth), sharp);
}

// A texel's share of ground g: its own ground's share, or what that leaves (two grounds meet).
float groundShareAt(int g, int ground, float share) {
  return ground == g ? share : 1.0 - share;
}

// The ground with the largest share at the pixel among the four texels' grounds, other than
// ground skip (-1 if there is none).
int groundWinner(int ground[4], float share[4], float weight[4], int skip) {
  int best = -1;
  float most = -1.0;
  for (int i = 0; i < 4; i++) {
    if (ground[i] == skip) continue;
    float total = 0.0;
    for (int j = 0; j < 4; j++) total += weight[j] * groundShareAt(ground[i], ground[j], share[j]);
    if (total > most) {
      most = total;
      best = ground[i];
    }
  }
  return best;
}

// Ground g's colour at the pixel: its texels' colours, bilinear among themselves.
vec3 groundTint(int g, int ground[4], vec3 tint[4], float weight[4]) {
  vec3 sum = vec3(0.0);
  float total = 0.0;
  vec3 fallback = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    if (ground[i] != g) continue;
    sum += tint[i] * weight[i];
    total += weight[i];
    fallback = tint[i];
  }
  return total > 1e-4 ? sum / total : fallback;
}

vec3 groundColour() {
  vec2 p = vGround.xz - groundCentre;
  float height = vGround.y;
  vec2 unitsPerPixel2 = fwidth(p);
  float unitsPerPixel = max(unitsPerPixel2.x, unitsPerPixel2.y);
  ivec2 size = textureSize(map, 0);
  vec2 t = vMapUv * vec2(size);
  vec2 texelsPerPixel2 = fwidth(t);
  float texelsPerPixel = max(texelsPerPixel2.x, texelsPerPixel2.y);
  vec4 filtered = texture2D(map, t / vec2(size));
  float streakDepth = groundStrata.z * groundResolved(groundStrata.y, fwidth(height));

  vec3 colour;
  float steep;
  if (groundPlain) {
    // Ultra-low (decision 0247): the filtered texture, and on slopes the nearest texel's cliff
    // colour in its band by the pixel's height. Two reads, no noise.
    steep = groundSteep(filtered.a, 0.0);
    colour = filtered.rgb;
    if (steep > 0.0) {
      int ground = groundAt(texelFetch(groundShape, clamp(ivec2(t), ivec2(0), size - 1), 0));
      colour = mix(colour, groundSide(ground, floor(height / groundBandHeight)), steep);
    }
  } else if (!groundCrisp || texelsPerPixel > 1.0) {
    // On Low, or far off where a texel is smaller than a pixel: the filtered (mipmapped)
    // texture, its zone edges soft, and the cliff bands only where it slopes.
    // The sharp slope range starts within the soft one, so the soft one says where to look.
    steep = groundSteep(filtered.a, 0.0);
    colour = filtered.rgb;
    if (steep > 0.0) {
      vec4 cliff = groundCliff(t, size, p, streakDepth);
      steep = groundSteep(filtered.a, cliff.a);
      colour = mix(colour, cliff.rgb, steep);
    }
  } else {
    // Close up: the four texels round the pixel. Slope and the bands' smoothed height blend
    // between them (the mesh's own height has grid ripples that make band edges zigzag). Where
    // two grounds meet, the edge is drawn where their shares cross, measured in pixels from the
    // shares' slope, so it runs smooth between texels and stays about a pixel sharp.
    ivec2 at[4];
    float weight[4];
    groundCorners(t, size, at, weight);
    vec3 tint[4];
    int ground[4];
    float share[4];
    float up = 0.0;
    float level = 0.0;
    float sharp = 0.0;
    float sharpest = 0.0;
    for (int i = 0; i < 4; i++) {
      vec4 shape = texelFetch(groundShape, at[i], 0);
      vec4 texel = texelFetch(map, at[i], 0);
      tint[i] = texel.rgb;
      ground[i] = groundAt(shape);
      share[i] = shape.a;
      up += weight[i] * texel.a;
      level += weight[i] * groundHeight(shape);
      sharp += weight[i] * groundSharp(shape);
      sharpest = max(sharpest, groundSharp(shape));
    }
    steep = groundSteep(up, sharp);
    if (steep > 0.0) {
      float band = groundBand(p, level);
      float streaks = groundStreaks(p, level, streakDepth);
      for (int i = 0; i < 4; i++) tint[i] = mix(tint[i], groundSide(ground[i], band) * streaks, steep);
    }
    int a = groundWinner(ground, share, weight, -1);
    int b = groundWinner(ground, share, weight, a);
    if (b < 0) {
      colour = tint[0] * weight[0] + tint[1] * weight[1] + tint[2] * weight[2] + tint[3] * weight[3];
    } else {
      // How far ground a's share leads b's, a bilinear field over the four texels.
      float lead[4];
      for (int i = 0; i < 4; i++) lead[i] = groundShareAt(a, ground[i], share[i]) - groundShareAt(b, ground[i], share[i]);
      vec2 f = vec2(weight[1] + weight[3], weight[2] + weight[3]);
      float ahead = lead[0] * weight[0] + lead[1] * weight[1] + lead[2] * weight[2] + lead[3] * weight[3];
      vec2 slope = vec2(
        mix(lead[1] - lead[0], lead[3] - lead[2], f.y),
        mix(lead[2] - lead[0], lead[3] - lead[1], f.x)
      );
      float texels = ahead / max(length(slope), 1e-4);
      // A rock ground's edges are narrower, whichever side of the edge it is on.
      float halfWidth = 0.5 * max(mix(groundEdge.x, groundEdge.y, sharpest), texelsPerPixel * 1.5);
      colour = mix(
        groundTint(b, ground, tint, weight),
        groundTint(a, ground, tint, weight),
        smoothstep(-halfWidth, halfWidth, texels)
      );
    }
  }

  float detail = 0.0;
  for (int i = 0; i < 3; i++) {
    if (i >= groundDetailOctaves) break;
    float frequency = groundDetailScale[i];
    detail += groundNoise(p * frequency + float(i) * 7.3) * groundDetailAmount[i] *
      groundResolved(frequency, unitsPerPixel);
  }
  colour *= 1.0 + detail * (1.0 - steep);
  return mix(colour, groundWet, 1.0 - smoothstep(groundWetBand.x, groundWetBand.y, height));
}`;

// Replaces the plain map read; the texture's alpha is the slope, so it never reaches the output.
const FRAGMENT_BODY = /* glsl */ `
diffuseColor.rgb *= groundColour();`;

/** `source` with `anchor` replaced, or an error when three.js no longer has that chunk. */
function inject(source: string, anchor: string, replacement: string) {
  if (!source.includes(anchor)) throw new Error(`Ground shader: no ${anchor} to replace`);
  return source.replace(anchor, replacement);
}

/** The Lambert shaders with the ground's colour put in (exported for its test). */
export function groundShaderSources(vertexShader: string, fragmentShader: string) {
  return {
    vertexShader: inject(
      inject(vertexShader, '#include <common>', `#include <common>${VERTEX_HEAD}`),
      '#include <begin_vertex>',
      `#include <begin_vertex>${VERTEX_BODY}`,
    ),
    fragmentShader: inject(
      inject(
        fragmentShader,
        '#include <map_pars_fragment>',
        `#include <map_pars_fragment>${FRAGMENT_HEAD}`,
      ),
      '#include <map_fragment>',
      FRAGMENT_BODY,
    ),
  };
}

const vec3 = (list: readonly number[]) => new THREE.Vector3(list[0], list[1], list[2]);

function groundUniforms(textures: FieldGroundTextures, quality: QualityLevel, scale: number) {
  const draw = TUNING.terrain.draw;
  const { bandWobble, strata, detail, edge } = draw;
  const uniforms: GroundUniforms = {
    groundShape: { value: textures.shape },
    groundHeights: { value: new THREE.Vector2(...textures.heights) },
    groundSides: { value: textures.sides },
    groundWet: { value: new THREE.Color(textures.wet) },
    groundScale: { value: scale },
    groundCentre: { value: new THREE.Vector2(...textures.centre) },
    groundSlope: {
      value: new THREE.Vector4(
        draw.slope[0],
        draw.slope[1],
        draw.sharpSlope[0],
        draw.sharpSlope[1],
      ),
    },
    groundWetBand: { value: new THREE.Vector2(draw.wet[0], draw.wet[1]) },
    groundBandHeight: { value: draw.bands },
    groundBandWobble: { value: new THREE.Vector2(bandWobble.scale, bandWobble.amount) },
    groundStrata: { value: new THREE.Vector3(strata.along, strata.up, strata.amount) },
    groundDetailScale: { value: vec3(detail.scales) },
    groundDetailAmount: { value: vec3(detail.amounts) },
    groundDetailOctaves: { value: detail.octaves[quality] },
    // Edge widths (soft, sharp) in texels.
    groundEdge: {
      value: new THREE.Vector2(edge.width / textures.texel, edge.sharpWidth / textures.texel),
    },
    groundCrisp: { value: edge.crisp[quality] },
    groundPlain: { value: QUALITY[quality].plain },
  };
  return uniforms;
}

/**
 * The material that draws a field's ground from its textures (`fieldGroundTextures`).
 * `scale`: world units per unit of the mesh (the island builder draws a scaled-down island).
 */
export function fieldGroundMaterial(
  textures: FieldGroundTextures,
  quality: QualityLevel,
  scale = 1,
): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ map: textures.colour });
  const uniforms = groundUniforms(textures, quality, scale);
  material.userData.ground = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    Object.assign(shader, groundShaderSources(shader.vertexShader, shader.fragmentShader));
  };
  return material;
}

/**
 * The ground's detail at a quality level: Low drops the finest noise and the crisp zone edges,
 * Ultra-low draws it plain.
 */
export function setFieldGroundQuality(material: THREE.Material, quality: QualityLevel) {
  const uniforms = material.userData.ground as GroundUniforms | undefined;
  if (!uniforms) return;
  uniforms.groundDetailOctaves.value = TUNING.terrain.draw.detail.octaves[quality];
  uniforms.groundCrisp.value = TUNING.terrain.draw.edge.crisp[quality];
  uniforms.groundPlain.value = QUALITY[quality].plain;
}

/** Frees a ground material and its textures (any material: the builder's empty one too). */
export function disposeFieldGround(material: THREE.Material) {
  const uniforms = material.userData.ground as GroundUniforms | undefined;
  uniforms?.groundShape.value.dispose();
  uniforms?.groundSides.value.dispose();
  (material as THREE.MeshLambertMaterial).map?.dispose();
  material.dispose();
}
