import * as THREE from 'three';
import { TUNING } from '../../data/tuning';
import { type GroundCover, styleColor } from '../../data/grounds';
import type { QualityLevel } from '../quality';

/**
 * The ground's small cover (issue #499, decision 0298): grass clumps and tufts with dry patches,
 * wind ripples and grit on sand. Each is a faint tint of the zone's colour and a bump that leans
 * the normal, so the relief catches the sun without a texture or a triangle. Which grounds wear
 * it is palette data (`grounds.*.cover`), its numbers are `terrain.json › draw.cover`. Each layer
 * fades out before one of its waves is under two pixels, and cliffs keep their strata only.
 * Settings › Ground detail switches it off (`?bench&off=cover` on a device).
 */

/** The shader's cover inputs. Grounds are bit masks by their index in the field (128 at most). */
export interface CoverUniforms {
  groundCover: THREE.IUniform<boolean>;
  groundCoverGrass: THREE.IUniform<THREE.Vector4>;
  groundCoverDry: THREE.IUniform<THREE.Vector4>;
  groundCoverSand: THREE.IUniform<THREE.Vector4>;
  groundGrassScale: THREE.IUniform<THREE.Vector3>;
  groundGrassTint: THREE.IUniform<THREE.Vector3>;
  groundGrassHeight: THREE.IUniform<THREE.Vector3>;
  groundDry: THREE.IUniform<THREE.Vector4>;
  groundDryColour: THREE.IUniform<THREE.Color>;
  groundRipples: THREE.IUniform<THREE.Vector4>;
  groundSand: THREE.IUniform<THREE.Vector3>;
}

/** Whether a quality level draws the cover. */
export const coverOn = (quality: QualityLevel) => TUNING.terrain.draw.cover.on[quality];

/**
 * Every ground material's cover switch: one object, so the view flips them all at once. On until
 * a view says otherwise (the island builder has none and draws High).
 */
const COVER_SWITCH: THREE.IUniform<boolean> = { value: true };

/** Draws the cover or not: the level's own choice and the player's Settings switch. */
export function setGroundCover(quality: QualityLevel, switchedOn: boolean) {
  COVER_SWITCH.value = switchedOn && coverOn(quality);
}

/** The grounds (by index) that pass `wears`, as four 32-bit masks. */
function coverMask(covers: readonly GroundCover[], wears: (cover: GroundCover) => boolean) {
  const bits = [0, 0, 0, 0];
  covers.forEach((cover, g) => {
    if (wears(cover)) bits[g >> 5]! |= 1 << (g & 31);
  });
  return new THREE.Vector4(...bits);
}

/** The cover inputs of a field whose grounds wear `covers` (one per ground, in its order). */
export function coverUniforms(covers: readonly GroundCover[]) {
  const { grass, dry, ripples, grit } = TUNING.terrain.draw.cover;
  const layers = [grass.clumps, grass.tufts, grass.blades];
  const heading = THREE.MathUtils.degToRad(ripples.heading);
  const turns = (2 * Math.PI) / ripples.length;
  const uniforms: CoverUniforms = {
    groundCover: COVER_SWITCH,
    groundCoverGrass: { value: coverMask(covers, (c) => c === 'grass' || c === 'heath') },
    groundCoverDry: { value: coverMask(covers, (c) => c === 'grass') },
    groundCoverSand: { value: coverMask(covers, (c) => c === 'sand') },
    groundGrassScale: { value: new THREE.Vector3(...layers.map((l) => l.scale)) },
    groundGrassTint: { value: new THREE.Vector3(...layers.map((l) => l.tint)) },
    groundGrassHeight: { value: new THREE.Vector3(...layers.map((l) => l.height)) },
    groundDry: { value: new THREE.Vector4(dry.scale, dry.from, dry.to, dry.amount) },
    groundDryColour: { value: new THREE.Color(styleColor('drygrass', '') as string) },
    // The ripples' wave vector (radians a unit), then their wobble's scale and reach (radians).
    groundRipples: {
      value: new THREE.Vector4(
        Math.cos(heading) * turns,
        Math.sin(heading) * turns,
        ripples.wobbleScale,
        ripples.wobble,
      ),
    },
    groundSand: { value: new THREE.Vector3(ripples.height, grit.scale, grit.tint) },
  };
  return uniforms;
}

