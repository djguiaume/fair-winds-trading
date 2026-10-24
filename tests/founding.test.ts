import { describe, expect, it } from 'vitest';
import { PHASE1_SOURCE, prepareMap } from '../src/data/maps';
import { grownMap } from '../src/data/grownMap';
import { TUNING } from '../src/data/tuning';
import { seaLegSeconds, seaOf } from '../src/sim/balance';
import { DIFFICULTIES } from '../src/sim/difficulty';
import { foundSite, foundedSites, townLevels } from '../src/sim/founding';
import type { MapDef } from '../src/sim/map';
import { quickChecks } from '../src/sim/mapChecks';
import { equilibriumFor } from '../src/sim/market';
import { type QuestDef, QuestBook, checkQuests } from '../src/sim/quests';
import { serializeWorld } from '../src/sim/save';
import { packSave, unpackSave } from '../src/sim/saveCode';
import { portWants, producesAt, settlementLevel, topLevel } from '../src/sim/settlement';
import { SHIP_CLASSES, SLOOP } from '../src/sim/ship';
import { createProgress, discoverNear, homePort, isDiscovered } from '../src/sim/shipyards';
import { buy, portInRange, sell, setDifficulty, syncMarketLevels, tryDock } from '../src/sim/trade';
import { effectiveShip } from '../src/sim/upgrades';
import { type World, createWorld, refreshPiers } from '../src/sim/world';
import founding from './fixtures/quests/test-founding.json';

// Decision 0157: founding an outpost on the south sea (0152), run on a test quest.
const MAP = prepareMap(grownMap(PHASE1_SOURCE));
const QUEST = founding as unknown as QuestDef;
const SPOT = { x: 487, y: -738 };
const site = MAP.ports.find((p) => p.id === 'palm-key')!;

function world(): World {
  const w = createWorld(MAP, SLOOP);
  w.trade.captain.gold = 10_000;
  return w;
}

/** Lie still at (x, y) for `sec` seconds of quest checks. */
function lieAt(w: World, book: QuestBook, x: number, y: number, sec = 4) {
  w.boat.x = x;
  w.boat.y = y;
  w.boat.speedKn = 0;
  const events = [];
  for (let t = 0; t < sec - 1e-9; t += 0.25) events.push(...book.check(0.25));
  return events;
}

describe('an empty island to found (0157)', () => {
  it('Palm Key is a site on the south sea, an outpost that stops at town', () => {
    expect(site).toMatchObject({ site: true, level: 1, maxLevel: 3, produces: ['spice'] });
    expect(
      quickChecks(MAP)
        .filter((c) => !c.ok)
        .map((c) => c.message),
    ).toEqual([]);
  });

  it('is not a port until founded: off the chart, no pier, nowhere to dock', () => {
    const w = world();
    expect(isDiscovered(w.trade, 'palm-key')).toBe(false);
    expect(createProgress(MAP).discovered).not.toContain('palm-key');
    expect(homePort(MAP).id).not.toBe('palm-key');
    expect(townLevels(MAP, w.trade)['palm-key']).toBe(0);
    expect(w.piers.some((p) => p.islandId === 'palm-key')).toBe(false);
    // Sailing past does not chart it, and lying off its beach does not dock her.
    expect(discoverNear(w.trade, MAP, SPOT)).toEqual([]);
    const boat = { ...SPOT, speedKn: 0, heading: 0 };
    expect(portInRange(MAP, boat, 50, townLevels(MAP, w.trade))).toBeNull();
    expect(tryDock(w.trade, MAP, boat, 'palm-key')).toBe(false);
  });

  it('a quest founds it with the goods landed and the settler carried', () => {
    const w = world();
    const book = new QuestBook(w, [QUEST]);
    book.check(0.25);
    expect(book.progress('test-founding')?.step).toBe('supplies');
    // A short load lands what it can; the rest comes later. Nothing is paid for it.
    w.trade.captain.cargo.timber = 4;
    w.trade.captain.cargo.planks = 6;
    const gold = w.trade.captain.gold;
    const first = lieAt(w, book, SPOT.x, SPOT.y);
    expect(first.filter((e) => e.type === 'landed')).toEqual([
      { type: 'landed', quest: 'test-founding', good: 'timber', qty: 4 },
      { type: 'landed', quest: 'test-founding', good: 'planks', qty: 6 },
    ]);
    expect(w.trade.captain.cargo.timber).toBe(0);
    expect(w.trade.captain.cargo.planks).toBe(0);
    expect(w.trade.captain.gold).toBe(gold);
    expect(book.progress('test-founding')?.step).toBe('supplies');
    // Sailing past fast lands nothing.
    w.trade.captain.cargo.timber = 20;
    w.boat.speedKn = 6;
    book.check(0.25);
    expect(w.trade.captain.cargo.timber).toBe(20);
    lieAt(w, book, SPOT.x, SPOT.y);
    expect(w.trade.captain.cargo.timber).toBe(14);
    expect(book.progress('test-founding')?.step).toBe('settler');
    // The settler boards at Watchman Key and lands at the spot: Palm Key is founded.
    w.trade.dockedAt = 'watchman-key';
    book.check(0.25);
    book.check(0.25);
    w.trade.dockedAt = null;
    lieAt(w, book, SPOT.x, SPOT.y);
    expect(book.progress('test-founding')?.step).toBe('done');
    expect(foundedSites(MAP, w.trade)).toEqual(['palm-key']);
    expect(isDiscovered(w.trade, 'palm-key')).toBe(true);
    expect(settlementLevel(w.trade, 'palm-key')).toBe(1);
    // Its pier is built and she can dock there now.
    refreshPiers(w);
    expect(w.piers.some((p) => p.islandId === 'palm-key')).toBe(true);
    const pier = w.piers.find((p) => p.islandId === 'palm-key')!;
    const alongside = { x: pier.x1 - 3, y: pier.y1, speedKn: 0, heading: Math.PI / 2 };
    expect(portInRange(MAP, alongside, 6, townLevels(MAP, w.trade))?.id).toBe('palm-key');
  });

  it('gathers spice from the day it is founded and grows to town on timber and bread', () => {
    const w = world();
    expect(foundSite(w.trade, MAP, 'palm-key')).toBe(true);
    expect(foundSite(w.trade, MAP, 'palm-key')).toBe(false);
    expect(foundSite(w.trade, MAP, 'sunreach')).toBe(false);
    syncMarketLevels(w.trade, MAP);
    expect(producesAt(MAP, w.trade, 'palm-key')).toEqual(['spice']);
    // A hamlet's stock: the economy's level-1 share of a village's (data, economy.json).
    const towns = TUNING.economy.towns;
    expect(equilibriumFor('produces', settlementLevel(w.trade, 'palm-key'))).toBe(
      towns.producesEquilibrium[0]!,
    );
    expect(portWants(site, 1, new Set(['bread', 'planks']))).toEqual(['timber', 'bread', 'planks']);
    expect(topLevel(site)).toBe(3);
  });

  it('checks the rewards: found names a site, discover and levelUp never do', () => {
    expect(checkQuests([QUEST], MAP)).toEqual([]);
    const bad = structuredClone(QUEST);
    bad.reward = { found: ['sunreach'], discover: ['palm-key'] };
    const problems = checkQuests([bad], MAP).join('\n');
    expect(problems).toContain('"sunreach" is no empty island');
    expect(problems).toContain('"palm-key" is an empty island');
  });
});

