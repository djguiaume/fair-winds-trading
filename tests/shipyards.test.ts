// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { PHASE0_MAP, PHASE1_MAP } from '../src/data/maps';
import { deliverContract } from '../src/sim/contracts';
import { CUTTER, SHIP_CLASSES, SLOOP } from '../src/sim/ship';
import {
  createProgress,
  discoveredPorts,
  homePort,
  readProgress,
  shipOffer,
  shipOffers,
  yardOf,
} from '../src/sim/shipyards';
import { buyShip, buyUpgrade, capacity, stepTrade, switchShip } from '../src/sim/trade';
import { loadGame, saveGame, type SaveStorage } from '../src/sim/save';
import { type World, createWorld } from '../src/sim/world';
import { TradePanel } from '../src/ui/tradePanel';
import { TUNING } from '../src/data/tuning';

// Tuning values moved to src/data/tuning (decision 0094).
const DISCOVER_RANGE = TUNING.economy.discoverRange;

const map = PHASE1_MAP;

function newWorld(): World {
  return createWorld(map, SLOOP);
}

/** Complete `n` orders at a port without sailing (the rules, not the sailing). */
function deliver(world: World, portId: string, n: number) {
  const { trade } = world;
  trade.dockedAt = portId;
  for (let i = 0; i < n; i++) {
    const order = trade.contracts.byPort[portId]!;
    order.readyIn = 0;
    trade.captain.cargo[order.good] += order.qty;
    expect(deliverContract(trade, map).ok).toBe(true);
  }
}

function sailNear(world: World, islandId: string, gap: number) {
  const island = map.islands.find((i) => i.id === islandId)!;
  const boat = { x: island.x, y: island.y + island.radius + gap, speedKn: 6 };
  return stepTrade(world.trade, map, boat, 0.1);
}

describe('ship classes (decision 0035)', () => {
  it('has the swift and hauler lines with the 0035 stats and prices', () => {
    const lines = Object.values(SHIP_CLASSES).map((c) => `${c.line}${c.tier}:${c.id}`);
    expect(lines).toEqual([
      'starter0:sloop',
      'swift1:cutter',
      'swift2:schooner',
      'swift3:clipper',
      'hauler1:hoy',
      'hauler2:fluyt',
      'hauler3:indiaman',
      'racer1:tern',
    ]);
    const { schooner, clipper, hoy, fluyt, indiaman } = SHIP_CLASSES;
    expect([schooner, clipper, hoy, fluyt, indiaman].map((c) => c!.price)).toEqual([
      5000, 20000, 1800, 7000, 25000,
    ]);
    expect([schooner, clipper, hoy, fluyt, indiaman].map((c) => c!.hold)).toEqual([
      30, 50, 25, 60, 120,
    ]);
    // Speed relative to the sloop, as in the 0035 table.
    const speed = (id: string) =>
      Math.round((SHIP_CLASSES[id]!.speedRatio / SLOOP.speedRatio) * 20);
    expect(['schooner', 'clipper', 'hoy', 'fluyt', 'indiaman'].map(speed)).toEqual([
      25, 29, 17, 16, 17,
    ]);
    expect(schooner!.noGoDeg).toBe(38);
    expect(fluyt!.noGoDeg).toBe(55);
  });

  it('gives each line its strength: swift points high and runs fast, haulers carry', () => {
    for (const tier of [1, 2, 3]) {
      const swift = Object.values(SHIP_CLASSES).find((c) => c.line === 'swift' && c.tier === tier)!;
      const hauler = Object.values(SHIP_CLASSES).find(
        (c) => c.line === 'hauler' && c.tier === tier,
      )!;
      expect(swift.speedRatio).toBeGreaterThan(hauler.speedRatio);
      expect(swift.noGoDeg).toBeLessThan(hauler.noGoDeg);
      expect(hauler.hold).toBeGreaterThan(swift.hold);
      expect(hauler.draft).toBeGreaterThanOrEqual(swift.draft);
    }
    // Unlock thresholds rise with the tier; the cutter needs none (Phase 1 goal).
    expect(CUTTER.standing).toBe(0);
    for (const c of Object.values(SHIP_CLASSES))
      if (c.tier >= 2) expect(c.standing).toBeGreaterThan(1);
  });
});

