import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { QUALITY, ultraCapable } from '../src/render/quality';
import { ShadowCasters } from '../src/render/shadowCasters';
import { leanShadowMap } from '../src/render/shadowTarget';
import { drawsBelowUltra } from '../src/render/ultraPipeline';
import { GradeShader } from '../src/render/gradeShader';
import { bloomSizes } from '../src/render/ultraBloom';
import { TUNING } from '../src/data/tuning';
import { applyGraphicsOverrides } from '../src/perf/graphicsOverrides';

describe('Ultra quality (decision 0221)', () => {
  it('is guessed only for a real graphics card with enough cores', () => {
    expect(ultraCapable('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)', 8)).toBe(true);
    expect(ultraCapable('ANGLE (AMD, AMD Radeon RX 6800 Direct3D11)', 8)).toBe(true);
    expect(ultraCapable('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)', 8)).toBe(false);
    expect(ultraCapable('ANGLE (Intel, Intel(R) Iris(R) Plus Graphics Direct3D11)', 8)).toBe(false);
    expect(ultraCapable('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11)', 8)).toBe(true);
    expect(ultraCapable('Google SwiftShader', 16)).toBe(false);
    expect(ultraCapable('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)', 4)).toBe(false);
    expect(ultraCapable('', 8)).toBe(false);
  });

  it('leaves Low, Medium and High without the Ultra pipeline, and Low and Medium without reflection', () => {
    expect(QUALITY.ultra.ultra).toBe(true);
    for (const level of ['low', 'medium', 'high'] as const)
      expect(QUALITY[level].ultra).toBe(false);
    expect(QUALITY.low.waterReflection || QUALITY.medium.waterReflection).toBe(false);
  });

  it('casts shadows from every lit solid mesh, lists the rest, and puts flags back', () => {
    const scene = new THREE.Scene();
    const house = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial());
    const ground = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial());
    ground.castShadow = ground.receiveShadow = true;
    const glow = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    const cloud = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshLambertMaterial({ transparent: true }),
    );
    scene.add(house, ground, glow, cloud);
    const casters = new ShadowCasters();
    casters.update(0, scene, true);
    expect([house.castShadow, house.receiveShadow, ground.castShadow]).toEqual([true, true, true]);
    expect(cloud.castShadow).toBe(false);
    expect(casters.unlit).toEqual([glow, cloud]);
    casters.restore(scene);
    expect([house.castShadow, house.receiveShadow]).toEqual([false, false]);
    expect([ground.castShadow, ground.receiveShadow]).toEqual([true, true]);
  });

  it('keeps a lean shadow map: one-byte colour, 16-bit depth set up for PCF', () => {
    const map = leanShadowMap(4096, false);
    expect([map.width, map.height]).toEqual([4096, 4096]);
    expect(map.texture.format).toBe(THREE.RedFormat);
    expect(map.texture.type).toBe(THREE.UnsignedByteType);
    const depth = map.depthTexture!;
    expect(depth.type).toBe(THREE.UnsignedShortType);
    expect(depth.format).toBe(THREE.DepthFormat);
    expect(depth.compareFunction).toBe(THREE.LessEqualCompare);
    expect(leanShadowMap(1024, true).depthTexture!.compareFunction).toBe(THREE.GreaterEqualCompare);
  });

  it('draws every level through the pipeline on a canvas made for Ultra (decision 0297)', () => {
    const ultraCanvas = { antialias: false, depth: false };
    expect(drawsBelowUltra(ultraCanvas, { antialias: true })).toBe(true);
    expect(drawsBelowUltra(ultraCanvas, { antialias: false })).toBe(true);
    // A canvas made for another level draws itself, unless the level wants anti-aliasing it lacks.
    expect(drawsBelowUltra({ antialias: true, depth: true }, { antialias: true })).toBe(false);
    expect(drawsBelowUltra({ antialias: false, depth: true }, { antialias: false })).toBe(false);
    expect(drawsBelowUltra({ antialias: false, depth: true }, { antialias: true })).toBe(true);
  });

  it('grades, multiplies in the occlusion and writes sRGB in one pass', () => {
    expect(GradeShader.uniforms.tOcclusion).toBeDefined();
    expect(GradeShader.fragmentShader).toContain('#include <colorspace_fragment>');
  });

  it('blurs the bloom in a chain of small pictures, the first at half the screen', () => {
    expect(bloomSizes(2564, 1442, 4)).toEqual([
      [1282, 721],
      [641, 361],
      [321, 180],
      [160, 90],
    ]);
    expect(bloomSizes(3, 1, 2)).toEqual([
      [2, 1],
      [1, 1],
    ]);
    // Half-float RGBA, 8 bytes a pixel: the whole chain stays near 10 MB on a 4K TV.
    const bytes = bloomSizes(2564, 1442, 5).reduce((sum, [w, h]) => sum + w * h * 8, 0);
    expect(bytes / 1048576).toBeLessThan(10);
  });

  it('adds the bloom in the grade pass, by day only above what sails and foam reach', () => {
    expect(GradeShader.uniforms.tBloom).toBeDefined();
    expect(GradeShader.uniforms.uBloom.value).toBe(0);
    const bloom = TUNING.graphics.ultra.bloom;
    expect(bloom.threshold - bloom.knee).toBeGreaterThanOrEqual(0.95);
    expect(bloom.nightThreshold).toBeLessThan(bloom.threshold);
    expect(Number.isInteger(bloom.levels)).toBe(true);
  });

  it('switches the bloom off for a device test with ?off=bloom', () => {
    const settings = { quality: 'auto' as const, effects: {}, seaLife: true, townFolk: true };
    expect(applyGraphicsOverrides('?off=bloom', settings)).toBe(true);
    expect(settings.effects).toEqual({ bloom: false });
  });
});
