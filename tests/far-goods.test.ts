import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { seaLegSeconds, seaOf } from '../src/sim/balance';
import { deliverContract } from '../src/sim/contracts';
import { DIFFICULTIES, type Difficulty } from '../src/sim/difficulty';
import { CRAFTED_FROM, FAR_GOODS, GOOD_DEFS, type GoodId, isMadeGood } from '../src/sim/goods';
import type { IslandDef, MapDef, PortDef } from '../src/sim/map';
import { quickChecks } from '../src/sim/mapChecks';
import { available, equilibriumFor, trades } from '../src/sim/market';
import { type SaveStorage, loadGame, saveGame, serializeWorld } from '../src/sim/save';
import { packSave, unpackSave } from '../src/sim/saveCode';
import { readSaveCode } from '../src/sim/saveTransfer';
import {
  addGrowth,
  addRare,
  madeGoods,
  portTownGate,
  settlementLevel,
  wantsAt,
} from '../src/sim/settlement';
import { SHIP_CLASSES, SLOOP } from '../src/sim/ship';
import { buy, sell, setDifficulty, stepTrade, syncMarketLevels } from '../src/sim/trade';
import { effectiveShip } from '../src/sim/upgrades';
import { type World, createWorld } from '../src/sim/world';
import { TUNING } from '../src/data/tuning';

/**
 * Far goods (decision 0146): the outpost gathers a raw far good, the main port's workshop crafts
 * it only from raw units received, and only the ring's port towns buy the crafted good. The seas
 * are not built yet, so the south sea's two ports are added to the ring at the placeholder sites
 * of the Phase 4 layout review (bearing clockwise from north, distance from the centre).
 */
function site(id: string, deg: number, r: number): IslandDef {
  const a = (deg * Math.PI) / 180;
  return {
    id,
    name: id,
    x: Math.round(r * Math.sin(a)),
    y: Math.round(r * Math.cos(a)),
    radius: 20,
  } as IslandDef;
}

const MAIN: PortDef = {
  id: 'sunreach',
  name: 'Sunreach',
  islandId: 'sunreach',
  level: 3,
  produces: [],
  wants: ['spice'],
  wantsMade: ['honey', 'planks', 'bread'],
  levelProduces: { '3': ['spicedTea'] },
};
const OUTPOST: PortDef = {
  id: 'palm-key',
  name: 'Palm Key',
  islandId: 'palm-key',
  level: 2,
  maxLevel: 3,
  produces: [],
  wants: ['grain', 'timber'],
  levelWants: { '3': ['planks', 'stone'] },
  levelProduces: { '2': ['spice'] },
};

const MAP: MapDef = structuredClone(PHASE1_MAP);
MAP.islands.push(site('sunreach', 176, 680), site('palm-key', 141, 900));
MAP.ports.push(MAIN, OUTPOST);
MAP.boundsRadius = 1000;

/** A voyage on the test sea, in a maxed cutter (hold for a full 30-unit load). */
function world(): World {
  const w = createWorld(MAP, SLOOP);
  w.trade.captain.ships.cutter = { sails: 3, hull: 3, hold: 3 };
  w.trade.captain.activeShip = 'cutter';
  return w;
}

/** Set a town's level straight away and open the markets that come with it. */
function setLevel(w: World, portId: string, level: number) {
  w.trade.settlements.byPort[portId]!.level = level;
  syncMarketLevels(w.trade, MAP);
}