describe('home port and yards (decision 0048)', () => {
  it('uses the map home port, else the port nearest the start', () => {
    expect(homePort(map).id).toBe('saltmere');
    expect(homePort(PHASE0_MAP).id).toBe('saltmere');
  });

  it('builds the cutter at home and the bigger ships at the two hidden yards', () => {
    expect(yardOf(map, 'cutter')!.id).toBe('saltmere');
    expect(yardOf(map, 'schooner')!.id).toBe('watchman-key');
    expect(yardOf(map, 'clipper')!.id).toBe('watchman-key');
    for (const id of ['hoy', 'fluyt', 'indiaman']) expect(yardOf(map, id)!.id).toBe('abbey-head');
    expect(yardOf(map, 'sloop')).toBeNull();
    // A map without yards still sells the cutter at home, nothing bigger.
    expect(yardOf(PHASE0_MAP, 'cutter')!.id).toBe('saltmere');
    expect(yardOf(PHASE0_MAP, 'schooner')).toBeNull();
  });

  it('allows upgrades and ship changes only at the home port', () => {
    const world = newWorld();
    const { trade } = world;
    trade.captain.gold = 10_000;
    trade.dockedAt = 'calda';
    expect(buyUpgrade(trade, map, 'sails')).toEqual({ ok: false, error: 'not-home-port' });
    expect(buyShip(trade, map, 'cutter')).toEqual({ ok: false, error: 'not-at-yard' });
    trade.dockedAt = 'saltmere';
    expect(buyUpgrade(trade, map, 'sails').ok).toBe(true);
    expect(buyShip(trade, map, 'cutter').ok).toBe(true);
    trade.dockedAt = 'calda';
    expect(switchShip(trade, map, 'sloop')).toEqual({ ok: false, error: 'not-home-port' });
    trade.dockedAt = 'saltmere';
    expect(switchShip(trade, map, 'sloop').ok).toBe(true);
  });
});

