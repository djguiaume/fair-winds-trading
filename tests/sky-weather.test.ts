import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/tuning';
import type { Storm } from '../src/sim/storms';
import { buildClouds } from '../src/render/skyClouds';
import { buildStreaks } from '../src/render/skyStreaks';
import { blankSquall, cloudAmount, pickSqualls, squallView } from '../src/render/skyWeather';

const storm = (x: number, y: number, radius = 80, intensity = 1): Storm => ({
  id: x * 1000 + y,
  x,
  y,
  radius,
  intensity,
  dx: 0,
  dy: 1,
});

describe('richer sky (issue #552)', () => {
  const shape = TUNING.graphics.sky.squall;

  it('shows more cloud as the wind freshens and the sky greys', () => {
    const amount = { clear: 0.4, perKn: 0.02, gloom: 0.5 };
    expect(cloudAmount(amount, 0, 0)).toBeCloseTo(0.4);
    expect(cloudAmount(amount, 20, 0)).toBeGreaterThan(cloudAmount(amount, 10, 0));
    expect(cloudAmount(amount, 10, 1)).toBeGreaterThan(cloudAmount(amount, 10, 0));
    expect(cloudAmount(amount, 60, 1)).toBe(1);
  });

  it('shows a storm off the bow in its direction, taller as it nears', () => {
    const far = squallView(blankSquall(), storm(0, -400), 0, 0, shape);
    const near = squallView(blankSquall(), storm(0, -150), 0, 0, shape);
    // South of the boat in the sim is +z in the scene.
    expect(near.z).toBeCloseTo(1);
    expect(near.x).toBeCloseTo(0);
    expect(near.top).toBeGreaterThan(far.top);
    expect(near.halfWidth).toBeGreaterThan(far.halfWidth);
    expect(near.strength).toBeGreaterThan(0);
  });

  it('hides a storm over the boat (the gloom is the whole sky) and one out of sight', () => {
    expect(squallView(blankSquall(), storm(0, 30), 0, 0, shape).strength).toBe(0);
    const gone = 80 + shape.rangeUnits + 10;
    expect(squallView(blankSquall(), storm(gone, 0), 0, 0, shape).strength).toBe(0);
  });

  it('keeps the strongest squalls without allocating new views', () => {
    const out = [blankSquall(), blankSquall()];
    const kept = out.slice();
    const storms = [storm(0, -300, 80, 0.3), storm(300, 0, 80, 1), storm(-300, 0, 80, 0.8)];
    pickSqualls(out, blankSquall(), storms, 0, 0, shape);
    expect(out[0]).toBe(kept[0]);
    const strengths = out.map((v) => v.strength).sort();
    expect(strengths[0]).toBeGreaterThan(0.3 * 0.99);
    expect(out.some((v) => v.x > 0.99)).toBe(true);
    expect(out.some((v) => v.x < -0.99)).toBe(true);
  });

  it('builds two cloud layers, each corner tagged with its rim, rank and layer', () => {
    const { clouds, streaks } = TUNING.graphics.sky;
    const mesh = buildStreaks(streaks, 0, buildClouds(clouds));
    const corners = mesh.shades.length;
    expect(mesh.parts.length).toBe(corners * 3);
    expect(mesh.positions.length).toBe(corners * 3);
    const layers = new Set<number>();
    for (let i = 0; i < corners; i++) {
      const [edge, rank, layer] = mesh.parts.slice(i * 3, i * 3 + 3);
      expect(edge).toBeGreaterThanOrEqual(0);
      expect(edge).toBeLessThanOrEqual(1);
      expect(rank).toBeGreaterThanOrEqual(0);
      expect(rank).toBeLessThan(1);
      layers.add(layer!);
    }
    expect([...layers].sort()).toEqual([0, 1]);
    expect(Math.max(...mesh.indices)).toBe(corners - 1);
    // The streaks stand above the cumulus.
    const [streakLow = 0] = streaks.baseDeg;
    for (let i = 0; i < corners; i++) {
      if (mesh.parts[i * 3 + 2] !== 1) continue;
      const elevation = (Math.asin(mesh.positions[i * 3 + 1]!) * 180) / Math.PI;
      expect(elevation).toBeGreaterThan(streakLow - 3);
    }
  });
});