function dock(w: World, portId: string) {
  w.trade.dockedAt = portId;
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

describe('far goods in the data (0146)', () => {
  it('are eight goods of kind far, priced in the order the seas open', () => {
    expect(FAR_GOODS).toEqual([
      'spice',
      'spicedTea',
      'obsidian',
      'obsidianMirrors',
      'cloudberries',
      'cloudberryJam',
      'amber',
      'amberBeads',
    ]);
    expect(CRAFTED_FROM).toEqual({
      spicedTea: 'spice',
      obsidianMirrors: 'obsidian',
      cloudberryJam: 'cloudberries',
      amberBeads: 'amber',
    });
    const price = (g: GoodId) => GOOD_DEFS[g].basePrice;
    // Rising in story order, tuned on the grown sea's story run (decision 0195).
    expect(FAR_GOODS.map(price)).toEqual([18, 86, 19, 88, 20, 95, 22, 105]);
    for (const g of FAR_GOODS) expect(isMadeGood(g)).toBe(true);
  });

  it('trade nowhere on the ring alone, though its towns are ready to buy them', () => {
    const ring = createWorld(PHASE1_MAP, SLOOP);
    for (const m of Object.values(ring.trade.markets))
      for (const g of FAR_GOODS) expect(trades(m, g)).toBe(false);
    const buyers = (g: GoodId) =>
      // Towns buy them from level 3, port towns at a better price (decision 0195).
      PHASE1_MAP.ports.filter((p) => p.levelWantsMade?.['3']?.includes(g)).map((p) => p.id);
    expect(buyers('spicedTea')).toEqual(['calda', 'westholm']);
    expect(buyers('obsidianMirrors')).toEqual(['calda', 'saltmere']);
    expect(buyers('cloudberryJam')).toEqual(['saltmere', 'stonehaven']);
    expect(buyers('amberBeads')).toEqual(['westholm', 'stonehaven']);
    expect(quickChecks(PHASE1_MAP).filter((c) => !c.ok)).toEqual([]);
  });

  it('pass the map checks on a sea with a main port and its outpost', () => {
    expect(quickChecks(MAP).filter((c) => !c.ok && c.id === 'goods')).toEqual([]);
  });
});

describe('the outpost gathers, the main port crafts, the ring buys (0146)', () => {
  it('the outpost gathers its raw good like bulk, and only its main port buys it', () => {
    const w = world();
    expect(w.trade.markets['palm-key']!.equilibrium.spice).toBe(equilibriumFor('produces', 2));
    for (const port of MAP.ports)
      if (port.id !== 'palm-key')
        expect(wantsAt(MAP, w.trade, port.id).includes('spice')).toBe(port.id === 'sunreach');
  });

  it('the workshop makes nothing without raw goods', () => {
    const w = world();
    const market = w.trade.markets.sunreach!;
    expect(trades(market, 'spicedTea')).toBe(true);
    expect(market.workshop).toEqual({ spicedTea: 0 });
    expect(available(market, 'spicedTea')).toBe(0);
    stepTrade(w.trade, MAP, { x: 0, y: -900, speedKn: 6 }, 600);
    expect(available(market, 'spicedTea')).toBe(0);
    w.trade.captain.gold = 10_000;
    dock(w, 'sunreach');
    expect(buy(w.trade, 'spicedTea', 1)).toEqual({ ok: false, error: 'out-of-stock' });
  });

  it('each raw unit sold becomes one crafted unit to buy', () => {
    const w = world();
    w.trade.captain.gold = 10_000;
    w.trade.captain.cargo.spice = 12;
    dock(w, 'sunreach');
    expect(sell(w.trade, 'spice', 12, MAP).ok).toBe(true);
    const market = w.trade.markets.sunreach!;
    expect(available(market, 'spicedTea')).toBe(12);
    expect(buy(w.trade, 'spicedTea', 13)).toEqual({ ok: false, error: 'out-of-stock' });
    expect(buy(w.trade, 'spicedTea', 12).ok).toBe(true);
    expect(available(market, 'spicedTea')).toBe(0);
  });

  it('an order of raw goods feeds the workshop too', () => {
    const w = world();
    w.trade.contracts.byPort.sunreach = {
      portId: 'sunreach',
      good: 'spice',
      qty: 6,
      reward: 200,
      readyIn: 0,
    };
    w.trade.captain.cargo.spice = 6;
    dock(w, 'sunreach');
    expect(deliverContract(w.trade, MAP).ok).toBe(true);
    expect(w.trade.markets.sunreach!.workshop).toEqual({ spicedTea: 6 });
  });

  it('a raw good before the workshop opens is just sold', () => {
    const w = world();
    setLevel(w, 'sunreach', 2);
    expect(w.trade.markets.sunreach!.workshop).toBeUndefined();
    w.trade.captain.cargo.spice = 5;
    dock(w, 'sunreach');
    expect(sell(w.trade, 'spice', 5, MAP).ok).toBe(true);
    setLevel(w, 'sunreach', 3);
    expect(w.trade.markets.sunreach!.workshop).toEqual({ spicedTea: 0 });
  });

  it('only port towns on the far side buy the crafted good, and never for the gate', () => {
    const w = world();
    expect(madeGoods(MAP, w.trade).has('spicedTea')).toBe(true);
    expect(wantsAt(MAP, w.trade, 'calda')).not.toContain('spicedTea');
    setLevel(w, 'calda', 4);
    setLevel(w, 'saltmere', 4);
    expect(wantsAt(MAP, w.trade, 'calda')).toContain('spicedTea');
    expect(wantsAt(MAP, w.trade, 'saltmere')).not.toContain('spicedTea');
    expect(trades(w.trade.markets.calda!, 'spicedTea')).toBe(true);
    expect(trades(w.trade.markets.saltmere!, 'spicedTea')).toBe(false);
    // Far goods never count toward the honey and lamp oil gate (0065).
    addRare(w.trade, 'westholm', 'spicedTea', 50);
    expect(w.trade.settlements.byPort.westholm!.rare).toBe(0);
    expect(portTownGate(MAP, w.trade, 'westholm')?.goods).toEqual(['lampOil']);
  });

  it('the outpost stops growing at town', () => {
    const w = world();
    for (let i = 0; i < 4; i++) {
      addGrowth(w.trade, 'palm-key', 1000);
      stepTrade(w.trade, MAP, { x: 0, y: -900, speedKn: 6 }, 0.1);
    }
    expect(settlementLevel(w.trade, 'palm-key')).toBe(3);
  });
});

describe('far workshops in saves (0146)', () => {
  function stocked(): World {
    const w = world();
    w.trade.captain.cargo.spice = 9;
    dock(w, 'sunreach');
    sell(w.trade, 'spice', 9, MAP);
    return w;
  }

  it('keep their crafted goods in the saved game', () => {
    const storage = new MemoryStorage();
    saveGame(storage, stocked());
    const back = world();
    expect(loadGame(storage, back)).toBe(true);
    expect(back.trade.markets.sunreach!.workshop).toEqual({ spicedTea: 9 });
  });

  it('keep them in the save code', () => {
    const save = serializeWorld(stocked());
    const read = unpackSave(packSave(save, MAP), MAP, save.version);
    expect(read.ok && read.raw.workshops).toEqual({ sunreach: { spicedTea: 9 } });
  });

  it('still read a save code made before the far goods', () => {
    const code = readFileSync(
      new URL('./fixtures/fw2-before-far-goods.txt', import.meta.url),
      'utf8',
    ).trim();
    const w = createWorld(PHASE1_MAP, SLOOP);
    const read = readSaveCode(code, w);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.save.gold).toBe(1234);
    expect(read.save.cargo.honey).toBe(7);
    expect(read.save.cargo.lampOil).toBe(3);
    expect(read.save.cargo.spice).toBe(0);
    expect(Math.round(read.save.markets.calda!.timber)).toBe(42);
    expect(read.save.settlements?.byPort.calda?.level).toBe(3);
  });
});

