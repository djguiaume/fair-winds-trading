import { describe, expect, it } from 'vitest';
import { GAME_MAP } from '../src/data/maps';
import {
  addRaceStorm,
  moveRaceStorm,
  removeRaceStorm,
  shapeRaceStorm,
} from '../src/editor/quest/raceStormDoc';
import { DIFFICULTIES } from '../src/sim/difficulty';
import { racePars } from '../src/sim/raceBot';
import {
  type RaceStormDef,
  checkRaceStormDefs,
  checkRaceStormSpots,
  makeRaceStorms,
  moveRaceStorms,
  syncRaceStorms,
} from '../src/sim/raceStorms';
import { type QuestDef, QUESTS } from '../src/sim/quests';
import { courseOf } from '../src/sim/regatta';
import { SLOOP } from '../src/sim/ship';
import { createWorld, stepWorld } from '../src/sim/world';

// Decision 0225: a race lists its own storms, the same on every run.

const race = (id: string) => structuredClone(QUESTS.find((q) => q.id === id)!) as QuestDef;
const first = (q: QuestDef) => {
  const course = courseOf(q.steps[0]!.goal)!;
  return course.marks[0]!;
};

describe('race storms', () => {
  it('sit still until the horn, then drift on their bearing', () => {
    const s = makeRaceStorms([{ x: 10, y: 20, driftDeg: 90, driftSpeed: 2 }]);
    moveRaceStorms(s, -5);
    expect([s.storms[0]!.x, s.storms[0]!.y]).toEqual([10, 20]);
    moveRaceStorms(s, 10);
    expect(s.storms[0]!.x).toBeCloseTo(30);
    expect(s.storms[0]!.y).toBeCloseTo(20);
  });

  it('check their values and where they sit', () => {
    expect(checkRaceStormDefs([{ x: 0, y: 0, radius: 1 }], 'r')[0]).toMatch(/radius/);
    expect(checkRaceStormDefs([{ x: 0, y: 0, driftSpeed: 1 }], 'r')[0]).toMatch(/driftDeg/);
    expect(checkRaceStormDefs([{ x: 0, y: 0, radius: 60, strength: 0.5 }], 'r')).toEqual([]);
    const q = race('race-calda');
    const course = courseOf(q.steps[0]!.goal)!;
    const m = first(q);
    const at = (d: RaceStormDef) =>
      checkRaceStormSpots([d], course, GAME_MAP.boundsRadius, 60, 'r');
    expect(at({ x: m.x, y: m.y })[0]).toMatch(/core sits on/);
    expect(at({ x: GAME_MAP.boundsRadius * 2, y: 0 })[0]).toMatch(/outside the sea/);
    expect(at({ x: m.x + 400, y: m.y + 400, radius: 30 }).length).toBeLessThanOrEqual(1);
  });

  it('blow on the pinned wind, and Settings › Storms turns them off', () => {
    const world = createWorld(GAME_MAP, SLOOP);
    world.calmWind = { from: 0, speedKn: 12 };
    const step = () => stepWorld(world, { steer: 0, sailStep: 0 }, 0.1);
    const defs = [{ x: world.boat.x, y: world.boat.y, strength: 1 }];
    syncRaceStorms(world, defs, 0);
    step();
    expect(world.wind.speedKn).toBeGreaterThan(12 * 1.5);
    expect(world.weather.storms).toHaveLength(1);
    world.storms = false;
    step();
    expect(world.wind.speedKn).toBeLessThan(12.5);
    expect(world.weather.storms).toHaveLength(0);
    syncRaceStorms(world, undefined, 0);
    expect(world.raceStorms).toBeNull();
  });

  it('are edited by the builder and the command with the same functions', () => {
    const q = race('race-calda');
    const i = addRaceStorm(q, { x: 12.34, y: 5 }, { radius: 50, driftDeg: 90, driftSpeed: 1 });
    expect(q.race!.storms![i]).toEqual({ x: 12.3, y: 5, radius: 50, driftDeg: 90, driftSpeed: 1 });
    expect(moveRaceStorm(q, i, { x: 1, y: 2 })).toBe(true);
    shapeRaceStorm(q, i, { driftDeg: null, driftSpeed: null, strength: 0.5 });
    expect(q.race!.storms![i]).toEqual({ x: 1, y: 2, radius: 50, strength: 0.5 });
    expect(removeRaceStorm(q, i)).toBe(true);
    expect(q.race!.storms).toBeUndefined();
  });

  it('give a race with a storm bot pars on all three levels', { timeout: 120_000 }, () => {
    const q = race('race-calda');
    const m = first(q);
    addRaceStorm(q, { x: m.x + 25, y: m.y + 25 }, { radius: 40 });
    const { pars, runs } = racePars(GAME_MAP, q, ['sloop']);
    expect(Object.keys(pars.sloop!)).toHaveLength(DIFFICULTIES.length);
    // Sailed with the storm and without, the par the slower of the two.
    expect(runs.filter((r) => r.storms)).toHaveLength(DIFFICULTIES.length);
    expect(runs.filter((r) => !r.storms)).toHaveLength(DIFFICULTIES.length);
    for (const level of DIFFICULTIES) {
      const secs = runs.filter((r) => r.difficulty === level).map((r) => r.sec!);
      expect(pars.sloop![level]).toBe(Math.ceil(Math.max(...secs)));
    }
  });
});
