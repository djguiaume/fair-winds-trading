import { describe, expect, it } from 'vitest';
import { PHASE0_MAP } from '../src/data/maps';
import { trueWindAngle } from '../src/sim/boat';
import { DEG, bearingTo, bearingVector, clamp, wrapAngle } from '../src/sim/math';
import { SLOOP } from '../src/sim/ship';
import { type World, createWorld, currentWaypoint, stepWorld } from '../src/sim/world';

/** Is there an island within `range` units straight ahead? */
function blocked(world: World, range: number): boolean {
  const dir = bearingVector(world.boat.heading);
  return world.map.islands.some((isl) => {
    const rx = isl.x - world.boat.x;
    const ry = isl.y - world.boat.y;
    const along = rx * dir.x + ry * dir.y;
    const across = Math.abs(rx * dir.y - ry * dir.x);
    return along > 0 && along < range + isl.radius && across < isl.radius + world.ship.radius + 2;
  });
}

/**
 * A naive autopilot: aim at the buoy; if that is inside the no-go zone, sail close-hauled on the
 * current tack and switch tacks when the buoy's bearing crosses to the other side of the wind or
 * an island is dead ahead.
 * Proves the practice course is completable and gives a feel for how long a lap takes.
 */
function autopilotLap() {
  const world = createWorld(PHASE0_MAP, SLOOP);
  const dt = 1 / 60;
  let tack = 1;
  let lastTack = -Infinity;
  const legs: number[] = [];
  let bumps = 0;
  while (world.time < 600 && legs.length < PHASE0_MAP.course.length) {
    const wp = currentWaypoint(world);
    const toWp = bearingTo(world.boat, wp);
    const wpTwa = trueWindAngle(toWp, world.wind);
    let desired = toWp;
    if (Math.abs(wpTwa) < 52 * DEG) {
      // Tack when the buoy is clearly on the other side of the wind (hysteresis avoids dithering).
      if (wpTwa * tack < -12 * DEG || (blocked(world, 30) && world.time - lastTack > 4)) {
        tack = -tack;
        lastTack = world.time;
      }
      desired = world.wind.from - tack * 52 * DEG;
    }
    const steer = clamp(wrapAngle(desired - world.boat.heading) * 2.5, -1, 1);
    for (const e of stepWorld(world, { steer, sailStep: 2 }, dt)) {
      if (e.type === 'waypoint') legs.push(e.seconds);
      if (e.type === 'bump') bumps++;
    }
  }
  return { legs, bumps, time: world.time };
}

describe('phase 0 practice course', () => {
  it('can be sailed around by a simple tacking autopilot', () => {
    const { legs, time, bumps } = autopilotLap();
    expect(legs).toHaveLength(PHASE0_MAP.course.length);
    // A full lap should be a few minutes, not seconds and not forever.
    expect(time).toBeGreaterThan(60);
    expect(time).toBeLessThan(240);
    console.log('autopilot legs (s):', legs.map((s) => s.toFixed(0)).join(', '), 'bumps', bumps);
  });
});