/*
 * Balance on all three difficulty levels (Guillaume, 2026-10-24: on Captain and Old salt the wind
 * shifts a lot). A maxed cutter's 30-unit loads, each leg priced by the real market with that
 * level's cut and timed by the balance simulation's leg model in that level's wind.
 */
describe('a far round pays on every difficulty (0146)', () => {
  const ship = effectiveShip(SHIP_CLASSES.cutter!, { sails: 3, hull: 3, hold: 3 });
  const qty = Math.min(30, ship.hold);

  /** Buy `qty` of `good` at `from`, sell it at `to`: gold earned and seconds sailed. */
  function leg(
    level: Difficulty,
    good: GoodId,
    from: string,
    to: string,
    prep?: (w: World) => void,
  ) {
    const w = world();
    setDifficulty(w.trade, level);
    setLevel(w, 'abbey-head', 2);
    setLevel(w, 'watchman-key', 2);
    for (const id of ['calda', 'westholm']) setLevel(w, id, 4);
    prep?.(w);
    w.trade.captain.gold = 100_000;
    dock(w, from);
    const paid = buy(w.trade, good, qty);
    expect(paid.ok, `${good} at ${from}`).toBe(true);
    dock(w, to);
    const got = sell(w.trade, good, qty, MAP);
    expect(got.ok, `${good} at ${to}`).toBe(true);
    const gold = (got.ok ? got.gold : 0) - (paid.ok ? paid.gold : 0);
    // The level's real wind (decision 0149), averaged over a few voyages' weather.
    const seeds = [1, 2, 3, 4, 5, 6];
    const seconds =
      seeds.reduce(
        (sum, seed) => sum + seaLegSeconds(seaOf(MAP, { level, seed }), ship, from, to, 0),
        0,
      ) / seeds.length;
    return { gold, seconds };
  }
  // The main port's workshop holds a full load, crafted from raw goods brought earlier.
  const crafted = (w: World) => (w.trade.markets.sunreach!.workshop!.spicedTea = qty);

  for (const level of DIFFICULTIES)
    it(`on ${TUNING.difficulty.levels[level]!.name}`, () => {
      const honeyToday = leg(level, 'honey', 'abbey-head', 'saltmere');
      const honeyOut = leg(level, 'honey', 'abbey-head', 'sunreach');
      const raw = leg(level, 'spice', 'palm-key', 'sunreach');
      const tea = [
        leg(level, 'spicedTea', 'sunreach', 'calda', crafted),
        leg(level, 'spicedTea', 'sunreach', 'westholm', crafted),
      ];
      // Every stop pays, and the crafted good is worth the longest haul on the map.
      for (const l of [honeyOut, raw, ...tea]) expect(l.gold).toBeGreaterThan(0);
      for (const l of tea) expect(l.gold).toBeGreaterThan(2 * honeyToday.gold);
      // Gold per minute on the crafted leg beats today's best rare-goods run.
      for (const l of tea)
        expect(l.gold / l.seconds).toBeGreaterThan(honeyToday.gold / honeyToday.seconds);
      // Legs stay a couple of minutes at most, even in the shifting wind.
      for (const l of [honeyOut, raw, ...tea]) expect(l.seconds).toBeLessThan(180);
      const round = honeyOut.gold + raw.gold + tea[0]!.gold;
      console.log(
        `${level}: honey today ${honeyToday.gold} in ${Math.round(honeyToday.seconds)} s; ` +
          `honey out ${honeyOut.gold} in ${Math.round(honeyOut.seconds)} s; ` +
          `spice ${raw.gold} in ${Math.round(raw.seconds)} s; ` +
          `spiced tea ${tea.map((l) => `${l.gold} in ${Math.round(l.seconds)} s`).join(' / ')}; ` +
          `round ${round}`,
      );
    });
});
