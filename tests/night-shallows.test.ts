import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { dimShallow } from '../src/render/seaWater';

const look = { darken: 0.3, desaturate: 0.5 };
const night = new THREE.Color(0.4, 0.5, 0.6);
const lum = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const sat = (c: THREE.Color) => c.getHSL({ h: 0, s: 0, l: 0 }).s;

describe('night shallows (#277)', () => {
  it('leave the day shallows as they are', () => {
    const c = new THREE.Color('#58c2c0');
    dimShallow(c, new THREE.Color(1, 1, 1), night, look);
    expect(c.getHexString()).toBe('58c2c0');
  });

  it('turn darker and greyer at full night', () => {
    const day = new THREE.Color('#58c2c0');
    const c = dimShallow(day.clone(), night, night, look);
    expect(lum(c)).toBeCloseTo(lum(day) * 0.7, 2);
    expect(sat(c)).toBeLessThan(sat(day));
  });
});
