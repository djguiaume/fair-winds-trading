import { describe, expect, it } from 'vitest';
import { PHASE0_MAP } from '../src/data/maps';
import { GOODS, GOOD_DEFS, isGood } from '../src/sim/goods';
import {
  EQUILIBRIUM,
  createMarket,
  midPrice,
  quoteBuy,
  quoteSell,
  stepMarket,
  unitBuyPrice,
  unitSellPrice,
} from '../src/sim/market';
import { CUTTER, SLOOP } from '../src/sim/ship';
import {
  DOCK_RANGE,
  START_GOLD,
  type TradeState,
  activeShip,
  buy,
  buyShip,
  buyUpgrade,
  capacity,
  freeSpace,
  maxBuy,
  sell,
  switchShip,
} from '../src/sim/trade';
import { effectiveShip, holdCapacity, upgradePrice } from '../src/sim/upgrades';
import { type World, createWorld, stepWorld } from '../src/sim/world';
import {
  SAVE_KEY,
  type SaveStorage,
  clearSave,
  loadGame,
  saveGame,
  serializeWorld,
} from '../src/sim/save';

const DT = 1 / 60;

function newWorld(): World {
  return createWorld(PHASE0_MAP, SLOOP);
}

/** Dock at a port without sailing there (tests of the rules, not of the sailing). */
function dock(world: World, portId: string): TradeState {
  world.trade.dockedAt = portId;
  return world.trade;
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

describe('map ports', () => {
  it('sit on real islands and use known goods', () => {
    expect(PHASE0_MAP.ports.length).toBeGreaterThanOrEqual(3);
    for (const port of PHASE0_MAP.ports) {
      expect(PHASE0_MAP.islands.some((i) => i.id === port.islandId)).toBe(true);
      expect(port.produces.length).toBeGreaterThan(0);
      for (const g of [...port.produces, ...port.wants]) expect(isGood(g)).toBe(true);
    }
  });
  it('every good is made somewhere and wanted somewhere else', () => {
    for (const g of GOODS) {
      expect(PHASE0_MAP.ports.some((p) => p.produces.includes(g))).toBe(true);
      expect(PHASE0_MAP.ports.some((p) => p.wants.includes(g))).toBe(true);
    }
  });
});

describe('market prices', () => {
  const port = PHASE0_MAP.ports.find((p) => p.id === 'stonehaven')!;

  it('are cheap where a good is made and dear where it is wanted', () => {
    const m = createMarket(port);
    expect(midPrice('stone', m.stock.stone)).toBeLessThan(GOOD_DEFS.stone.basePrice);
    expect(midPrice('grain', m.stock.grain)).toBeGreaterThan(GOOD_DEFS.grain.basePrice * 1.5);
    expect(midPrice('fish', EQUILIBRIUM.neutral)).toBeCloseTo(GOOD_DEFS.fish.basePrice);
  });

  it('rise as you buy and fall as you sell, with a spread', () => {
    const m = createMarket(port);
    const s = m.stock.timber;
    expect(unitBuyPrice('timber', s - 5)).toBeGreaterThan(unitBuyPrice('timber', s));
    expect(unitSellPrice('timber', s + 5)).toBeLessThan(unitSellPrice('timber', s));
    expect(unitBuyPrice('timber', s)).toBeGreaterThan(unitSellPrice('timber', s));
    // A big order costs more than that many times the first unit.
    expect(quoteBuy(m, 'stone', 25)).toBeGreaterThan(25 * unitBuyPrice('stone', m.stock.stone));
  });

  it('cannot be arbitraged by buying and selling back at the same port', () => {
    const m = createMarket(port);
    for (const g of GOODS) {
      const cost = quoteBuy(m, g, 5);
      m.stock[g] -= 5;
      expect(quoteSell(m, g, 5)).toBeLessThan(cost);
      m.stock[g] += 5;
    }
  });

  it('recover toward equilibrium over time', () => {
    const m = createMarket(port);
    m.stock.stone = 10;
    m.stock.grain = 40;
    for (let t = 0; t < 600; t += 1) stepMarket(m, 1);
    expect(m.stock.stone).toBeGreaterThan(EQUILIBRIUM.produces * 0.95);
    expect(m.stock.grain).toBeLessThan(EQUILIBRIUM.wants * 1.2);
  });
});

describe('trading', () => {
  it('needs a port', () => {
    const world = newWorld();
    expect(buy(world.trade, 'fish', 1)).toEqual({ ok: false, error: 'not-docked' });
    expect(buyUpgrade(world.trade, 'sails')).toEqual({ ok: false, error: 'not-docked' });
  });

  it('moves gold, cargo and stock', () => {
    const world = newWorld();
    const trade = dock(world, 'saltmere');
    const stock = trade.markets.saltmere!.stock.fish;
    const r = buy(trade, 'fish', 4);
    expect(r.ok).toBe(true);
    expect(trade.captain.gold).toBe(START_GOLD - (r.ok ? r.gold : 0));
    expect(trade.captain.cargo.fish).toBe(4);
    expect(trade.markets.saltmere!.stock.fish).toBeCloseTo(stock - 4);
    expect(freeSpace(trade)).toBe(SLOOP.hold - 4);

    const s = sell(trade, 'fish', 4);
    expect(s.ok && s.gold > 0).toBe(true);
    expect(trade.captain.cargo.fish).toBe(0);
  });

  it('refuses what the hold, the purse or the port cannot take', () => {
    const world = newWorld();
    const trade = dock(world, 'saltmere');
    expect(buy(trade, 'fish', SLOOP.hold + 1)).toEqual({ ok: false, error: 'hold-full' });
    expect(buy(trade, 'fish', 0)).toEqual({ ok: false, error: 'bad-quantity' });
    expect(buy(trade, 'fish', 1.5)).toEqual({ ok: false, error: 'bad-quantity' });
    expect(sell(trade, 'stone', 1)).toEqual({ ok: false, error: 'not-in-hold' });
    trade.captain.gold = 5;
    expect(buy(trade, 'grain', 3)).toEqual({ ok: false, error: 'not-enough-gold' });
    trade.markets.saltmere!.stock.grain = 2.5;
    trade.captain.gold = 1000;
    expect(buy(trade, 'grain', 3)).toEqual({ ok: false, error: 'out-of-stock' });
  });

  it('maxBuy is the most that actually goes through', () => {
    const world = newWorld();
    const trade = dock(world, 'stonehaven');
    trade.captain.gold = 60;
    const n = maxBuy(trade, 'stone');
    expect(n).toBeGreaterThan(0);
    expect(buy(trade, 'stone', n + 1).ok).toBe(false);
    expect(buy(trade, 'stone', n).ok).toBe(true);
  });
});

describe('docking', () => {
  it('docks when the boat slows down near a port and undocks when it sails away', () => {
    const world = newWorld();
    const island = PHASE0_MAP.islands.find((i) => i.id === 'westholm')!;
    world.boat.x = island.x + island.radius + DOCK_RANGE - 2;
    world.boat.y = island.y;
    world.boat.heading = Math.PI / 2; // east, away from the island
    world.boat.speedKn = 0;
    const events = stepWorld(world, { steer: 0, sailStep: 0 }, DT);
    expect(events).toContainEqual({ type: 'docked', portId: 'westholm' });
    expect(world.trade.dockedAt).toBe('westholm');

    world.boat.x += 40;
    const later = stepWorld(world, { steer: 0, sailStep: 0 }, DT);
    expect(later).toContainEqual({ type: 'undocked', portId: 'westholm' });
    expect(world.trade.dockedAt).toBeNull();
  });

  it('does not dock while sailing past at speed', () => {
    const world = newWorld();
    const island = PHASE0_MAP.islands.find((i) => i.id === 'westholm')!;
    world.boat.x = island.x + island.radius + 5;
    world.boat.y = island.y;
    world.boat.speedKn = 6;
    stepWorld(world, { steer: 0, sailStep: 2 }, DT);
    expect(world.trade.dockedAt).toBeNull();
  });
});

describe('shipyard', () => {
  it('upgrades change the sailing numbers and the hold', () => {
    const world = newWorld();
    const trade = dock(world, 'calda');
    trade.captain.gold = 10_000;
    const before = activeShip(trade);
    const [l2, l3] = SLOOP.upgradePrices;
    expect(upgradePrice(SLOOP, trade.captain.ships.sloop!, 'sails')).toBe(l2);
    expect(buyUpgrade(trade, 'sails')).toEqual({ ok: true, gold: l2 });
    expect(buyUpgrade(trade, 'sails')).toEqual({ ok: true, gold: l3 });
    expect(buyUpgrade(trade, 'sails')).toEqual({ ok: false, error: 'max-level' });
    expect(activeShip(trade).speedRatio).toBeGreaterThan(before.speedRatio * 1.1);
    expect(activeShip(trade).accel).toBeGreaterThan(before.accel);

    buyUpgrade(trade, 'hold');
    expect(capacity(trade)).toBe(16);
    buyUpgrade(trade, 'hold');
    expect(capacity(trade)).toBe(22);

    // The boat sails with the upgrades from the next step.
    stepWorld(world, { steer: 0, sailStep: 0 }, DT);
    expect(world.ship.speedRatio).toBe(activeShip(trade).speedRatio);
    expect(trade.captain.gold).toBe(10_000 - 2 * (l2 + l3));
  });

  it('a stock ship sails exactly like its class', () => {
    expect(effectiveShip(SLOOP, { sails: 1, hold: 1, hull: 1 })).toEqual(SLOOP);
    expect(holdCapacity(CUTTER, { sails: 1, hold: 3, hull: 1 })).toBe(35);
  });

  it('sells the cutter, which then becomes the active ship', () => {
    const world = newWorld();
    const trade = dock(world, 'calda');
    expect(buyShip(trade, 'cutter')).toEqual({ ok: false, error: 'not-enough-gold' });
    trade.captain.gold = 2000;
    expect(buyShip(trade, 'cutter')).toEqual({ ok: true, gold: 1500 });
    expect(trade.captain.activeShip).toBe('cutter');
    expect(capacity(trade)).toBe(CUTTER.hold);
    expect(activeShip(trade).noGoAngle).toBeLessThan(SLOOP.noGoAngle);
    expect(buyShip(trade, 'cutter')).toEqual({ ok: false, error: 'already-owned' });
    expect(buyShip(trade, 'galleon')).toEqual({ ok: false, error: 'unknown-ship' });

    // Back to the sloop only if the cargo fits in it.
    trade.captain.cargo.timber = 12;
    expect(switchShip(trade, 'sloop')).toEqual({ ok: false, error: 'cargo-too-big' });
    trade.captain.cargo.timber = 4;
    expect(switchShip(trade, 'sloop').ok).toBe(true);
    expect(trade.captain.activeShip).toBe('sloop');
  });
});

describe('economy balance', () => {
  it('dumping a whole hold on one port pays less each time', () => {
    const world = newWorld();
    const trade = dock(world, 'calda');
    trade.captain.cargo.stone = 10;
    const first = sell(trade, 'stone', 10);
    trade.captain.cargo.stone = 10;
    const second = sell(trade, 'stone', 10);
    expect(first.ok && second.ok && second.gold < first.gold).toBe(true);
  });
});

describe('save and load', () => {
  it('round-trips progress through storage', () => {
    const storage = new MemoryStorage();
    const world = newWorld();
    const trade = dock(world, 'calda');
    trade.captain.gold = 5000;
    buyShip(trade, 'cutter');
    buyUpgrade(trade, 'hull');
    buy(trade, 'timber', 5);
    world.boat.x = 12;
    world.boat.y = -34;
    world.time = 321;
    expect(saveGame(storage, world)).toBe(true);

    const resumed = newWorld();
    expect(loadGame(storage, resumed)).toBe(true);
    expect(serializeWorld(resumed)).toEqual(serializeWorld(world));
    expect(resumed.ship.id).toBe('cutter');
    expect(resumed.boat.speedKn).toBe(0);
  });

  it('starts fresh on a missing, damaged or foreign save', () => {
    const storage = new MemoryStorage();
    const world = newWorld();
    expect(loadGame(storage, world)).toBe(false);
    storage.setItem(SAVE_KEY, '{not json');
    expect(loadGame(storage, world)).toBe(false);

    const data = serializeWorld(world);
    for (const bad of [
      { ...data, version: 99 },
      { ...data, map: 'Other sea' },
      { ...data, gold: -5 },
      { ...data, activeShip: 'cutter' },
      { ...data, ships: { sloop: { sails: 4, hold: 1, hull: 1 } } },
      { ...data, cargo: { ...data.cargo, fish: 1.5 } },
      { ...data, dockedAt: 'atlantis' },
    ]) {
      storage.setItem(SAVE_KEY, JSON.stringify(bad));
      expect(loadGame(storage, world)).toBe(false);
    }
    expect(world.trade.captain.gold).toBe(START_GOLD);
    clearSave(storage);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });

  it('survives storage that throws (private mode)', () => {
    const broken: SaveStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    const world = newWorld();
    expect(saveGame(broken, world)).toBe(false);
    expect(loadGame(broken, world)).toBe(false);
    expect(() => clearSave(broken)).not.toThrow();
  });
});
