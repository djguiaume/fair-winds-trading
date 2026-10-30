import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { QUALITY, ultraCapable } from '../src/render/quality';
import { ShadowCasters } from '../src/render/shadowCasters';

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
});
