import { describe, expect, it } from 'vitest';
import { DEG, bearingTo, wrapAngle } from '../src/sim/math';
import { createRng } from '../src/sim/rng';
import { SLOOP, pointOfSail, polarFraction } from '../src/sim/ship';
import { type BoatState, createBoat, stepBoat, topSpeedKn, trueWindAngle } from '../src/sim/boat';
import { effectiveShip } from '../src/sim/upgrades';
import { resolveCollisions } from '../src/sim/collision';
import { createWorld, stepWorld } from '../src/sim/world';
import { PHASE0_MAP } from '../src/data/maps';
import type { Wind } from '../src/sim/wind';
import { TUNING } from '../src/data/tuning';

// Tuning values moved to src/data/tuning (decision 0094).
const REFERENCE_BREEZE_KN = TUNING.seamanship.boat.referenceBreezeKn;

const NORTH_WIND: Wind = { from: 0, speedKn: 14 };
const DT = 1 / 60;

function sail(boat: BoatState, seconds: number, steer = 0, wind = NORTH_WIND) {
  for (let t = 0; t < seconds; t += DT) {
    stepBoat(boat, { steer, sailStep: 2 }, SLOOP, wind, DT);
  }
}

describe('math', () => {
  it('wraps angles into (-π, π]', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
    expect(wrapAngle(370 * DEG)).toBeCloseTo(10 * DEG);
  });
  it('measures compass bearings clockwise from north', () => {
    expect(bearingTo({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(0);
    expect(bearingTo({ x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90 * DEG);
  });
});

describe('seeded rng', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seqA);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(createRng(43)()).not.toBe(seqA[0]);
  });
});

describe('polar curve', () => {
  it('gives no drive inside the no-go zone', () => {
    expect(polarFraction(SLOOP, 0)).toBe(0);
    expect(polarFraction(SLOOP, 44 * DEG)).toBe(0);
    expect(polarFraction(SLOOP, -30 * DEG)).toBe(0);
  });
  it('is fastest around a beam reach and slower downwind', () => {
    const beam = polarFraction(SLOOP, 95 * DEG);
    expect(beam).toBe(1);
    expect(polarFraction(SLOOP, 50 * DEG)).toBeLessThan(beam);
    expect(polarFraction(SLOOP, 180 * DEG)).toBeLessThan(beam);
    expect(polarFraction(SLOOP, 180 * DEG)).toBeGreaterThan(0.5);
  });
  it('names the points of sail', () => {
    expect(pointOfSail(SLOOP, 10 * DEG)).toBe('in-irons');
    expect(pointOfSail(SLOOP, 60 * DEG)).toBe('close-hauled');
    expect(pointOfSail(SLOOP, 90 * DEG)).toBe('beam-reach');
    expect(pointOfSail(SLOOP, 140 * DEG)).toBe('broad-reach');
    expect(pointOfSail(SLOOP, 175 * DEG)).toBe('running');
  });
});

