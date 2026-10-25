import { describe, expect, it } from 'vitest';
import { GAME_MAP, PHASE1_MAP } from '../src/data/maps';
import { TUNING } from '../src/data/tuning';
import { SLOOP } from '../src/sim/ship';
import { type TrafficDef, laneOf } from '../src/sim/traffic';
import { trafficQuickChecks, trafficSailChecks } from '../src/sim/trafficChecks';
import { createWorld, stepWorld } from '../src/sim/world';

const still = { steer: 0, sailStep: 0 };

/** A world near Saltmere, where the ring's fishing boats and coasters sail. */
function nearSaltmere(map = GAME_MAP) {
  const world = createWorld(map, SLOOP);
  world.boat.x = 190;
  world.boat.y = -120;
  return world;
}

describe('other boats on the sea (decision 0214)', () => {
  it('reads every fleet of the game sea and the ring: ports, names, classes, lanes in open water', () => {
    for (const map of [GAME_MAP, PHASE1_MAP]) {
      const [check] = trafficQuickChecks(map);
      expect(check?.message).toMatch(/fleets/);
      expect(check?.ok, check?.message).toBe(true);
    }
    expect(GAME_MAP.traffic!.length).toBeGreaterThan(PHASE1_MAP.traffic!.length);
  });

  it('wakes no more boats than the quality allows, and none with the switch off', () => {
    const world = nearSaltmere();
    for (const cap of Object.values(TUNING.seamanship.traffic.atOnce)) {
      world.traffic.cap = cap;
      world.traffic.fresh = true;
      for (let i = 0; i < 40; i++) stepWorld(world, still, 0.1);
      const awake = world.traffic.boats.filter((b) => b.awake).length;
      expect(awake).toBeLessThanOrEqual(cap);
      expect(awake).toBeGreaterThan(0);
    }
    world.traffic.on = false;
    for (let i = 0; i < 10; i++) stepWorld(world, still, 0.1);
    expect(world.traffic.boats.some((b) => b.awake)).toBe(false);
  });

  it('never rams: a boat on top of the player is pushed off with a soft bump and no damage', () => {
    const world = nearSaltmere();
    for (let i = 0; i < 10; i++) stepWorld(world, still, 0.1);
    const b = world.traffic.boats.find((b) => b.awake)!;
    b.boat.x = world.boat.x + 0.5;
    b.boat.y = world.boat.y;
    world.boat.sinceBump = Infinity;
    world.boat.speedKn = 6;
    const damage = { ...world.trade.captain.hullDamage };
    const events = stepWorld(world, { steer: 0, sailStep: 2 }, 0.1);
    expect(events).toContainEqual({ type: 'bump' });
    expect(events.some((e) => e.type === 'crash')).toBe(false);
    expect(Math.hypot(b.boat.x - world.boat.x, b.boat.y - world.boat.y)).toBeGreaterThan(0.5);
    expect(world.trade.captain.hullDamage).toEqual(damage);
  });

  it('keeps a fleet waiting on its quest off the sea', () => {
    const fleet = GAME_MAP.traffic!.find((f) => f.tags?.some((t) => t.startsWith('after:')))!;
    const world = createWorld(GAME_MAP, SLOOP);
    const lane = laneOf(GAME_MAP, fleet);
    world.boat.x = lane[0]!.x + 30;
    world.boat.y = lane[0]!.y;
    for (let i = 0; i < 20; i++) stepWorld(world, still, 0.1);
    expect(world.traffic.boats.filter((b) => b.fleet === fleet && b.awake)).toEqual([]);
  });

  it('names a lane that runs onto land', () => {
    const kits = PHASE1_MAP.traffic!.find((f) => f.kind === 'fishing')!;
    const island = PHASE1_MAP.islands[0]!;
    const broken: TrafficDef = {
      ...kits,
      id: 'aground',
      names: ['Rock'],
      path: [[island.x, island.y]],
    };
    const [check] = trafficQuickChecks({ ...PHASE1_MAP, traffic: [broken] });
    expect(check?.ok).toBe(false);
    expect(check?.message).toMatch(/aground: the lane runs onto land/);
  });

  it('sails every lane of the game sea out and home in winds from every quarter', () => {
    const [check] = trafficSailChecks(GAME_MAP);
    expect(check?.ok, check?.message).toBe(true);
  }, 120_000);
});
