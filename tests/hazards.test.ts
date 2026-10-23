import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { createBoat } from '../src/sim/boat';
import {
  damageHull,
  hullCondition,
  impactDamage,
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
import { TUNING } from '../src/data/tuning';
import { knobs } from '../src/sim/difficulty';

// Tuning values moved to src/data/tuning (decision 0094).
const CRASH_DAMAGE = TUNING.seamanship.hazards.crashDamage;
const CRASH_SAFE_KN = TUNING.seamanship.hazards.crashSafeKn;
const DOCK_SPEED_KN = TUNING.seamanship.harbour.dockSpeedKn;
const LEAK_PENALTY = TUNING.seamanship.hazards.leakPenalty;
const REPAIR_COST = knobs('captain').repairCost;
const SHALLOW_WIDTH = TUNING.seamanship.hazards.shallowWidth;

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
      if (e.type === 'reef-strike' || e.type === 'crash') damage += e.damage;
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

  it('holes the hull on a reef, dents it on a shore, and spares sandbanks and docking bumps', () => {
    const world = createWorld(MAP, SLOOP);
    const reefDamage = sailNorth(world, 0, 8);
    expect(reefDamage).toBeGreaterThan(10);
    expect(hullCondition(world.trade)).toBeLessThan(1);

    // Ramming a rocky shore at full sail hurts too (0038), a little less than a reef.
    const shore = createWorld({ ...MAP, terrain: [{ ...reef, kind: 'island' }] }, SLOOP);
    const shoreDamage = sailNorth(shore, 0, 8);
    expect(shoreDamage).toBeGreaterThan(5);
    expect(shoreDamage).toBeLessThan(reefDamage);

    const bank = createWorld({ ...MAP, terrain: [{ ...reef, kind: 'sandbank' }] }, SLOOP);
    expect(sailNorth(bank, 0, 8)).toBe(0);

    // Drifting into the shore at docking speed with the sails down is a free bump.
    const gentle = createWorld({ ...MAP, terrain: [{ ...reef, kind: 'island' }] }, SLOOP);
    const events: string[] = [];
    gentle.boat = createBoat(0, 34, 0);
    gentle.boat.speedKn = DOCK_SPEED_KN - 0.1;
    for (let t = 0; t < 4; t += DT)
      for (const e of stepWorld(gentle, { steer: 0, sailStep: 0 }, DT)) events.push(e.type);
    expect(events).toContain('bump');
    expect(hullCondition(gentle.trade)).toBe(1);
  });

  it('scales shore and pier damage with impact speed, past a docking bump', () => {
    expect(impactDamage('shore', CRASH_SAFE_KN)).toBe(0);
    expect(impactDamage('pier', CRASH_SAFE_KN + 2)).toBe(2 * CRASH_DAMAGE);
    expect(impactDamage('shore', 7)).toBeGreaterThan(impactDamage('shore', 4));
    expect(impactDamage('reef', 1)).toBeGreaterThan(0);
    expect(impactDamage('sandbank', 8)).toBe(0);
    expect(impactDamage('edge', 8)).toBe(0);
  });

  it('makes harbour piers solid and reports ramming one', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    // One main pier per port and the home island's (0124); Saltmere's moored fishing boats are
    // solid too (0082).
    expect(world.piers.filter((p) => !p.boat)).toHaveLength(PHASE1_MAP.ports.length + 1);
    const pier = world.piers[0]!;
    // Sail straight across the outer end of the pier, from one side to the other.
    const mx = pier.x0 + (pier.x1 - pier.x0) * 0.85,
      my = pier.y0 + (pier.y1 - pier.y0) * 0.85;
    const along = Math.atan2(pier.x1 - pier.x0, pier.y1 - pier.y0);
    const heading = along + Math.PI / 2;
    world.boat = createBoat(mx - Math.sin(heading) * 7, my - Math.cos(heading) * 7, heading);
    world.boat.speedKn = 8;
    world.boat.sailStep = 0;
    const events = [];
    for (let t = 0; t < 1; t += DT) events.push(...stepWorld(world, { steer: 0, sailStep: 0 }, DT));
    const crash = events.find((e) => e.type === 'crash');
    expect(crash).toMatchObject({ type: 'crash', surface: 'pier' });
    expect(hullCondition(world.trade)).toBeLessThan(1);
    const side = (world.boat.x - mx) * Math.sin(heading) + (world.boat.y - my) * Math.cos(heading);
    expect(side).toBeLessThan(0); // still on the near side: it did not sail through
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
    trade.captain.gold = 20 * REPAIR_COST;
    const partial = repairHull(trade);
    expect(partial).toEqual({ ok: true, gold: 20 * REPAIR_COST, points: 20 });
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
