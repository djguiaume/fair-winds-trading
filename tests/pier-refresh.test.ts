import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { piersOf } from '../src/sim/collision';
import { settlementLevels } from '../src/sim/settlement';
import { SLOOP } from '../src/sim/ship';
import { createTradeState } from '../src/sim/trade';
import { createWorld, refreshPiers } from '../src/sim/world';

function setup() {
  const world = createWorld(PHASE1_MAP, SLOOP);
  refreshPiers(world);
  return world;
}

describe('pier refresh invalidation (0090)', () => {
  it('retains geometry through unchanged levels, growth and reordered settlement records', () => {
    const world = setup();
    const piers = world.piers;
    world.trade.settlements.byPort.calda!.growth++;
    world.trade.settlements.byPort = Object.fromEntries(
      Object.entries(world.trade.settlements.byPort).reverse(),
    );
    refreshPiers(world);
    expect(world.piers).toBe(piers);
  });

  it('rebuilds for in-place levels, including the first refresh after creation', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.trade.settlements.byPort.calda!.level = 4;
    refreshPiers(world);
    expect(world.piers).toEqual(piersOf(world.map, settlementLevels(world.trade)));
    const piers = world.piers;
    world.trade.settlements.byPort.calda!.level = 3;
    refreshPiers(world);
    expect(world.piers).not.toBe(piers);
    expect(world.piers).toEqual(piersOf(world.map, settlementLevels(world.trade)));
  });

  it('detects removals and replacements with the same number of settlements', () => {
    const world = setup();
    let piers = world.piers;
    const settlement = world.trade.settlements.byPort.calda!;
    delete world.trade.settlements.byPort.calda;
    refreshPiers(world);
    expect(world.piers).not.toBe(piers);
    piers = world.piers;
    world.trade.settlements.byPort.calda = settlement;
    delete world.trade.settlements.byPort.saltmere;
    refreshPiers(world);
    expect(world.piers).not.toBe(piers);
    expect(world.piers).toEqual(piersOf(world.map, settlementLevels(world.trade)));
  });

  it('reads replaced trade and settlement stores, as when loading a save', () => {
    const world = setup();
    world.trade.settlements.byPort.calda!.level = 4;
    refreshPiers(world);
    const piers = world.piers;
    world.trade = createTradeState(PHASE1_MAP, SLOOP);
    refreshPiers(world);
    expect(world.piers).not.toBe(piers);
    expect(world.piers).toEqual(piersOf(world.map, settlementLevels(world.trade)));
    const loadedPiers = world.piers;
    world.trade.settlements = structuredClone(world.trade.settlements);
    world.trade.settlements.byPort.calda!.level = 3;
    refreshPiers(world);
    expect(world.piers).not.toBe(loadedPiers);
  });

  it('rebuilds for a replacement map even when settlement levels are unchanged', () => {
    const world = setup();
    const piers = world.piers;
    world.map = { ...world.map, islands: [] };
    refreshPiers(world);
    expect(world.piers).not.toBe(piers);
    expect(world.piers).toEqual([]);
  });
});