describe('discovery and standing (decision 0048)', () => {
  it('starts with the four main ports charted and finds a yard when sailing near it', () => {
    const world = newWorld();
    expect(discoveredPorts(map, world.trade).map((p) => p.id)).toEqual([
      'calda',
      'saltmere',
      'westholm',
      'stonehaven',
    ]);
    expect(sailNear(world, 'watchman-key', DISCOVER_RANGE + 5)).toEqual([]);
    expect(sailNear(world, 'watchman-key', DISCOVER_RANGE - 5)).toEqual([
      { type: 'discovered', portId: 'watchman-key' },
    ]);
    // Only once.
    expect(sailNear(world, 'watchman-key', 10)).toEqual([]);
    expect(discoveredPorts(map, world.trade).map((p) => p.id)).toContain('watchman-key');
  });

  it('sells a class once its yard is found and enough orders are delivered there', () => {
    const world = newWorld();
    const { trade } = world;
    trade.captain.gold = 100_000;
    expect(shipOffer(trade, map, 'schooner')).toMatchObject({
      status: 'undiscovered',
      yard: null,
    });
    sailNear(world, 'watchman-key', 30);
    expect(shipOffer(trade, map, 'schooner')).toMatchObject({
      status: 'needs-standing',
      ordersLeft: 3,
    });
    trade.dockedAt = 'watchman-key';
    expect(buyShip(trade, map, 'schooner')).toEqual({ ok: false, error: 'ship-locked' });
    deliver(world, 'watchman-key', 2);
    expect(shipOffer(trade, map, 'schooner').ordersLeft).toBe(1);
    // Orders elsewhere don't count.
    deliver(world, 'calda', 3);
    expect(shipOffer(trade, map, 'schooner').ordersLeft).toBe(1);
    deliver(world, 'watchman-key', 1);
    expect(shipOffer(trade, map, 'schooner').status).toBe('for-sale');
    expect(shipOffer(trade, map, 'clipper')).toMatchObject({
      status: 'needs-standing',
      ordersLeft: 3,
    });
    for (const g of Object.keys(trade.captain.cargo)) trade.captain.cargo[g as 'fish'] = 0;
    trade.dockedAt = 'watchman-key';
    expect(buyShip(trade, map, 'schooner')).toEqual({ ok: true, gold: 5000 });
    expect(trade.captain.activeShip).toBe('schooner');
    expect(capacity(trade)).toBe(30);
    expect(shipOffer(trade, map, 'schooner').status).toBe('owned');
  });

  it('opens the hoy after one delivery at Abbey Head', () => {
    const world = newWorld();
    sailNear(world, 'abbey-head', 30);
    expect(shipOffer(world.trade, map, 'hoy').ordersLeft).toBe(1);
    deliver(world, 'abbey-head', 1);
    expect(
      shipOffers(world.trade, map)
        .filter((o) => o.status === 'for-sale')
        .map((o) => o.cls.id),
    ).toEqual(['cutter', 'hoy']);
  });

  it('saves discovery and standing; older saves start with the main ports', () => {
    const data = new Map<string, string>();
    const storage: SaveStorage = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    };
    const world = newWorld();
    sailNear(world, 'abbey-head', 30);
    deliver(world, 'abbey-head', 2);
    expect(saveGame(storage, world)).toBe(true);
    const resumed = newWorld();
    expect(loadGame(storage, resumed)).toBe(true);
    expect(resumed.trade.progress).toEqual(world.trade.progress);

    expect(readProgress(undefined, map)).toEqual(createProgress(map));
    expect(
      readProgress(
        {
          discovered: ['nowhere', 'abbey-head'],
          standing: { calda: -2, westholm: 1.5, 'abbey-head': 2 },
        },
        map,
      ),
    ).toEqual({
      ...createProgress(map),
      discovered: [...createProgress(map).discovered, 'abbey-head'],
      standing: { 'abbey-head': 2 },
    });
  });
});

describe('shipyard tab (decision 0048)', () => {
  function panelAt(world: World, portId: string) {
    world.trade.dockedAt = portId;
    document.body.innerHTML = '<div id="panel" hidden></div>';
    const container = document.querySelector<HTMLElement>('#panel')!;
    const panel = new TradePanel(container, world);
    panel.open('shipyard');
    return container;
  }

  it('away from home: no upgrades, and each ship says where it is built', () => {
    const world = newWorld();
    sailNear(world, 'watchman-key', 30);
    const panel = panelAt(world, 'calda');
    expect(panel.querySelector('[data-track]')).toBeNull();
    expect(panel.textContent).toContain('Upgrades are fitted at your home port, Saltmere.');
    expect(panel.textContent).toContain('Built at Saltmere · 1,500 gold');
    expect(panel.textContent).toContain('Orders to deliver at Watchman Key: 3');
    expect(panel.textContent).toContain('Built at a port off the chart');
  });

  it('at a yard: buys the unlocked ship there', () => {
    const world = newWorld();
    world.trade.captain.gold = 10_000;
    sailNear(world, 'abbey-head', 30);
    deliver(world, 'abbey-head', 1);
    const panel = panelAt(world, 'abbey-head');
    expect(panel.textContent).toContain('Shipwright');
    panel.querySelector<HTMLButtonElement>('[data-ship-buy="hoy"]')!.click();
    expect(world.trade.captain.activeShip).toBe('hoy');
    expect(panel.querySelector('[data-ship-switch]')).toBeNull();
    expect(panel.textContent).toContain('Moored at Saltmere');
  });
});
