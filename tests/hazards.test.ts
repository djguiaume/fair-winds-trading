import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { createBoat } from '../src/sim/boat';
import {
  LEAK_PENALTY,
  REPAIR_COST,
  SHALLOW_WIDTH,
  damageHull,
  hullCondition,
  reefDistance,
  reefsOf,
  repairHull,
  repairPrice,
  shallowness,
} from '../src/sim/hazards';
import type { MapDef, TerrainDef } from '../src/sim/map';
import { type SaveStorage, loadGame, saveGame } from '../src/sim/save';
import { CUTTER, SLOOP } from '../src/sim/ship';
import { activeShip } from '../src/sim/trade';
import { type World, createWorld, stepWorld } from '../src/sim/world';

const DT = 1 / 60;

/** A calm test sea: one square reef north of the origin, steady wind from the east. */
const reef: TerrainDef = {
  id: 'r',
  kind: 'reef',
  outline: [
    [-10, 40],
    [10, 40],
    [10, 60],
    [-10, 60],
  ],
};
const MAP: MapDef = {
  name: 'Reef test',
  seed: 1,
  boundsRadius: 400,
  wind: { fromDeg: 90, speedKn: 14, gustiness: 0, shiftDeg: 0 },
  start: { x: 0, y: -100, headingDeg: 0 },
  islands: [],
  terrain: [reef],
  course: [],
  ports: [],
};

function sailNorth(world: World, x: number, seconds: number) {
  world.boat = createBoat(x, -60, 0);
  world.boat.speedKn = 8;
  let damage = 0;
  for (let t = 0; t < seconds; t += DT) {
    for (const e of stepWorld(world, { steer: 0, sailStep: 2 }, DT)) {
      if (e.type === 'reef-strike') damage += e.damage;
    }
  }
  return damage;
}

class MemoryStorage implements SaveStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe('reefs and shallows (0032)', () => {
  it('finds the trading map reefs and measures shallowness around them', () => {
    expect(reefsOf(PHASE1_MAP.terrain).length).toBeGreaterThanOrEqual(3);
    const reefs = reefsOf([reef]);
    expect(reefDistance(reefs, { x: 0, y: 30 })).toBeCloseTo(10);
    expect(reefDistance(reefs, { x: 0, y: -200 })).toBe(Infinity);
    expect(shallowness(SLOOP.radius, SLOOP.radius)).toBe(1);
    expect(shallowness(SLOOP.radius + SHALLOW_WIDTH, SLOOP.radius)).toBe(0);
  });

  it('slows a boat in the shallows, a deep cutter more than a sloop', () => {
    const speedBeside = (ship: typeof SLOOP, x: number) => {
      const world = createWorld(MAP, ship);
      world.boat = createBoat(x, 50, 0); // sailing north alongside the reef, beam reach
      for (let t = 0; t < 20; t += DT) {
        world.boat.x = x;
        world.boat.y = 50;
        stepWorld(world, { steer: 0, sailStep: 2 }, DT);
      }
      return world.boat.speedKn;
    };
    const deep = speedBeside(SLOOP, 60);
    const shallowSloop = speedBeside(SLOOP, 17);
    expect(shallowSloop).toBeLessThan(deep * 0.8);
    expect(speedBeside(CUTTER, 17) / speedBeside(CUTTER, 60)).toBeLessThan(shallowSloop / deep);
  });

  it('holes the hull when striking a reef, but not when bumping a beach', () => {
    const world = createWorld(MAP, SLOOP);
    const damage = sailNorth(world, 0, 8);
    expect(damage).toBeGreaterThan(10);
    expect(hullCondition(world.trade)).toBeLessThan(1);

    const beach = createWorld({ ...MAP, terrain: [{ ...reef, kind: 'island' }] }, SLOOP);
    expect(sailNorth(beach, 0, 8)).toBe(0);
    expect(hullCondition(beach.trade)).toBe(1);
  });

  it('a damaged hull leaks speed, never below the leak floor, and nothing sinks', () => {
    const world = createWorld(MAP, SLOOP);
    const sound = activeShip(world.trade).speedRatio;
    damageHull(world.trade, 10_000);
    expect(hullCondition(world.trade)).toBe(0);
    expect(activeShip(world.trade).speedRatio).toBeCloseTo(sound * (1 - LEAK_PENALTY));
  });

  it('repairs in port for gold, partly when gold is short', () => {
    const world = createWorld(MAP, SLOOP);
    const { trade } = world;
    damageHull(trade, 40);
    expect(repairHull(trade)).toEqual({ ok: false, error: 'not-docked' });
    trade.dockedAt = 'anywhere';
    expect(repairPrice(trade)).toBe(Math.ceil(40 * REPAIR_COST));
    trade.captain.gold = 30;
    const partial = repairHull(trade);
    expect(partial).toEqual({ ok: true, gold: 30, points: 20 });
    expect(hullCondition(trade)).toBeCloseTo(0.8);
    trade.captain.gold = 1000;
    expect(repairHull(trade).ok).toBe(true);
    expect(hullCondition(trade)).toBe(1);
    expect(repairHull(trade)).toEqual({ ok: false, error: 'not-damaged' });
  });

  it('saves hull damage; older saves load with sound hulls', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    damageHull(world.trade, 33);
    const storage = new MemoryStorage();
    saveGame(storage, world);
    const resumed = createWorld(PHASE1_MAP, SLOOP);
    expect(loadGame(storage, resumed)).toBe(true);
    expect(resumed.trade.captain.hullDamage).toEqual({ sloop: 33 });

    const raw = JSON.parse(storage.getItem('fwt.save.v1')!);
    delete raw.hullDamage;
    storage.setItem('fwt.save.v1', JSON.stringify(raw));
    const legacy = createWorld(PHASE1_MAP, SLOOP);
    expect(loadGame(storage, legacy)).toBe(true);
    expect(hullCondition(legacy.trade)).toBe(1);
  });
});