describe('boat', () => {
  it('signs the true wind angle by side (positive = wind on starboard)', () => {
    expect(trueWindAngle(330 * DEG, NORTH_WIND)).toBeCloseTo(30 * DEG);
    expect(trueWindAngle(30 * DEG, NORTH_WIND)).toBeCloseTo(-30 * DEG);
  });

  it('picks up speed on a beam reach', () => {
    const boat = createBoat(0, 0, 90 * DEG);
    sail(boat, 15);
    expect(boat.speedKn).toBeGreaterThan(14 * SLOOP.speedRatio * 0.9);
    expect(boat.x).toBeGreaterThan(50);
  });

  it('stalls and drifts backwards when pointed into the wind', () => {
    const boat = createBoat(0, 0, 0);
    boat.speedKn = 8;
    sail(boat, 15);
    expect(boat.speedKn).toBeLessThan(0.1);
    expect(boat.y).toBeLessThan(40); // coasted a little, then got pushed back
    const y = boat.y;
    sail(boat, 5);
    expect(boat.y).toBeLessThan(y); // drifting downwind
  });

  it('can still turn out of irons when stopped', () => {
    const boat = createBoat(0, 0, 0);
    sail(boat, 2, 1);
    expect(boat.heading).toBeGreaterThan(30 * DEG);
  });

  it('carries way through a tack', () => {
    const boat = createBoat(0, 0, 50 * DEG);
    sail(boat, 15);
    const before = boat.speedKn;
    // Turn through the wind to 310°.
    while (Math.abs(trueWindAngle(boat.heading, NORTH_WIND) + 50 * DEG) > 3 * DEG) {
      stepBoat(boat, { steer: -1, sailStep: 2 }, SLOOP, NORTH_WIND, DT);
    }
    expect(boat.speedKn).toBeGreaterThan(before * 0.3);
  });

  it('makes progress upwind by tacking, but not by pointing straight at it', () => {
    const straight = createBoat(0, 0, 0);
    sail(straight, 60);

    const tacking = createBoat(0, 0, 50 * DEG);
    let tack = 1;
    for (let t = 0; t < 60; t += DT) {
      const desired = tack > 0 ? 50 * DEG : 310 * DEG;
      const err = wrapAngle(desired - tacking.heading);
      stepBoat(
        tacking,
        { steer: Math.max(-1, Math.min(1, err * 3)), sailStep: 2 },
        SLOOP,
        NORTH_WIND,
        DT,
      );
      if (Math.abs(tacking.x) > 40) tack = tacking.x > 0 ? -1 : 1;
    }
    expect(straight.y).toBeLessThan(5);
    expect(tacking.y).toBeGreaterThan(150);
  });

  it('lowered sails stop the boat', () => {
    const boat = createBoat(0, 0, 90 * DEG);
    sail(boat, 10);
    for (let t = 0; t < 20; t += DT)
      stepBoat(boat, { steer: 0, sailStep: 0 }, SLOOP, NORTH_WIND, DT);
    expect(boat.speedKn).toBeLessThan(0.1);
  });
});

describe('collision', () => {
  it('pushes the boat out of an island and slows a head-on hit', () => {
    const boat = createBoat(0, -9, 0);
    boat.speedKn = 6;
    const hit = resolveCollisions(boat, 2, [{ id: 'a', x: 0, y: 0, radius: 10 }], 1000);
    expect(hit).toBe('shore');
    expect(Math.hypot(boat.x, boat.y)).toBeCloseTo(12);
    expect(boat.speedKn).toBeLessThan(1.5);
    expect(boat.sinceBump).toBe(0);
  });
  it('keeps the boat inside the sea', () => {
    const boat = createBoat(500, 0, 90 * DEG);
    resolveCollisions(boat, 2, [], 300);
    expect(Math.hypot(boat.x, boat.y)).toBeCloseTo(300);
  });
});

describe('world', () => {
  it('starts clear of every island and has buoys in open water', () => {
    const map = PHASE0_MAP;
    for (const isl of map.islands) {
      expect(Math.hypot(map.start.x - isl.x, map.start.y - isl.y)).toBeGreaterThan(isl.radius + 10);
      for (const wp of map.course) {
        expect(Math.hypot(wp.x - isl.x, wp.y - isl.y)).toBeGreaterThan(isl.radius + SLOOP.radius);
      }
    }
  });

  it('advances the course when the boat reaches a buoy', () => {
    const world = createWorld(PHASE0_MAP, SLOOP);
    const wp = PHASE0_MAP.course[0]!;
    world.boat.x = wp.x;
    world.boat.y = wp.y - 5;
    const events = stepWorld(world, { steer: 0, sailStep: 2 }, DT);
    expect(events.some((e) => e.type === 'waypoint')).toBe(true);
    expect(world.course.index).toBe(1);
  });

  it('is deterministic', () => {
    const run = () => {
      const w = createWorld(PHASE0_MAP, SLOOP);
      for (let i = 0; i < 600; i++) stepWorld(w, { steer: Math.sin(i / 50), sailStep: 2 }, DT);
      return [w.boat.x, w.boat.y, w.boat.heading];
    };
    expect(run()).toEqual(run());
  });
});

describe('top speed in knots (decision 0075)', () => {
  it('quotes the best point of sail in the reference breeze', () => {
    expect(REFERENCE_BREEZE_KN).toBe(14);
    expect(topSpeedKn(SLOOP)).toBeCloseTo(14 * SLOOP.speedRatio);
    expect(topSpeedKn(effectiveShip(SLOOP, { sails: 3, hold: 1, hull: 3 }))).toBeCloseTo(
      14 * SLOOP.speedRatio * 1.16 * 1.04,
    );
  });
});
