import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Rain, rainMayReachArea } from '../src/render/rain';
import { stormRain, type Storm } from '../src/sim/storms';

const center = new THREE.Vector3();
const storm = (x: number, y: number, radius = 30): Storm => ({
  id: 1,
  x,
  y,
  radius,
  intensity: 1,
  dx: 0,
  dy: 1,
});

describe('dry rain broad phase (0089)', () => {
  it('covers showers, off-centre storms, asymmetric north reach and circle corners', () => {
    expect(rainMayReachArea(center, 0.1, [])).toBe(true);
    expect(rainMayReachArea(center, 0, [])).toBe(false);
    expect(rainMayReachArea(center, 0, [storm(0, 180)])).toBe(true);
    expect(rainMayReachArea(center, 0, [storm(0, -120)])).toBe(false);
    expect(rainMayReachArea(center, 0, [storm(140, 190)])).toBe(true);
    expect(rainMayReachArea(center, 0, [storm(150, 200)])).toBe(false);
    expect(rainMayReachArea(center, 0, [{ ...storm(0, 0), intensity: 0 }])).toBe(false);
  });

  it('skips sampling, motion and uploads during dry frames, then restarts after a teleport', () => {
    const rain = new Rain(160);
    const position = rain.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const color = rain.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    rain.update(0.01, center, 1, 0, () => 1);
    const before = position.array.slice();
    const versions = [position.version, color.version];
    const sample = vi.fn(() => 0);
    rain.update(100, center, 1, 0, sample, false);
    expect(sample).not.toHaveBeenCalled();
    expect(rain.mesh.visible).toBe(false);
    expect(position.array).toEqual(before);
    expect([position.version, color.version]).toEqual(versions);
    const moved = new THREE.Vector3(1000, 0, 2000);
    rain.update(0, moved, 0, 0, () => 1, true);
    expect(rain.mesh.visible).toBe(true);
    for (let i = 0; i < position.count; i += 2) {
      expect(position.getX(i)).toBeGreaterThanOrEqual(880);
      expect(position.getX(i)).toBeLessThanOrEqual(1120);
      expect(position.getZ(i)).toBeGreaterThanOrEqual(1830);
      expect(position.getZ(i)).toBeLessThanOrEqual(2080);
    }
    expect(position.version).toBe(versions[0]! + 1);
    rain.dispose();
  });

  it('renders a nearby storm even when the boat itself is dry', () => {
    const nearby = storm(0, 140, 90);
    expect(stormRain(nearby, 0, 0)).toBe(0);
    const rain = new Rain(400);
    rain.update(
      0,
      center,
      0,
      0,
      (x, z) => stormRain(nearby, x, -z),
      rainMayReachArea(center, 0, [nearby]),
    );
    expect(rain.mesh.visible).toBe(true);
    rain.dispose();
  });
});
