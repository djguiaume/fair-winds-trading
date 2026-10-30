import * as THREE from 'three';
import { TUNING } from '../../data/tuning';
import type { QualityLevel } from '../quality';
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
  groundSlope: THREE.IUniform<THREE.Vector2>;
  groundWetBand: THREE.IUniform<THREE.Vector2>;
  groundBandHeight: THREE.IUniform<number>;
  groundBandWobble: THREE.IUniform<THREE.Vector4>;
  groundStrata: THREE.IUniform<THREE.Vector3>;
  groundDetailScale: THREE.IUniform<THREE.Vector3>;
  groundDetailAmount: THREE.IUniform<THREE.Vector3>;
  groundDetailOctaves: THREE.IUniform<number>;
  groundEdge: THREE.IUniform<THREE.Vector3>;
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
uniform vec2 groundSlope;
uniform vec2 groundWetBand;
uniform float groundBandHeight;
uniform vec4 groundBandWobble;
uniform vec3 groundStrata;
uniform vec3 groundDetailScale;
uniform vec3 groundDetailAmount;
uniform int groundDetailOctaves;
uniform vec3 groundEdge;
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

// A texel's ground (red) and smoothed height (green and blue, 16 bits over groundHeights).
int groundAt(vec4 shape) {
  return int(shape.r * 255.0 + 0.5);
}

float groundHeight(vec4 shape) {
  return groundHeights.x + (shape.g * 65280.0 + shape.b * 255.0) / 65535.0 * groundHeights.y;
}

// The cliff band at a height, its edges made wavy by two noises.
float groundBand(vec2 p, float height) {
  return floor(
    height / groundBandHeight +
    groundNoise(p * groundBandWobble.x) * groundBandWobble.y +
    groundNoise(p * groundBandWobble.z) * groundBandWobble.w
  );
}

// A ground's cliff colour in a band: its row repeats its colours to the texture's width.
vec3 groundSide(int ground, float band) {
  float width = float(textureSize(groundSides, 0).x);
  return texelFetch(groundSides, ivec2(int(mod(band, width)), ground), 0).rgb;
}

vec3 groundColour() {
  vec2 p = vGround.xz - groundCentre;
  float height = vGround.y;
  vec2 unitsPerPixel2 = fwidth(p);
  float unitsPerPixel = max(unitsPerPixel2.x, unitsPerPixel2.y);
  ivec2 size = textureSize(map, 0);
  // Zone edges wander a little between texels, so they never follow the texture's grid.
  vec2 warp = vec2(groundNoise(p * groundEdge.y), groundNoise(p * groundEdge.y + 19.7));
  vec2 t = vMapUv * vec2(size) + warp * groundEdge.z;
  vec2 texelsPerPixel2 = fwidth(t);
  float texelsPerPixel = max(texelsPerPixel2.x, texelsPerPixel2.y);
  vec4 filtered = texture2D(map, t / vec2(size));

  float strataDepth = groundStrata.z * groundResolved(groundStrata.y, fwidth(height));

  vec3 colour;
  float steep;
  if (texelsPerPixel > 1.0) {
    // Far off a texel is smaller than a pixel: the mipmapped texture, and the nearest ground's bands.
    steep = smoothstep(groundSlope.x, groundSlope.y, 1.0 - filtered.a);
    colour = filtered.rgb;
    if (steep > 0.0) {
      vec4 shape = texelFetch(groundShape, clamp(ivec2(t), ivec2(0), size - 1), 0);
      float strata = 1.0 + groundNoise(vec2((p.x + p.y) * groundStrata.x, height * groundStrata.y)) * strataDepth;
      colour = mix(colour, groundSide(groundAt(shape), groundBand(p, height)) * strata, steep);
    }
  } else {
    // Close up: the four texels round the pixel. Slope and the bands' smoothed height blend
    // between them (the mesh's own height has grid ripples that make band edges zigzag); each colour is
    // weighed up by its ground's share of the pixel, so the larger zone wins and the edge between
    // two grounds is a thin line, never thinner than about a pixel.
    vec2 corner = t - 0.5;
    ivec2 base = ivec2(floor(corner));
    vec2 f = fract(corner);
    vec4 texel[4];
    int ground[4];
    float weight[4];
    float up = 0.0;
    float level = 0.0;
    for (int i = 0; i < 4; i++) {
      ivec2 at = clamp(base + ivec2(i & 1, i >> 1), ivec2(0), size - 1);
      vec4 shape = texelFetch(groundShape, at, 0);
      texel[i] = texelFetch(map, at, 0);
      ground[i] = groundAt(shape);
      weight[i] = ((i & 1) == 1 ? f.x : 1.0 - f.x) * ((i >> 1) == 1 ? f.y : 1.0 - f.y);
      up += weight[i] * texel[i].a;
      level += weight[i] * groundHeight(shape);
    }
    steep = smoothstep(groundSlope.x, groundSlope.y, 1.0 - up);
    float band = groundBand(p, level);
    float strata = 1.0 + groundNoise(vec2((p.x + p.y) * groundStrata.x, level * groundStrata.y)) * strataDepth;
    float share[4];
    float most = 0.0;
    for (int i = 0; i < 4; i++) {
      share[i] = 0.0;
      for (int j = 0; j < 4; j++) share[i] += ground[j] == ground[i] ? weight[j] : 0.0;
      most = max(most, share[i]);
    }
    float sharpness = 2.2 / max(groundEdge.x, texelsPerPixel * 1.5);
    vec3 sum = vec3(0.0);
    float total = 0.0;
    for (int i = 0; i < 4; i++) {
      float w = weight[i] * exp(sharpness * (share[i] - most));
      vec3 c = texel[i].rgb;
      if (steep > 0.0) c = mix(c, groundSide(ground[i], band) * strata, steep);
      sum += c * w;
      total += w;
    }
    colour = sum / total;
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
    groundSlope: { value: new THREE.Vector2(draw.slope[0], draw.slope[1]) },
    groundWetBand: { value: new THREE.Vector2(draw.wet[0], draw.wet[1]) },
    groundBandHeight: { value: draw.bands },
    groundBandWobble: {
      value: new THREE.Vector4(
        bandWobble.scales[0],
        bandWobble.amounts[0],
        bandWobble.scales[1],
        bandWobble.amounts[1],
      ),
    },
    groundStrata: { value: new THREE.Vector3(strata.along, strata.up, strata.amount) },
    groundDetailScale: { value: vec3(detail.scales) },
    groundDetailAmount: { value: vec3(detail.amounts) },
    groundDetailOctaves: { value: detail.octaves[quality] },
    // Edge width and wander in texels; the wander's frequency per unit.
    groundEdge: {
      value: new THREE.Vector3(
        edge.width / textures.texel,
        edge.warpScale,
        edge.warp / textures.texel,
      ),
    },
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

/** The ground's detail at a quality level: Low drops the finest noise. */
export function setFieldGroundQuality(material: THREE.Material, quality: QualityLevel) {
  const uniforms = material.userData.ground as GroundUniforms | undefined;
  if (uniforms) uniforms.groundDetailOctaves.value = TUNING.terrain.draw.detail.octaves[quality];
}

/** Frees a ground material and its textures (any material: the builder's empty one too). */
export function disposeFieldGround(material: THREE.Material) {
  const uniforms = material.userData.ground as GroundUniforms | undefined;
  uniforms?.groundShape.value.dispose();
  uniforms?.groundSides.value.dispose();
  (material as THREE.MeshLambertMaterial).map?.dispose();
  material.dispose();
}
