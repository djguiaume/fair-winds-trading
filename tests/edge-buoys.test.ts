import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EdgeBuoys } from '../src/render/props';
import { MAX_WAVE_HEIGHT, waveHeight } from '../src/render/ocean';
import { resetTuning, TUNING } from '../src/data/tuning';

afterEach(resetTuning);

function cameraAt(x: number, y: number, z: number, aspect = 1, fov = 45) {
  const camera = new THREE.PerspectiveCamera(fov, aspect, 1, 5000);
  camera.position.set(x, y, z);
  camera.lookAt(x, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

describe('boundary buoy culling', () => {
  it('does no wave, matrix or upload work when the boundary is off screen', () => {
    const buoys = new EdgeBuoys(1000);
    const water = vi.fn(waveHeight);
    const matrix = vi.spyOn(buoys.mesh, 'setMatrixAt');
    const version = buoys.mesh.instanceMatrix.version;
    buoys.update(10, (x, z) => water(x, z, 10), cameraAt(0, 50, 50));
    expect(buoys.mesh.count).toBe(0);
    expect(water).not.toHaveBeenCalled();
    expect(matrix).not.toHaveBeenCalled();
    expect(buoys.mesh.instanceMatrix.version).toBe(version);
    buoys.dispose();
  });

  it('uploads only the visible prefix and restores newly visible buoys at current time', () => {
    const buoys = new EdgeBuoys(1000);
    const all = buoys.mesh.instanceMatrix.count;
    const camera = cameraAt(1000, 50, 50);
    buoys.update(100, (x, z) => waveHeight(x, z, 100), camera);
    expect(buoys.mesh.count).toBeGreaterThan(0);
    expect(buoys.mesh.count).toBeLessThan(all / 4);
    expect(buoys.mesh.instanceMatrix.updateRanges).toEqual([
      { start: 0, count: buoys.mesh.count * 16 },
    ]);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    for (let i = 0; i < buoys.mesh.count; i++) {
      buoys.mesh.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix);
      expect(position.y).toBeCloseTo(
        waveHeight(position.x, position.z, 100) + TUNING.seamanship.boundaryBuoys.waterline,
        4,
      );
    }
    buoys.update(101, (x, z) => waveHeight(x, z, 101), cameraAt(0, 50, 50));
    expect(buoys.mesh.count).toBe(0);
    expect(buoys.mesh.instanceMatrix.updateRanges).toEqual([]);
    buoys.update(200, (x, z) => waveHeight(x, z, 200), camera);
    expect(buoys.mesh.count).toBeGreaterThan(0);
    buoys.dispose();
  });

  it('keeps every in-frame animated vertex across aspect ratios, zooms and live bob tuning', () => {
    const buoys = new EdgeBuoys(150);
    const tuning = TUNING.seamanship.boundaryBuoys;
    tuning.rockRadians = 1;
    tuning.waterline = 3;
    const positions = buoys.mesh.geometry.getAttribute('position');
    const pose = new THREE.Object3D();
    const point = new THREE.Vector3();
    const matrix = new THREE.Matrix4();
    const frustum = new THREE.Frustum();
    const radius = 150 + tuning.offset;
    const count = buoys.mesh.instanceMatrix.count;
    for (const aspect of [0.4, 1, 2.5]) {
      for (const height of [20, 100, 400]) {
        const camera = cameraAt(150, height, height, aspect);
        frustum.setFromProjectionMatrix(
          matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
        );
        for (const time of [0, 12, 101]) {
          buoys.update(time, (x, z) => waveHeight(x, z, time), camera);
          const visible = new Set<string>();
          for (let i = 0; i < buoys.mesh.count; i++) {
            buoys.mesh.getMatrixAt(i, matrix);
            visible.add(
              `${Math.round(matrix.elements[12]! * 100)},${Math.round(matrix.elements[14]! * 100)}`,
            );
          }
          for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const phase = i * tuning.phaseStep;
            pose.position.set(x, waveHeight(x, z, time) + tuning.waterline, z);
            pose.rotation.set(
              Math.sin(time * tuning.pitchRate + phase) * tuning.rockRadians,
              0,
              Math.cos(time * tuning.rollRate + phase) * tuning.rockRadians,
            );
            pose.updateMatrix();
            for (let j = 0; j < positions.count; j++) {
              point.fromBufferAttribute(positions, j).applyMatrix4(pose.matrix);
              if (frustum.containsPoint(point)) {
                expect(visible.has(`${Math.round(x * 100)},${Math.round(z * 100)}`)).toBe(true);
                break;
              }
            }
          }
        }
      }
    }
    buoys.dispose();
  });

  it('bounds the ocean displacement used by culling', () => {
    for (let i = 0; i < 10000; i++) {
      expect(Math.abs(waveHeight(i * 3.1, i * -7.3, i * 0.37))).toBeLessThanOrEqual(
        MAX_WAVE_HEIGHT,
      );
    }
  });
});
