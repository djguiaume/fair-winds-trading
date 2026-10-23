import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { DEG } from '../src/sim/math';
import { type Circle, SpatialGrid } from '../src/sim/spatial';
import { windBlockers, windEffectAt, windGrid } from '../src/sim/wind';
import { TUNING } from '../src/data/tuning';
import { createRng } from '../src/sim/rng';

describe('spatial grid (0117)', () => {
  const rng = createRng(11);
  const circles: Circle[] = Array.from({ length: 300 }, () => ({
    x: (rng() - 0.5) * 2000,
    y: (rng() - 0.5) * 2000,
    r: 2 + rng() * 60,
  }));
  const grid = new SpatialGrid(circles);

  it('returns exactly what a full scan returns, in the same order', () => {
    for (let i = 0; i < 400; i++) {
      const x = (rng() - 0.5) * 2200,
        y = (rng() - 0.5) * 2200,
        r = rng() * 150;
      const scan = circles.filter((c) => Math.hypot(c.x - x, c.y - y) <= r + c.r);
      expect(grid.near(x, y, r)).toEqual(scan);
    }
  });

  it('reuses the output array and never lists an item twice', () => {
    const out: Circle[] = [];
    const big = grid.near(0, 0, 500, out);
    expect(big).toBe(out);
    expect(new Set(big).size).toBe(big.length);
  });
});

describe('wind shelter checks only nearby land (0117)', () => {
  const blockers = windBlockers(PHASE1_MAP.islands, PHASE1_MAP.terrain);
  const grid = windGrid(blockers);
  const radius = PHASE1_MAP.boundsRadius;

  it('gives the same shelter and funnel as checking every island, everywhere on the map', () => {
    let sheltered = 0,
      funnelled = 0,
      samples = 0;
    for (let x = -radius; x <= radius; x += 9)
      for (let y = -radius; y <= radius; y += 9) {
        if (x * x + y * y > radius * radius) continue;
        const from = (((x * 7 + y * 13) % 360) + 360) % 360;
        const wind = { from: from * DEG, speedKn: 14 };
        const full = windEffectAt(blockers, { x, y }, wind);
        expect(windEffectAt(grid, { x, y }, wind)).toEqual(full);
        samples++;
        if (full.shelter > 0) sheltered++;
        if (full.funnel > 0) funnelled++;
      }
    // The comparison covers plenty of lee and flank water, not just open sea.
    expect(samples).toBeGreaterThan(5000);
    expect(sheltered).toBeGreaterThan(300);
    expect(funnelled).toBeGreaterThan(300);
  });

  it('stays exact when the tune panel lengthens the shadow', () => {
    const islands = TUNING.weather.islands;
    const before = islands.shadowLength;
    islands.shadowLength = before * 2;
    try {
      for (let a = 0; a < 360; a += 15)
        for (const p of [
          { x: 0, y: 0 },
          { x: 120, y: -80 },
          { x: -200, y: 150 },
        ]) {
          const wind = { from: a * DEG, speedKn: 14 };
          expect(windEffectAt(grid, p, wind)).toEqual(windEffectAt(blockers, p, wind));
        }
    } finally {
      islands.shadowLength = before;
    }
  });

  it('looks at a handful of blockers however big the map gets', () => {
    // Today's islands copied 25 times across a sea 5 times as wide.
    const copies = blockers.flatMap((b) =>
      Array.from({ length: 25 }, (_, i) => ({
        ...b,
        x: b.x + ((i % 5) - 2) * radius * 2,
        y: b.y + (Math.floor(i / 5) - 2) * radius * 2,
      })),
    );
    const big = new SpatialGrid(copies);
    const reach =
      Math.max(TUNING.weather.islands.shadowLength, TUNING.weather.islands.funnelReach) + 1;
    let most = 0;
    for (let x = -radius; x <= radius; x += 20)
      for (let y = -radius; y <= radius; y += 20)
        most = Math.max(most, big.near(x, y, reach).length);
    expect(copies.length).toBeGreaterThan(200);
    expect(most).toBeLessThan(blockers.length);
  });
});