describe('founded sites in saves (0157)', () => {
  it('keep their port in the saved game and the save code', () => {
    const w = world();
    foundSite(w.trade, MAP, 'palm-key');
    const save = serializeWorld(w);
    const read = unpackSave(packSave(save, MAP, []), MAP, save.version, []);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.raw.progress?.discovered).toContain('palm-key');
    expect(read.raw.settlements?.byPort['palm-key']?.level).toBe(1);
  });

  it('read a code made before the sea had its site', () => {
    const before: MapDef = { ...MAP, ports: MAP.ports.filter((p) => !p.site) };
    const w = createWorld(before, SLOOP);
    w.trade.captain.gold = 4321;
    const save = serializeWorld(w);
    const read = unpackSave(packSave(save, before, []), MAP, save.version, []);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.raw.gold).toBe(4321);
    expect(read.raw.progress?.discovered).not.toContain('palm-key');
  });
});

/*
 * Balance on all three difficulty levels (Guillaume, 2026-10-24): the new outpost's spice, from a
 * hamlet just founded up to its top, sold at Sunreach, in a maxed cutter's 30-unit load, timed by
 * the balance simulation's leg model in that level's real wind (0149).
 */
describe('a founded outpost pays on every difficulty (0157)', () => {
  const ship = effectiveShip(SHIP_CLASSES.cutter!, { sails: 3, hull: 3, hold: 3 });
  const qty = Math.min(30, ship.hold);

  for (const level of DIFFICULTIES)
    it(`on ${TUNING.difficulty.levels[level]!.name}`, () => {
      const seeds = [1, 2, 3, 4, 5];
      const seconds =
        seeds.reduce(
          (n, seed) =>
            n + seaLegSeconds(seaOf(MAP, { level, seed }), ship, 'palm-key', 'sunreach', 0),
          0,
        ) / seeds.length;
      const golds = [1, 2, 3].map((town) => {
        const w = world();
        setDifficulty(w.trade, level);
        w.trade.captain.ships.cutter = { sails: 3, hull: 3, hold: 3 };
        w.trade.captain.activeShip = 'cutter';
        w.trade.captain.gold = 100_000;
        foundSite(w.trade, MAP, 'palm-key');
        w.trade.settlements.byPort['palm-key']!.level = town;
        syncMarketLevels(w.trade, MAP);
        // The stock the town settles at, once it has stood a while at that level.
        w.trade.markets['palm-key']!.stock.spice = equilibriumFor('produces', town);
        w.trade.dockedAt = 'palm-key';
        const paid = buy(w.trade, 'spice', qty);
        w.trade.dockedAt = 'sunreach';
        const got = sell(w.trade, 'spice', qty, MAP);
        expect(paid.ok && got.ok).toBe(true);
        return (got.ok ? got.gold : 0) - (paid.ok ? paid.gold : 0);
      });
      // Every level pays, and a bigger outpost pays a little more.
      for (const g of golds) expect(g).toBeGreaterThan(0);
      expect(golds[2]).toBeGreaterThan(golds[0]!);
      expect(seconds).toBeLessThan(180);
      console.log(
        `${level}: spice Palm Key → Sunreach in ${Math.round(seconds)} s: ` +
          `hamlet ${golds[0]}, village ${golds[1]}, town ${golds[2]}`,
      );
    });
});