/** Declared after the ground's noises, before `groundColour`. */
export const COVER_HEAD = /* glsl */ `
uniform bool groundCover;
uniform ivec4 groundCoverGrass;
uniform ivec4 groundCoverDry;
uniform ivec4 groundCoverSand;
uniform vec3 groundGrassScale;
uniform vec3 groundGrassTint;
uniform vec3 groundGrassHeight;
uniform vec4 groundDry;
uniform vec3 groundDryColour;
uniform vec4 groundRipples;
uniform vec3 groundSand;

// The slope of the cover's relief along world x and z; the lit normal leans against it.
vec2 groundBump = vec2(0.0);

float groundInMask(ivec4 mask, int g) {
  return float((mask[g >> 5] >> (g & 31)) & 1);
}

// How much a ground wears grass relief (x), dry patches (y) and sand ripples (z): 0 or 1.
vec3 groundCoverOf(int g) {
  return vec3(
    groundInMask(groundCoverGrass, g),
    groundInMask(groundCoverDry, g),
    groundInMask(groundCoverSand, g)
  );
}

// The colour under its cover (wear: grass, dry, sand shares), and the cover's slope in groundBump.
vec3 groundCovered(vec3 colour, vec2 p, vec3 wear, float unitsPerPixel) {
  if (wear.x > 0.0) {
    // Grass: clumps, tufts and blades, each a noise whose value tints and whose slope bumps.
    float tint = 0.0;
    vec2 slope = vec2(0.0);
    for (int i = 0; i < 3; i++) {
      float frequency = groundGrassScale[i];
      float seen = groundResolved(frequency, unitsPerPixel);
      if (seen <= 0.0) continue;
      vec3 noise = groundNoiseD(p * frequency + float(i) * 3.7 + 9.2);
      tint += noise.x * groundGrassTint[i] * seen;
      slope += noise.yz * (frequency * groundGrassHeight[i] * seen);
    }
    colour *= 1.0 + tint * wear.x;
    groundBump += slope * wear.x;
  }
  if (wear.y > 0.0) {
    // Dry patches: broad soft blobs of warm grass.
    float dry = smoothstep(groundDry.y, groundDry.z, groundNoise(p * groundDry.x + 1.7));
    colour = mix(
      colour,
      groundDryColour,
      dry * groundDry.w * wear.y * groundResolved(groundDry.x, unitsPerPixel)
    );
  }
  if (wear.z > 0.0) {
    // Sand: wind ripples (bump only), their crests bent by a broad noise, and a faint grit.
    float seen = groundResolved(length(groundRipples.xy) / 6.2832, unitsPerPixel);
    if (seen > 0.0) {
      vec3 wobble = groundNoiseD(p * groundRipples.z);
      float phase = dot(p, groundRipples.xy) + wobble.x * groundRipples.w;
      vec2 along = groundRipples.xy + wobble.yz * (groundRipples.z * groundRipples.w);
      groundBump += along * (cos(phase) * groundSand.x * seen * wear.z);
    }
    float grit = groundNoise(p * groundSand.y + 4.4) * groundResolved(groundSand.y, unitsPerPixel);
    colour *= 1.0 + grit * groundSand.z * wear.z;
  }
  return colour;
}`;

/** After three.js has the pixel's normal: lean it against the cover's slope. */
export const COVER_NORMAL = /* glsl */ `
normal = normalize(normal - mat3(viewMatrix) * vec3(groundBump.x, 0.0, groundBump.y));`;
