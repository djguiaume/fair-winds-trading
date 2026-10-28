import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { Ocean } from '../src/render/ocean';
import { QUALITY, renderPixelRatio } from '../src/render/quality';
import { SLOOP } from '../src/sim/ship';
import { createWorld, currentWaypoint, setPortDestination, stepWorld } from '../src/sim/world';

describe('tablet rendering budget', () => {
  it('bounds drawing-buffer pixels even on large high-DPI tablets', () => {
    for (const profile of Object.values(QUALITY)) {
      for (const [w, h, dpr] of [
        [2048, 1536, 2],
        [1280, 800, 1],
        [390, 844, 3],
      ]) {
        const ratio = renderPixelRatio(w!, h!, dpr!, profile);
        expect(w! * h! * ratio ** 2).toBeLessThanOrEqual(profile.maxRenderPixels + 1);
        expect(ratio).toBeLessThanOrEqual(profile.pixelRatioCap);
      }
    }
  });
  it('uses per-vertex coast distance on Low and per-pixel coasts on High', () => {
    const low = new Ocean(PHASE1_MAP.islands, 48, { fancy: false }, 420, PHASE1_MAP.terrain);
    const high = new Ocean(PHASE1_MAP.islands, 120, { fancy: true }, 420, PHASE1_MAP.terrain);
    expect(low.mesh.material.defines).toEqual({ VERTEX_SHORES: '' });
    expect(high.mesh.material.defines).toEqual({ FANCY: '' });
    expect(low.mesh.geometry.getAttribute('position').count).toBe(49 * 49);
    low.dispose();
    high.dispose();
  });
});

describe('explicit port destinations', () => {
  it('sets all four ports, including Stonehaven, without changing the practice course', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const course = JSON.stringify(world.map.course);
    for (const port of PHASE1_MAP.ports) {
      expect(setPortDestination(world, port.id)).toBe(true);
      expect(currentWaypoint(world).label).toBe(port.name);
      const wp = currentWaypoint(world);
      world.boat.x = wp.x;
      world.boat.y = wp.y;
      stepWorld(world, { steer: 0, sailStep: 0 }, 1 / 60);
      expect(currentWaypoint(world).label).toBe(port.name);
    }
    expect(JSON.stringify(world.map.course)).toBe(course);
    expect(setPortDestination(world, 'missing')).toBe(false);
  });
});
