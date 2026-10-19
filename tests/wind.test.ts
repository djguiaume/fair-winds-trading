import { describe, expect, it } from 'vitest';
import { PHASE0_MAP, PHASE1_MAP } from '../src/data/maps';
import { DEG, wrapAngle } from '../src/sim/math';
import type { IslandDef, TerrainDef } from '../src/sim/map';
import { SLOOP } from '../src/sim/ship';
import {
  DEFAULT_WEATHER,
  FUNNEL_GAIN,
  SHADOW_DEPTH,
  localWind,
  shelterAt,
  weatherAt,
  windAt,
  windBlockers,
  windEffectAt,
} from '../src/sim/wind';
import { createWorld, stepWorld } from '../src/sim/world';

describe('slow weather (0026)', () => {
  const seed = 7;

  it('starts a voyage in the prevailing wind and is reproducible from the seed', () => {
    expect(weatherAt(DEFAULT_WEATHER, seed, 0)).toEqual({ offsetDeg: 0, strength: 1 });
    expect(weatherAt(DEFAULT_WEATHER, seed, 1000)).toEqual(weatherAt(DEFAULT_WEATHER, seed, 1000));
  });

  it('settles on new directions and strengths within the configured range', () => {
    const offsets = new Set<number>();
    for (let slot = 1; slot < 40; slot++) {
      const w = weatherAt(DEFAULT_WEATHER, seed, slot * DEFAULT_WEATHER.periodSec + 100);
      expect(Math.abs(w.offsetDeg)).toBeLessThanOrEqual(DEFAULT_WEATHER.rangeDeg);
      expect(w.strength).toBeGreaterThanOrEqual(DEFAULT_WEATHER.strength[0]);
      expect(w.strength).toBeLessThanOrEqual(DEFAULT_WEATHER.strength[1]);
      offsets.add(Math.round(w.offsetDeg / 10));
    }
    // Real variety, not one fixed shift.
    expect(offsets.size).toBeGreaterThan(5);
  });

  it('eases into a new wind instead of jumping', () => {
    let prev = windAt(PHASE1_MAP.wind, 0, seed);
    for (let t = 0.5; t < 1200; t += 0.5) {
      const w = windAt(PHASE1_MAP.wind, t, seed);
      expect(Math.abs(wrapAngle(w.from - prev.from)) / DEG).toBeLessThan(2);
      prev = w;
    }
  });

  it('keeps the Phase 0 practice wind steady', () => {
    expect(PHASE0_MAP.wind.weather).toBeUndefined();
    const a = windAt(PHASE0_MAP.wind, 10);
    const b = windAt(PHASE0_MAP.wind, 10 + 5 * DEFAULT_WEATHER.periodSec);
    expect(Math.abs(wrapAngle(a.from - b.from)) / DEG).toBeLessThanOrEqual(
      PHASE0_MAP.wind.shiftDeg * 2,
    );
  });
});

describe('wind shadow behind islands (0027)', () => {
  const island: IslandDef = { id: 'hill', x: 0, y: 0, radius: 18 };
  const blockers = windBlockers([island]);
  const north = { from: 0, speedKn: 14 };

  it('calms the wind just downwind of an island and fades with distance', () => {
    const near = shelterAt(blockers, { x: 0, y: -25 }, north);
    const mid = shelterAt(blockers, { x: 0, y: -60 }, north);
    expect(near).toBeGreaterThan(0.7);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(near);
    expect(shelterAt(blockers, { x: 0, y: -120 }, north)).toBe(0);
  });

  it('leaves the windward side and the open sea alone', () => {
    expect(shelterAt(blockers, { x: 0, y: 30 }, north)).toBe(0);
    expect(shelterAt(blockers, { x: 60, y: -30 }, north)).toBe(0);
  });

  it('lets wind blow over flat sandbanks but not over high coastlines', () => {
    const outline: TerrainDef['outline'] = [
      [-20, -5],
      [20, -5],
      [20, 5],
      [-20, 5],
    ];
    const bank = windBlockers([], [{ id: 'b', kind: 'sandbank', outline }]);
    const ridge = windBlockers([], [{ id: 'r', kind: 'island', outline }]);
    expect(shelterAt(bank, { x: 0, y: -20 }, north)).toBe(0);
    expect(shelterAt(ridge, { x: 0, y: -20 }, north)).toBeGreaterThan(0.5);
  });

  it('never stops the wind completely', () => {
    expect(localWind(north, { shelter: 1, funnel: 0 }).speedKn).toBeCloseTo(
      14 * (1 - SHADOW_DEPTH),
    );
  });

  it('speeds the wind up along an island flank, more in a channel between two', () => {
    const flank = windEffectAt(blockers, { x: 26, y: 0 }, north);
    expect(flank.shelter).toBe(0);
    expect(flank.funnel).toBeGreaterThan(0.2);
    expect(localWind(north, flank).speedKn).toBeGreaterThan(14);
    expect(windEffectAt(blockers, { x: 80, y: 0 }, north).funnel).toBe(0);

    const pair = windBlockers([island, { id: 'east', x: 50, y: 0, radius: 18 }]);
    const channel = windEffectAt(pair, { x: 25, y: 0 }, north);
    expect(channel.funnel).toBeGreaterThan(flank.funnel);
    expect(channel.funnel).toBeLessThanOrEqual(1);
    expect(localWind(north, channel).speedKn).toBeLessThanOrEqual(14 * (1 + FUNNEL_GAIN));
  });

  it('slows a boat sailing through the lee', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.boat.x = 0;
    world.boat.y = 500; // outside any lee for the update below
    stepWorld(world, { steer: 0, sailStep: 2 }, 0.016);
    expect(world.shelter).toBe(0);
    expect(world.wind.speedKn).toBeCloseTo(world.seaWind.speedKn);
    // Right downwind of Port Calda's island.
    const calda = PHASE1_MAP.islands.find((i) => i.id === 'calda')!;
    const to = world.seaWind.from + Math.PI;
    world.boat.x = calda.x + Math.sin(to) * (calda.radius + 8);
    world.boat.y = calda.y + Math.cos(to) * (calda.radius + 8);
    stepWorld(world, { steer: 0, sailStep: 2 }, 0.016);
    expect(world.shelter).toBeGreaterThan(0.4);
    expect(world.wind.speedKn).toBeLessThan(world.seaWind.speedKn * 0.8);
  });
});
