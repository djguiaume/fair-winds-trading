import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import palette from '../src/data/palette.json';
import { newRamp, seaRampAt } from '../src/render/seaWater';

const hex = (c: string) => new THREE.Color(c);

describe('per-sea horizon haze (#276)', () => {
  it('every sea has a light, blue-leaning horizon tint, never grey', () => {
    for (const [id, colors] of Object.entries(palette.water)) {
      const c = hex(colors.horizon);
      expect(c.b, id).toBeGreaterThan(c.r);
      expect(c.b - c.r, id).toBeGreaterThan(0.05);
    }
  });

  it('the ring reads its own tint, and a sea blends to the next over the border', () => {
    const ring = seaRampAt(0, 0, newRamp());
    expect(ring.horizon.getHexString()).toBe(hex(palette.water.ring.horizon).getHexString());
    const east = seaRampAt(900, 0, newRamp());
    expect(east.horizon.getHexString()).toBe(hex(palette.water.east.horizon).getHexString());
  });
});
