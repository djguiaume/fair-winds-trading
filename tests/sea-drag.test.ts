import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/tuning';
import { PHASE0_MAP } from '../src/data/maps';
import { createBoat, stepBoat, targetSpeed } from '../src/sim/boat';
import { DIFFICULTIES } from '../src/sim/difficulty';
import { DEG } from '../src/sim/math';
import { hullShare, seaDrag, seaDragAt } from '../src/sim/seaDrag';
import { dragRows } from '../src/sim/seaDragReport';
import { type SeaState, createSeaState, steadySeaState } from '../src/sim/seaState';
import { SHIP_CLASSES, SHIP_IDS, SLOOP, noGoAngle } from '../src/sim/ship';
import { MAX_UPGRADE_LEVEL, UPGRADE_TRACKS, effectiveShip } from '../src/sim/upgrades';
import type { Wind } from '../src/sim/wind';
import { createWorld, stepWorld } from '../src/sim/world';

// Issue #284, decision 0256: the waves slow her, bounded, by heading and hull, on every level.
const DT = 1 / 60;
const NORTH: Wind = { from: 0, speedKn: 14 };

/** A settled sea from the north: `previews` wind (14 kn) or storm. */
function sea(preview: 'calm' | 'wind' | 'storm'): SeaState {
  const { speedKn, storm } = TUNING.waves.previews[preview];
  return steadySeaState(0, speedKn, storm, createSeaState());
}

const flat = (): SeaState => {
  const s = createSeaState();
  for (const band of [s.swell, s.chop, s.ripple]) band.height = 0;
  return s;
};

/** Sail `seconds` on a fixed heading at full sail, the drag held at `drag`. */
function settle(heading: number, drag: number, seconds = 90, wind = NORTH) {
  const boat = createBoat(0, 0, heading);
  for (let t = 0; t < seconds; t += DT)
    stepBoat(boat, { steer: 0, sailStep: 2 }, SLOOP, wind, DT, drag);
  return boat;
}

