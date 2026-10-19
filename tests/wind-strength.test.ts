import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { DEFAULT_WEATHER, windAt } from '../src/sim/wind';
import {
  createWindGauge,
  updateWindGauge,
  windForce,
  windForceSticky,
  windStrength01,
} from '../src/sim/windStrength';

describe('wind strength gauge (decision 0040)', () => {
  it('names five steps across the playable range', () => {
    expect([4, 8, 13, 17, 22].map(windForce)).toEqual([0, 1, 2, 3, 4]);
    expect(windForce(7)).toBe(1);
    expect(windForce(6.99)).toBe(0);
  });

  it('holds a step until the wind is clearly past the boundary', () => {
    expect(windForceSticky(15.3, 2)).toBe(2);
    expect(windForceSticky(15.7, 2)).toBe(3);
    expect(windForceSticky(14.6, 3)).toBe(3);
    expect(windForceSticky(14.3, 3)).toBe(2);
    expect(windForceSticky(4, 3)).toBe(0);
  });

  it('keeps the prevailing Phase 1 breeze looking like today on the sea', () => {
    expect(windForce(PHASE1_MAP.wind.speedKn)).toBe(2);
    expect(windStrength01(PHASE1_MAP.wind.speedKn)).toBeCloseTo(0.56, 2);
    expect(windStrength01(2)).toBe(0);
    expect(windStrength01(30)).toBe(1);
  });

  it('flags a jump into stronger wind as a gust, briefly', () => {
    let g = createWindGauge(10);
    for (let i = 0; i < 60; i++) g = updateWindGauge(g, 10, 0.1);
    expect(g.gust).toBe(0);
    g = updateWindGauge(g, 13, 0.1);
    expect(g.gust).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) g = updateWindGauge(g, 10, 0.1);
    expect(g.gust).toBe(0);
  });

  it('shows gusts now and then in normal weather, not constantly', () => {
    const cfg = { ...PHASE1_MAP.wind, weather: DEFAULT_WEATHER };
    let g = createWindGauge(windAt(cfg, 0, PHASE1_MAP.seed).speedKn);
    let gustTime = 0;
    let changes = 0;
    const dt = 1 / 30;
    for (let t = 0; t < 600; t += dt) {
      const before = g.force;
      g = updateWindGauge(g, windAt(cfg, t, PHASE1_MAP.seed).speedKn, dt);
      if (g.gust > 0) gustTime += dt;
      if (g.force !== before) changes++;
    }
    expect(gustTime).toBeGreaterThan(5);
    expect(gustTime / 600).toBeLessThan(0.3);
    // Ten minutes of weather: the gauge moves, but never flickers.
    expect(changes).toBeGreaterThan(0);
    expect(changes).toBeLessThan(40);
  });
});
