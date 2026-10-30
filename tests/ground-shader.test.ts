import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { TUNING } from '../src/data/tuning';
import type { FieldGroundTextures } from '../src/render/models/fieldGround';
import {
  disposeFieldGround,
  fieldGroundMaterial,
  groundShaderSources,
  setFieldGroundQuality,
} from '../src/render/models/fieldGroundShader';

const texture = () => new THREE.DataTexture(new Uint8Array(4), 1, 1);
const textures = (): FieldGroundTextures => ({
  colour: texture(),
  shape: texture(),
  heights: [-3.5, 40],
  sides: texture(),
  wet: '#d9bf86',
  texel: 0.4,
  centre: [10, -20],
});

/** The material's shader as three.js would compile it. */
function compiled(material: THREE.Material) {
  const { vertexShader, fragmentShader } = THREE.ShaderLib.lambert;
  const shader = {
    vertexShader,
    fragmentShader,
    uniforms: {},
  } as unknown as THREE.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
}

describe('the ground shader (issue #373)', () => {
  it('puts its colour into three.js’s Lambert shaders in place of the plain map read', () => {
    const shader = compiled(fieldGroundMaterial(textures(), 'high'));
    expect(shader.vertexShader).toContain('vGround = transformed * groundScale;');
    expect(shader.fragmentShader).toContain('diffuseColor.rgb *= groundColour();');
    expect(shader.fragmentShader).not.toContain('#include <map_fragment>');
    // Declared after the map, which it reads.
    const fragment = shader.fragmentShader;
    expect(fragment.indexOf('vec3 groundColour()')).toBeGreaterThan(
      fragment.indexOf('#include <map_pars_fragment>'),
    );
  });

  it('fails loudly when three.js drops a chunk it replaces', () => {
    expect(() =>
      groundShaderSources('void main() {}', THREE.ShaderLib.lambert.fragmentShader),
    ).toThrow(/common/);
  });

  it('takes its numbers from terrain.json, edge sizes in texels', () => {
    const shader = compiled(fieldGroundMaterial(textures(), 'high', 2));
    const u = shader.uniforms;
    const { draw } = TUNING.terrain;
    expect(u.groundScale!.value).toBe(2);
    expect(u.groundBandHeight!.value).toBe(draw.bands);
    expect(u.groundSlope!.value.toArray()).toEqual(draw.slope);
    expect(u.groundEdge!.value.x).toBeCloseTo(draw.edge.width / 0.4, 6);
    expect(u.groundCentre!.value.toArray()).toEqual([10, -20]);
    expect(u.groundDetailOctaves!.value).toBe(draw.detail.octaves.high);
  });

  it('drops the finest detail on Low, and frees every texture', () => {
    const t = textures();
    const material = fieldGroundMaterial(t, 'high');
    const u = compiled(material).uniforms;
    setFieldGroundQuality(material, 'low');
    expect(u.groundDetailOctaves!.value).toBe(TUNING.terrain.draw.detail.octaves.low);
    expect(TUNING.terrain.draw.detail.octaves.low).toBeLessThan(
      TUNING.terrain.draw.detail.octaves.high,
    );
    const spies = [t.colour, t.shape, t.sides].map((x) => vi.spyOn(x, 'dispose'));
    disposeFieldGround(material);
    for (const spy of spies) expect(spy).toHaveBeenCalled();
    // Any material: the builder's empty one too.
    expect(() => disposeFieldGround(new THREE.MeshLambertMaterial())).not.toThrow();
  });
});
