import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { TUNING } from '../src/data/tuning';
import type { QualityLevel } from '../src/render/quality';
import { effectSwitches } from '../src/ui/graphicsSettings';
import type { Settings } from '../src/ui/settings';
import type { FieldGroundTextures } from '../src/render/models/fieldGround';
import { setGroundCover } from '../src/render/models/fieldGroundCover';
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
  covers: ['grass', 'sand', 'none', 'heath'],
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
    expect(u.groundSlope!.value.toArray()).toEqual([...draw.slope, ...draw.sharpSlope]);
    // The sharp range starts within the soft one: the shader's soft test says where to look.
    expect(draw.sharpSlope[0]).toBeGreaterThanOrEqual(draw.slope[0]!);
    expect(u.groundEdge!.value.y).toBeCloseTo(draw.edge.sharpWidth / 0.4, 6);
    expect(u.groundEdge!.value.x).toBeCloseTo(draw.edge.width / 0.4, 6);
    expect(u.groundCentre!.value.toArray()).toEqual([10, -20]);
    expect(u.groundDetailOctaves!.value).toBe(draw.detail.octaves.high);
  });

  it('drops the finest detail and crisp edges on Low, and frees every texture', () => {
    const t = textures();
    const material = fieldGroundMaterial(t, 'high');
    const u = compiled(material).uniforms;
    setFieldGroundQuality(material, 'low');
    expect(u.groundDetailOctaves!.value).toBe(TUNING.terrain.draw.detail.octaves.low);
    expect(TUNING.terrain.draw.detail.octaves.low).toBeLessThan(
      TUNING.terrain.draw.detail.octaves.high,
    );
    expect(u.groundCrisp!.value).toBe(TUNING.terrain.draw.edge.crisp.low);
    const spies = [t.colour, t.shape, t.sides].map((x) => vi.spyOn(x, 'dispose'));
    disposeFieldGround(material);
    for (const spy of spies) expect(spy).toHaveBeenCalled();
    // Any material: the builder's empty one too.
    expect(() => disposeFieldGround(new THREE.MeshLambertMaterial())).not.toThrow();
  });

  describe('its cover on grass and sand (issue #499)', () => {
    const { cover } = TUNING.terrain.draw;

    it('leans the lit normal against the cover’s bump, after three.js’s own normal', () => {
      const { fragmentShader } = compiled(fieldGroundMaterial(textures(), 'high'));
      const own = fragmentShader.indexOf('#include <normal_fragment_maps>');
      expect(own).toBeGreaterThan(-1);
      expect(fragmentShader.indexOf('normal = normalize(normal - ')).toBeGreaterThan(own);
    });

    it('says which grounds wear grass, dry patches and sand as bit masks', () => {
      // The fixture's grounds: grass, sand, none, heath.
      const u = compiled(fieldGroundMaterial(textures(), 'high')).uniforms;
      expect(u.groundCoverGrass!.value.toArray()).toEqual([0b1001, 0, 0, 0]);
      expect(u.groundCoverDry!.value.toArray()).toEqual([0b0001, 0, 0, 0]);
      expect(u.groundCoverSand!.value.toArray()).toEqual([0b0010, 0, 0, 0]);
    });

    it('reaches every ground a field can hold', () => {
      const covers = Array.from({ length: 128 }, (_, g) =>
        g === 127 ? ('sand' as const) : ('none' as const),
      );
      const u = compiled(fieldGroundMaterial({ ...textures(), covers }, 'high')).uniforms;
      expect(u.groundCoverSand!.value.toArray()).toEqual([0, 0, 0, 1 << 31]);
    });

    it('is drawn on High and Ultra only, and follows the level and its Settings switch', () => {
      expect(cover.on).toMatchObject({ ultralow: false, low: false, high: true, ultra: true });
      const u = compiled(fieldGroundMaterial(textures(), 'high')).uniforms;
      // On before any view speaks (the island builder), then the level and the Settings switch.
      expect(u.groundCover!.value).toBe(true);
      setGroundCover('low', true);
      expect(u.groundCover!.value).toBe(false);
      setGroundCover('ultra', false);
      expect(u.groundCover!.value).toBe(false);
      setGroundCover('ultra', true);
      expect(u.groundCover!.value).toBe(true);
    });

    it('takes its numbers from terrain.json, ripples as a wave vector', () => {
      const u = compiled(fieldGroundMaterial(textures(), 'high')).uniforms;
      const { grass, ripples } = cover;
      expect(u.groundGrassScale!.value.toArray()).toEqual([
        grass.clumps.scale,
        grass.tufts.scale,
        grass.blades.scale,
      ]);
      const wave = u.groundRipples!.value;
      expect(Math.hypot(wave.x, wave.y)).toBeCloseTo((2 * Math.PI) / ripples.length, 6);
      expect(u.groundDry!.value.toArray()).toEqual([
        cover.dry.scale,
        cover.dry.from,
        cover.dry.to,
        cover.dry.amount,
      ]);
    });

    it('has a Settings switch on the levels that draw it', () => {
      const settings = { effects: {} } as Settings;
      let level: QualityLevel = 'high';
      const row = effectSwitches(
        settings,
        () => level,
        () => {},
      ).find((s) => s.id === 'fx-groundCover')!;
      expect(row.hidden!()).toBe(false);
      expect(row.get()).toBe(true);
      row.set(false);
      expect(settings.effects.groundCover).toBe(false);
      level = 'low';
      expect(row.hidden!()).toBe(true);
    });

    it('stays inside the art director’s limits (docs/v1.8/brief.md)', () => {
      const { clumps, tufts, blades } = cover.grass;
      // Tints at most 6% off the zone colour.
      expect(clumps.tint + tufts.tint + blades.tint).toBeLessThanOrEqual(0.06 + 1e-9);
      expect(cover.grit.tint).toBeLessThanOrEqual(0.06);
      // Dry patches on a fifth of a grass zone at most: the noise passes 0.4 on a fifth of it.
      expect(cover.dry.from).toBeGreaterThanOrEqual(0.4);
      expect(cover.dry.to).toBeGreaterThan(cover.dry.from);
    });
  });
});
