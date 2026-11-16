import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/tuning';
import { lampPoolUniforms, placeLampPools, switchLampPools } from '../src/render/lampPools';

const pool = TUNING.graphics.lamps.pool;
const lit = () => lampPoolUniforms().uLampPools.value.filter((p) => p.w > 0);

describe('lamp pools (issue #547)', () => {
  it('lights the lanterns nearest the boat, nearest first', () => {
    const far = Array.from({ length: pool.count }, (_, i) => [100 + i, 4, 0]).flat();
    const positions = new Float32Array([...far, 3, 4, 0, 1, 4, 0]);
    placeLampPools(positions, new THREE.Vector3(), 1);
    expect(lit()).toHaveLength(pool.count);
    expect(lit()[0]!.x).toBe(1);
    expect(lit()[1]!.x).toBe(3);
    expect(lit().some((p) => p.x === 100 + pool.count - 1)).toBe(false);
  });

  it('uses only the lanterns there are', () => {
    placeLampPools(new Float32Array([5, 4, 5]), new THREE.Vector3(), 1);
    expect(lit()).toHaveLength(1);
  });

  it('is dark by day and when switched off', () => {
    const look = lampPoolUniforms().uLampPoolLook.value;
    placeLampPools(new Float32Array([0, 4, 0]), new THREE.Vector3(), 1);
    expect(look.w).toBe(pool.radius);
    placeLampPools(new Float32Array([0, 4, 0]), new THREE.Vector3(), 0);
    expect(look.w).toBe(0);
    switchLampPools(false);
    placeLampPools(new Float32Array([0, 4, 0]), new THREE.Vector3(), 1);
    expect(look.w).toBe(0);
    switchLampPools(true);
  });
});
