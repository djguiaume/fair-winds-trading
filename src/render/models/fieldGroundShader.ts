import * as THREE from 'three';
import { TUNING } from '../../data/tuning';
import { QUALITY, type QualityLevel } from '../quality';
import type { FieldGroundTextures } from './fieldGround';
import { FRAGMENT_BODY, FRAGMENT_HEAD, VERTEX_BODY, VERTEX_HEAD } from './fieldGroundGlsl';
import { SHORE_WASH_UNIFORMS } from '../shoreWash';

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
    // The wash's uniforms are the ocean's own objects, written once a frame (issue #397).
    Object.assign(shader.uniforms, uniforms, SHORE_WASH_UNIFORMS);
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
