import { describe, expect, it } from 'vitest';
import { PHASE0_MAP, PHASE1_MAP } from '../src/data/maps';
import { deliverContract } from '../src/sim/contracts';
import { isGood } from '../src/sim/goods';
import { EQUILIBRIUM } from '../src/sim/market';
import { type SaveStorage, loadGame, saveGame } from '../src/sim/save';
import {
  GROWTH_TO_LEVEL,
  MAX_SETTLEMENT_LEVEL,
  ORDER_GROWTH_BONUS,
  STALL_SECONDS,
  addGrowth,
  portWants,
  readSettlements,
  settlementLevel,
  settlementLevels,
  startLevel,
  stepSettlements,
  wantsAt,
} from '../src/sim/settlement';
import { SLOOP } from '../src/sim/ship';
import { homePort } from '../src/sim/shipyards';
import { buyUpgrade, sell, stepTrade } from '../src/sim/trade';
import { type World, createWorld, stepWorld } from '../src/sim/world';

const MAP = PHASE1_MAP;

function world(): World {
  return createWorld(MAP, SLOOP);
}

/** Step the trade state as the game does, with the boat far out at sea. */
function step(w: World, seconds: number) {
  const boat = { x: 0, y: -MAP.boundsRadius + 5, speedKn: 6 };
  return stepTrade(w.trade, MAP, boat, seconds);
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

describe('settlement levels (0059)', () => {
  it('starts every port at its map level, including hidden yards', () => {
    const w = world();
    expect(settlementLevels(w.trade)).toEqual({
      calda: 2,
      saltmere: 2,
      westholm: 2,
      stonehaven: 2,
      'watchman-key': 1,
      'abbey-head': 1,
    });
    // Maps without settlement data play as villages, the Phase 1 tuning.
    for (const port of PHASE0_MAP.ports) expect(startLevel(port)).toBe(2);
  });

  it('map level wants are real goods the port does not make, unlocked in order', () => {
    for (const port of MAP.ports) {
      for (const goods of Object.values(port.levelWants ?? {}))
        for (const g of goods!) {
          expect(isGood(g)).toBe(true);
          expect(port.produces).not.toContain(g);
          expect(port.wants).not.toContain(g);
        }
      let prev = portWants(port, 1);
      for (let l = 2; l <= MAX_SETTLEMENT_LEVEL; l++) {
        const now = portWants(port, l);
        expect(now.slice(0, prev.length)).toEqual(prev);
        prev = now;
      }
    }
    const calda = MAP.ports.find((p) => p.id === 'calda')!;
    expect(portWants(calda, 2)).toEqual(['fish', 'stone']);
    expect(portWants(calda, 3)).toEqual(['fish', 'stone', 'grain']);
  });

  it('selling wanted goods and delivering orders grow the town', () => {
    const w = world();
    const t = w.trade;
    t.dockedAt = 'saltmere';
    t.captain.cargo.timber = 5;
    t.captain.cargo.stone = 5;
    sell(t, 'timber', 5, MAP);
    expect(t.settlements.byPort.saltmere!.growth).toBe(5);
    // Saltmere does not want stone yet: no growth from it.
    sell(t, 'stone', 5, MAP);
    expect(t.settlements.byPort.saltmere!.growth).toBe(5);

    const order = t.contracts.byPort.saltmere!;
    t.captain.cargo[order.good] = order.qty;
    expect(deliverContract(t, MAP).ok).toBe(true);
    expect(t.settlements.byPort.saltmere!.growth).toBe(5 + order.qty + ORDER_GROWTH_BONUS);
  });

  it('levels up one step at a time, with an event, deeper demand and new wants', () => {
    const w = world();
    const t = w.trade;
    const calda = MAP.ports.find((p) => p.id === 'calda')!;
    expect(t.markets.calda!.equilibrium.grain).toBe(EQUILIBRIUM.neutral);
    expect(t.markets.calda!.equilibrium.fish).toBe(EQUILIBRIUM.wants);

    addGrowth(t, 'calda', GROWTH_TO_LEVEL[3] + GROWTH_TO_LEVEL[4] + 10);
    const first = step(w, 0.1);
    expect(first.filter((e) => e.type === 'level-up')).toEqual([
      { type: 'level-up', portId: 'calda', level: 3 },
    ]);
    expect(settlementLevel(t, 'calda')).toBe(3);
    expect(wantsAt(MAP, t, 'calda')).toEqual(portWants(calda, 3));
    // A town eats more of what it wants and makes more of what it produces.
    expect(t.markets.calda!.equilibrium.grain).toBeLessThan(EQUILIBRIUM.wants);
    expect(t.markets.calda!.equilibrium.fish).toBeLessThan(EQUILIBRIUM.wants);
    expect(t.markets.calda!.equilibrium.timber).toBeGreaterThan(EQUILIBRIUM.produces);

    const second = step(w, 0.1);
    expect(second).toContainEqual({ type: 'level-up', portId: 'calda', level: 4 });
    expect(settlementLevel(t, 'calda')).toBe(4);
    // The top level stops counting growth.
    addGrowth(t, 'calda', 1000);
    expect(step(w, 0.1).some((e) => e.type === 'level-up')).toBe(false);
    expect(settlementLevel(t, 'calda')).toBe(4);
  });

  it('a neglected town stalls but never shrinks', () => {
    const w = world();
    const t = w.trade;
    addGrowth(t, 'westholm', 20);
    stepSettlements(t, STALL_SECONDS - 1);
    expect(t.settlements.byPort.westholm!.growth).toBe(20);
    stepSettlements(t, 60 * 30);
    expect(t.settlements.byPort.westholm!.growth).toBe(0);
    expect(settlementLevel(t, 'westholm')).toBe(2);
    // Fresh supply restarts the clock.
    addGrowth(t, 'westholm', 4);
    stepSettlements(t, 60);
    expect(t.settlements.byPort.westholm!.growth).toBe(4);
  });

  it('the top upgrades wait for the home port to become a town', () => {
    const w = world();
    const t = w.trade;
    const home = homePort(MAP).id;
    t.dockedAt = home;
    t.captain.gold = 10_000;
    expect(buyUpgrade(t, MAP, 'hold').ok).toBe(true);
    expect(buyUpgrade(t, MAP, 'hold')).toEqual({ ok: false, error: 'port-too-small' });
    addGrowth(t, home, GROWTH_TO_LEVEL[3]);
    step(w, 0.1);
    t.dockedAt = home;
    expect(buyUpgrade(t, MAP, 'hold').ok).toBe(true);
  });

  it('stepWorld reports level-ups', () => {
    const w = world();
    addGrowth(w.trade, 'stonehaven', GROWTH_TO_LEVEL[3]);
    const events = stepWorld(w, { steer: 0, sailStep: 0 }, 1 / 60);
    expect(events).toContainEqual({ type: 'level-up', portId: 'stonehaven', level: 3 });
  });

  it('saves and restores levels, growth and the market depth that goes with them', () => {
    const w = world();
    addGrowth(w.trade, 'westholm', GROWTH_TO_LEVEL[3] + 7);
    step(w, 0.1);
    const storage = new MemoryStorage();
    expect(saveGame(storage, w)).toBe(true);

    const back = world();
    expect(loadGame(storage, back)).toBe(true);
    expect(settlementLevel(back.trade, 'westholm')).toBe(3);
    expect(back.trade.settlements.byPort.westholm!.growth).toBeCloseTo(7);
    expect(back.trade.markets.westholm!.equilibrium).toEqual(w.trade.markets.westholm!.equilibrium);
  });

  it('older saves without settlements load at the map levels; bad data is cleaned', () => {
    expect(readSettlements(undefined, MAP)).toEqual(readSettlements({}, MAP));
    const read = readSettlements(
      {
        byPort: {
          calda: { level: 9, growth: 5 },
          saltmere: { level: 1, growth: -3 },
          westholm: { level: 3, growth: 1e9, sinceSupply: 'x' },
          nowhere: { level: 4 },
        },
      },
      MAP,
    );
    expect(read.byPort.calda).toEqual({ level: 4, growth: 0, sinceSupply: 0 });
    // Never below the map's starting level.
    expect(read.byPort.saltmere).toEqual({ level: 2, growth: 0, sinceSupply: 0 });
    expect(read.byPort.westholm).toEqual({ level: 3, growth: GROWTH_TO_LEVEL[4], sinceSupply: 0 });
    expect(read.byPort.nowhere).toBeUndefined();

    const w = world();
    const storage = new MemoryStorage();
    saveGame(storage, w);
    const raw = JSON.parse(storage.getItem('fwt.save.v1')!);
    delete raw.settlements;
    storage.setItem('fwt.save.v1', JSON.stringify(raw));
    const back = world();
    expect(loadGame(storage, back)).toBe(true);
    expect(settlementLevels(back.trade)).toEqual(settlementLevels(w.trade));
  });
});
