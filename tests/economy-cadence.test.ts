import { afterEach, describe, expect, it, vi } from 'vitest';
import { PHASE1_MAP as map } from '../src/data/maps';
import { TUNING, resetTuning } from '../src/data/tuning';
import * as markets from '../src/sim/market';
import { piersOf } from '../src/sim/collision';
import { GOODS } from '../src/sim/goods';
import { applySave, serializeWorld, validateSave } from '../src/sim/save';
import { addGrowth } from '../src/sim/settlement';
import { SLOOP } from '../src/sim/ship';
import { flushEconomy, stepTrade, tryDock } from '../src/sim/trade';
import { createWorld, type World } from '../src/sim/world';

const offshore = { x: 0, y: -map.boundsRadius + 5, speedKn: 6 };
function step(w: World, dt: number) {
  w.time += dt;
  return stepTrade(w.trade, map, offshore, dt);
}
afterEach(() => {
  vi.restoreAllMocks();
  resetTuning();
});

describe('economy cadence', () => {
  it('reduces market sweeps by over 90% at sea while preserving elapsed outcomes', () => {
    const batched = createWorld(map, SLOOP);
    const reference = createWorld(map, SLOOP);
    const spy = vi.spyOn(markets, 'stepMarket');
    const port = map.ports[0]!.id;
    for (const w of [batched, reference]) {
      w.trade.markets[port]!.stock.grain = 0;
      w.trade.contracts.byPort[port]!.readyIn = 90;
      w.trade.settlements.byPort[port]!.sinceSupply = 200;
      w.trade.settlements.byPort[port]!.growth = 10;
    }
    for (let i = 0; i < 3600; i++) step(batched, 1 / 60);
    flushEconomy(batched.trade, map);
    expect(spy.mock.calls.length).toBeLessThan((3600 * map.ports.length) / 10);
    for (let i = 0; i < 3600; i++) {
      step(reference, 1 / 60);
      flushEconomy(reference.trade, map);
    }
    for (const p of map.ports) {
      for (const g of GOODS)
        expect(batched.trade.markets[p.id]!.stock[g]).toBeCloseTo(
          reference.trade.markets[p.id]!.stock[g],
          8,
        );
      expect(batched.trade.contracts.byPort[p.id]!.readyIn).toBeCloseTo(
        reference.trade.contracts.byPort[p.id]!.readyIn,
        8,
      );
      expect(batched.trade.settlements.byPort[p.id]!.growth).toBeCloseTo(
        reference.trade.settlements.byPort[p.id]!.growth,
        8,
      );
      expect(batched.trade.settlements.byPort[p.id]!.sinceSupply).toBeCloseTo(
        reference.trade.settlements.byPort[p.id]!.sinceSupply,
        8,
      );
    }
  });

  it('reads interval changes live and applies large steps once without losing time', () => {
    const w = createWorld(map, SLOOP);
    step(w, 0);
    step(w, 0.1);
    expect(w.trade.economyPending).toBe(0.1);
    TUNING.economy.updateSeconds = 0.05;
    step(w, 0);
    expect(w.trade.economyPending).toBe(0);
    step(w, 600);
    expect(w.trade.settlements.byPort.westholm!.sinceSupply).toBeCloseTo(600.1);
  });

  it('keeps partial simulation time across saves without offline progression or duplicate events', () => {
    const w = createWorld(map, SLOOP);
    step(w, 0);
    step(w, 0.1);
    const restored = createWorld(map, SLOOP);
    const saved = validateSave(JSON.parse(JSON.stringify(serializeWorld(w))), restored)!;
    applySave(restored, saved);
    expect(restored.trade.economyPending).toBe(0.1);
    expect(serializeWorld(restored).settlements).toEqual(serializeWorld(w).settlements);
    const events = step(w, 0.15);
    expect(step(restored, 0.15)).toEqual(events);
    expect(serializeWorld(restored).markets).toEqual(serializeWorld(w).markets);
    expect(restored.trade.settlements).toEqual(w.trade.settlements);
    expect(step(restored, 0)).toEqual([]);
    expect(validateSave({ ...saved, economyPending: -1 }, restored)!.economyPending).toBe(0);
    expect(validateSave({ ...saved, economyPending: Infinity }, restored)!.economyPending).toBe(0);
  });

  it('processes supplied town growth on the next sailing step without aging new supply retroactively', () => {
    const w = createWorld(map, SLOOP);
    step(w, 0);
    step(w, 0.1);
    addGrowth(w.trade, 'stonehaven', TUNING.economy.towns.growthToLevel[3]);
    expect(step(w, 1 / 60)).toContainEqual({ type: 'level-up', portId: 'stonehaven', level: 3 });
    expect(w.trade.settlements.byPort.stonehaven!.sinceSupply).toBeCloseTo(1 / 60);
  });

  it('saves supplied towns before their immediate growth event and clamps invalid elapsed offsets', () => {
    const w = createWorld(map, SLOOP);
    step(w, 0);
    step(w, 0.1);
    addGrowth(w.trade, 'stonehaven', TUNING.economy.towns.growthToLevel[3]);
    const restored = createWorld(map, SLOOP);
    applySave(restored, validateSave(JSON.parse(JSON.stringify(serializeWorld(w))), restored)!);
    expect(step(restored, 1 / 60)).toEqual(step(w, 1 / 60));
    expect(restored.trade.settlements.byPort.stonehaven!.sinceSupply).toBeCloseTo(1 / 60);
    expect(step(restored, 0).filter((e) => e.type === 'level-up')).toEqual([]);
    const bad = serializeWorld(restored);
    bad.settlements!.byPort.stonehaven!.advancedBeforeSupply = 999;
    applySave(restored, validateSave(bad, restored)!);
    expect(restored.trade.settlements.byPort.stonehaven!.advancedBeforeSupply).toBe(0);
  });

  it('flushes arrival before paused trading, and keeps docked prices and cooldowns current', () => {
    const w = createWorld(map, SLOOP);
    step(w, 0);
    step(w, 0.1);
    const port = map.ports[0]!;
    // At the pier head: she docks only at the harbour (decision 0203).
    const pier = piersOf(map).find((p) => p.islandId === port.islandId && !p.boat)!;
    const boat = { x: pier.x1, y: pier.y1, speedKn: 0 };
    expect(tryDock(w.trade, map, boat, port.id)).toBe(true);
    flushEconomy(w.trade, map); // explicit docking UI flushes before opening its paused panel
    expect(w.trade.economyPending).toBe(0);
    w.trade.contracts.byPort[port.id]!.readyIn = 0.01;
    stepTrade(w.trade, map, boat, 1 / 60);
    expect(w.trade.economyPending).toBe(0);
    expect(w.trade.contracts.byPort[port.id]!.readyIn).toBe(0);
  });
});
