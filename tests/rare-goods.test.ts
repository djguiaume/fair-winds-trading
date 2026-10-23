import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { contractReward, deliverContract, haulDistance } from '../src/sim/contracts';
import { GOOD_DEFS, RARE_GOODS, SPECIALTY_GOODS, isMadeGood } from '../src/sim/goods';
import { trades } from '../src/sim/market';
import { distance } from '../src/sim/math';
import { type SaveStorage, loadGame, saveGame } from '../src/sim/save';
import {
  addGrowth,
  madeGoods,
  portProduces,
  portTownGate,
  rareWants,
  settlementLevel,
  wantsAt,
} from '../src/sim/settlement';
import { SLOOP } from '../src/sim/ship';
import { sell, stepTrade } from '../src/sim/trade';
import { type World, createWorld } from '../src/sim/world';
import { TUNING } from '../src/data/tuning';

// Tuning values moved to src/data/tuning (decision 0094).
const GROWTH_TO_LEVEL = TUNING.economy.towns.growthToLevel;
const RARE_FOR_PORT_TOWN = TUNING.economy.towns.rareForPortTown;

/** Rare goods from the far yards and the port town gate (decision 0065). */

const MAP = PHASE1_MAP;

function world(): World {
  return createWorld(MAP, SLOOP);
}

function step(w: World, seconds: number) {
  const boat = { x: 0, y: -MAP.boundsRadius + 5, speedKn: 6 };
  return stepTrade(w.trade, MAP, boat, seconds);
}

/** Grow a port one level at a time until it reaches `level` (the gate may stop it at town). */
function growTo(w: World, portId: string, level: number) {
  for (let i = 0; i < 4 && settlementLevel(w.trade, portId) < level; i++) {
    addGrowth(w.trade, portId, 400);
    step(w, 0.1);
  }
}

const port = (id: string) => MAP.ports.find((p) => p.id === id)!;
const island = (id: string) => MAP.islands.find((i) => i.id === port(id).islandId)!;

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

describe('rare goods from the far yards (0065)', () => {
  it('are worth more than any specialty and trade nowhere at the start', () => {
    const top = Math.max(...SPECIALTY_GOODS.map((g) => GOOD_DEFS[g].basePrice));
    for (const g of RARE_GOODS) {
      expect(isMadeGood(g)).toBe(true);
      expect(GOOD_DEFS[g].basePrice).toBeGreaterThan(top);
    }
    const w = world();
    for (const m of Object.values(w.trade.markets))
      for (const g of RARE_GOODS) expect(trades(m, g)).toBe(false);
  });

  it('only the two yards make them, from village level', () => {
    expect(portProduces(port('abbey-head'), 1)).toEqual([]);
    expect(portProduces(port('abbey-head'), 2)).toEqual(['honey']);
    expect(portProduces(port('watchman-key'), 2)).toEqual(['lampOil']);
    for (const p of MAP.ports.filter((p) => !p.hidden))
      for (const g of RARE_GOODS) expect(portProduces(p, 4)).not.toContain(g);
  });

  it('are bought only across the map', () => {
    for (const g of RARE_GOODS) {
      const maker = MAP.ports.find((p) => portProduces(p, 4).includes(g))!;
      const buyers = MAP.ports.filter((p) => rareWants(p).includes(g));
      expect(buyers.length).toBe(2);
      for (const b of buyers) {
        expect(distance(island(maker.id), island(b.id))).toBeGreaterThan(550);
        // Long hauls pay: an order pays well over twice the base price per unit.
        expect(haulDistance(MAP, b, g)).toBeGreaterThan(550);
        expect(contractReward(MAP, b, g, 10)).toBeGreaterThan(GOOD_DEFS[g].basePrice * 20);
      }
    }
    // Every charted port wants exactly one rare good; the yards want none.
    for (const p of MAP.ports) expect(rareWants(p).length).toBe(p.hidden ? 0 : 1);
  });

  it('a yard that grows opens a market for its good at both its buyers', () => {
    const w = world();
    const t = w.trade;
    expect(wantsAt(MAP, t, 'saltmere')).not.toContain('honey');
    growTo(w, 'abbey-head', 2);
    expect(madeGoods(MAP, t).has('honey')).toBe(true);
    expect(trades(t.markets['abbey-head']!, 'honey')).toBe(true);
    expect(t.markets['abbey-head']!.stock.honey).toBeGreaterThan(0);
    // Its buyers open at once, whatever their size, so honey never sits unsold in a hold.
    for (const id of ['saltmere', 'stonehaven']) {
      expect(wantsAt(MAP, t, id)).toContain('honey');
      expect(trades(t.markets[id]!, 'honey')).toBe(true);
    }
    expect(trades(t.markets.calda!, 'honey')).toBe(false);
    expect(trades(t.markets.westholm!, 'lampOil')).toBe(false);
  });

  it('a town becomes a port town only after its rare good, sold or delivered', () => {
    const w = world();
    const t = w.trade;
    growTo(w, 'abbey-head', 2);
    growTo(w, 'saltmere', 4);
    expect(settlementLevel(t, 'saltmere')).toBe(3);
    expect(t.settlements.byPort.saltmere!.growth).toBe(GROWTH_TO_LEVEL[4]);
    expect(portTownGate(MAP, t, 'saltmere')).toEqual({
      goods: ['honey'],
      have: 0,
      need: RARE_FOR_PORT_TOWN,
    });

    t.dockedAt = 'saltmere';
    t.captain.cargo.honey = 12;
    expect(sell(t, 'honey', 12, MAP).ok).toBe(true);
    expect(portTownGate(MAP, t, 'saltmere')!.have).toBe(12);
    step(w, 0.1);
    expect(settlementLevel(t, 'saltmere')).toBe(3);

    // An order for honey counts too.
    t.contracts.byPort.saltmere = {
      portId: 'saltmere',
      good: 'honey',
      qty: 8,
      reward: 500,
      readyIn: 0,
    };
    t.dockedAt = 'saltmere';
    t.captain.cargo.honey = 8;
    expect(deliverContract(t, MAP).ok).toBe(true);
    expect(portTownGate(MAP, t, 'saltmere')).toBeNull();
    const ups = step(w, 0.1);
    expect(ups).toContainEqual({ type: 'level-up', portId: 'saltmere', level: 4 });
  });

  it('the yards have no gate', () => {
    const w = world();
    growTo(w, 'watchman-key', 4);
    expect(settlementLevel(w.trade, 'watchman-key')).toBe(4);
  });

  it('the count of rare goods survives a save', () => {
    const w = world();
    w.trade.settlements.byPort.calda!.rare = 7;
    const storage = new MemoryStorage();
    saveGame(storage, w);
    const back = world();
    expect(loadGame(storage, back)).toBe(true);
    expect(back.trade.settlements.byPort.calda!.rare).toBe(7);
  });
});