describe('the waves slowing her (decision 0256)', () => {
  it('cost nothing in flat water or with the switch off', () => {
    for (const h of [0, 90, 180, 270]) expect(seaDrag(SLOOP, h * DEG, flat())).toBe(0);
  });

  it('slow head seas most, beam seas less, following seas least, and never push', () => {
    const s = sea('wind');
    const head = seaDrag(SLOOP, 0, s);
    const beam = seaDrag(SLOOP, 90 * DEG, s);
    const following = seaDrag(SLOOP, 180 * DEG, s);
    expect(head).toBeGreaterThan(beam);
    expect(beam).toBeGreaterThan(following);
    expect(following).toBeGreaterThanOrEqual(0);
    // Port and starboard alike.
    expect(seaDrag(SLOOP, -90 * DEG, s)).toBeCloseTo(beam, 12);
  });

  it('treat a confused sea the same from every side', () => {
    const s = sea('wind');
    s.swell.coherence = s.chop.coherence = 0;
    const at = (deg: number) => seaDrag(SLOOP, deg * DEG, s);
    expect(at(0)).toBeCloseTo(at(90), 12);
    expect(at(0)).toBeCloseTo(at(180), 12);
  });

  it('stay under the cap in a storm for every ship and upgrade', () => {
    const s = sea('storm');
    for (const id of SHIP_IDS)
      for (const track of UPGRADE_TRACKS)
        for (let n = 1; n <= MAX_UPGRADE_LEVEL; n++) {
          const levels = { sails: 1, hold: 1, hull: 1, [track]: n };
          const ship = effectiveShip(SHIP_CLASSES[id]!, levels);
          for (let h = 0; h < 360; h += 15) {
            const d = seaDrag(ship, h * DEG, s);
            expect(d).toBeGreaterThanOrEqual(0);
            expect(d).toBeLessThanOrEqual(TUNING.waves.drag.max);
          }
        }
  });

  it('let big hulls shoulder the sea better than small ones', () => {
    const indiaman = SHIP_CLASSES.indiaman!;
    expect(hullShare(indiaman)).toBeLessThan(hullShare(SLOOP));
    const s = sea('wind');
    expect(seaDrag(indiaman, 0, s)).toBeLessThan(seaDrag(SLOOP, 0, s));
  });

  it("play the same rule on every level, in that level's weather", () => {
    const at = (level: string) => {
      const world = createWorld(PHASE0_MAP, SLOOP);
      world.trade.difficulty = level;
      world.boat.heading = world.seaWind.from;
      for (let i = 0; i < 120; i++) stepWorld(world, { steer: 0, sailStep: 2 }, DT);
      return seaDragAt(world, world.boat, SLOOP);
    };
    for (const level of DIFFICULTIES) {
      const drag = at(level);
      expect(drag).toBeGreaterThan(0);
      expect(drag).toBeLessThanOrEqual(TUNING.waves.drag.max);
    }
  });

  it('only lower the speed she settles at, by exactly that share', () => {
    for (const deg of [50, 90, 135, 180]) {
      const plain = settle(deg * DEG, 0);
      const slowed = settle(deg * DEG, 0.05);
      expect(slowed.speedKn / plain.speedKn).toBeCloseTo(0.95, 3);
      // Same leeway, so no sideways push of her own.
      expect(slowed.drift.x).toBeCloseTo(plain.drift.x, 6);
      expect(slowed.drift.y).toBeCloseTo(plain.drift.y, 6);
      expect(slowed.speedKn).toBeLessThanOrEqual(targetSpeed(SLOOP, deg * DEG, NORTH, 1));
    }
  });

  it('leave the rudder, the no-go zone and the sails as they are', () => {
    // One step from the same state turns her just as far.
    const a = createBoat(0, 0, 90 * DEG);
    const b = createBoat(0, 0, 90 * DEG);
    a.speedKn = b.speedKn = 5;
    stepBoat(a, { steer: 1, sailStep: 2 }, SLOOP, NORTH, DT, 0);
    stepBoat(b, { steer: 1, sailStep: 2 }, SLOOP, NORTH, DT, 0.1);
    expect(b.heading).toBe(a.heading);
    expect(b.sail).toBe(a.sail);
    // In irons she stops whatever the sea.
    const irons = settle(noGoAngle(SLOOP) * 0.5, 0.1, 60);
    expect(irons.speedKn).toBeLessThan(0.05);
  });

  it('ease her speed when the sea builds, with no jolt', () => {
    const boat = settle(60 * DEG, 0);
    let last = boat.speedKn;
    let biggest = 0;
    for (let t = 0; t < 30; t += DT) {
      stepBoat(boat, { steer: 0, sailStep: 2 }, SLOOP, NORTH, DT, 0.1);
      biggest = Math.max(biggest, last - boat.speedKn);
      last = boat.speedKn;
    }
    expect(biggest).toBeLessThan(0.01);
  });

  it('read the sea of the world at her place, the same every run', () => {
    const run = () => {
      const world = createWorld(PHASE0_MAP, SLOOP);
      world.boat.heading = world.seaWind.from;
      const seen: number[] = [];
      for (let i = 0; i < 600; i++) {
        stepWorld(world, { steer: 0, sailStep: 2 }, DT);
        seen.push(seaDragAt(world, world.boat, SLOOP));
      }
      return { seen, world };
    };
    const a = run();
    expect(run().seen).toEqual(a.seen);
    expect(a.seen.some((d) => d > 0)).toBe(true);
    a.world.seaDragOn = false;
    expect(seaDragAt(a.world, a.world.boat, SLOOP)).toBe(0);
  });

  it('stop with the Settings switch off', () => {
    const world = createWorld(PHASE0_MAP, SLOOP);
    world.seaDragOn = false;
    for (let i = 0; i < 120; i++) stepWorld(world, { steer: 0, sailStep: 2 }, DT);
    expect(seaDragAt(world, world.boat, SLOOP)).toBe(0);
  });

  it('report the table the tool prints, inside the caps', () => {
    const rows = dragRows();
    expect(rows).toHaveLength(Object.keys(TUNING.waves.previews).length * SHIP_IDS.length);
    for (const r of rows) {
      expect(r.close).toBeGreaterThanOrEqual(r.beam);
      expect(r.beam).toBeGreaterThanOrEqual(r.broad);
      expect(r.broad).toBeGreaterThanOrEqual(r.run);
    }
  });
});
