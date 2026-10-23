import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { designOf } from '../src/data/islands';
import { TUNING } from '../src/data/tuning';
import { damageHull, repairPrice } from '../src/sim/hazards';
import {
  BUILDINGS,
  buildChoices,
  buildOnSpot,
  giveHomeIsland,
  homeDesign,
  homeEffect,
  homeIsland,
  homeSpots,
  offerHomeSpot,
  passedOver,
  readHome,
} from '../src/sim/home';
import { type QuestDef, checkQuests } from '../src/sim/quests';
import { payReward, testCondition } from '../src/sim/questLibrary';
import { serializeWorld, validateSave } from '../src/sim/save';
import { packSave, unpackSave } from '../src/sim/saveCode';
import { SHIP_CLASSES, SLOOP } from '../src/sim/ship';
import { shipCost, upgradeCost } from '../src/sim/trade';
import { createWorld } from '../src/sim/world';

// Decision 0126: the home island, its build spots and buildings.
const MAP = PHASE1_MAP;

function world() {
  const w = createWorld(MAP, SLOOP);
  w.trade.captain.gold = 10_000;
  return w;
}

describe('home island (decision 0126)', () => {
  it('is Skerry, with four arc spots of four pairs and two spares', () => {
    expect(homeIsland(MAP)?.id).toBe('skerry');
    const spots = homeSpots(MAP);
    expect(spots.filter((s) => s.pair).map((s) => s.pair)).toEqual([
      'crafts',
      'stores',
      'watch',
      'waterside',
    ]);
    expect(spots.filter((s) => !s.pair)).toHaveLength(2);
    for (const pair of ['crafts', 'stores', 'watch', 'waterside'])
      expect(BUILDINGS.filter((b) => b.pair === pair)).toHaveLength(2);
  });

  it('builds an arc spot free once offered, and a passed-over building later for gold', () => {
    const w = world();
    const { trade } = w;
    expect(buildChoices(trade, MAP, 'spot-1')).toEqual([]); // not the captain's yet
    giveHomeIsland(trade);
    expect(buildChoices(trade, MAP, 'spot-1')).toEqual([]); // not offered by an arc yet
    expect(offerHomeSpot(trade, MAP, 'spot-1')).toBe(true);
    expect(offerHomeSpot(trade, MAP, 'spot-1')).toBe(false); // once
    expect(offerHomeSpot(trade, MAP, 'spot-5')).toBe(false); // a spare is never offered
    const free = buildChoices(trade, MAP, 'spot-1');
    expect(free.map((c) => [c.building.id, c.price])).toEqual([
      ['workshop', 0],
      ['rigging-loft', 0],
    ]);
    expect(buildChoices(trade, MAP, 'spot-5')).toEqual([]); // nothing passed over yet
    expect(buildOnSpot(trade, MAP, 'spot-1', 'warehouse')).toEqual({
      ok: false,
      error: 'not-offered',
    });
    expect(buildOnSpot(trade, MAP, 'spot-1', 'workshop')).toEqual({ ok: true, gold: 0 });
    expect(trade.home.offered).toEqual([]);
    expect(passedOver(trade.home, MAP).map((b) => b.id)).toEqual(['rigging-loft']);

    const later = buildChoices(trade, MAP, 'spot-5');
    const price = Math.round(1500 * TUNING.economy.home.laterPriceFactor);
    expect(later.map((c) => [c.building.id, c.price])).toEqual([['rigging-loft', price]]);
    trade.captain.gold = price - 1;
    expect(buildOnSpot(trade, MAP, 'spot-5', 'rigging-loft')).toEqual({
      ok: false,
      error: 'not-enough-gold',
    });
    trade.captain.gold = price;
    expect(buildOnSpot(trade, MAP, 'spot-5', 'rigging-loft')).toEqual({ ok: true, gold: price });
    expect(trade.captain.gold).toBe(0);
    expect(passedOver(trade.home, MAP)).toEqual([]);
    expect(buildChoices(trade, MAP, 'spot-6')).toEqual([]);
  });

  it('applies each building as one small modifier', () => {
    const { trade } = world();
    const sailPrice = upgradeCost(trade, 1000, 'sails');
    const shipPrice = shipCost(trade, SHIP_CLASSES.cutter!);
    damageHull(trade, 40);
    trade.dockedAt = 'saltmere';
    const portRepair = repairPrice(trade);
    trade.dockedAt = null;
    expect(homeEffect(trade.home, 'hullDamage')).toBe(1);

    trade.home = {
      owned: true,
      offered: [],
      built: {
        'spot-1': 'workshop',
        'spot-3': 'pilot-house',
        'spot-4': 'boathouse',
        'spot-5': 'rigging-loft',
      },
      docked: true,
    };
    expect(upgradeCost(trade, 1000, 'sails')).toBe(Math.round(sailPrice * 0.9));
    expect(upgradeCost(trade, 1000, 'hold')).toBe(1000);
    expect(shipCost(trade, SHIP_CLASSES.cutter!)).toBe(Math.round(shipPrice * 0.9));
    expect(repairPrice(trade)).toBe(Math.ceil(portRepair * 0.75));
    expect(homeEffect(trade.home, 'hullDamage')).toBe(0.8);
    expect(homeEffect(trade.home, 'discoverRange')).toBe(1);
  });

  it('saves and reads back, dropping what the map no longer has', () => {
    const w = world();
    giveHomeIsland(w.trade);
    offerHomeSpot(w.trade, MAP, 'spot-2');
    offerHomeSpot(w.trade, MAP, 'spot-3');
    buildOnSpot(w.trade, MAP, 'spot-2', 'bakehouse');
    const save = JSON.parse(JSON.stringify(serializeWorld(w)));
    expect(validateSave(save, w)?.home).toEqual({
      owned: true,
      offered: ['spot-3'],
      built: { 'spot-2': 'bakehouse' },
    });
    // An older save has no home; a wrong building, spot or pair is dropped.
    delete save.home;
    expect(validateSave(save, w)?.home).toEqual({ owned: false, offered: [], built: {} });
    expect(
      readHome(
        {
          owned: true,
          offered: ['spot-9', 'spot-5', 'spot-1'],
          built: { 'spot-1': 'lookout', 'spot-2': 'castle', 'spot-6': 'warehouse' },
        },
        MAP,
      ),
    ).toEqual({ owned: true, offered: ['spot-1'], built: { 'spot-6': 'warehouse' } });
  });

  it('carries the home in the save code; codes without it still read', () => {
    const w = world();
    const before = serializeWorld(w);
    const plain = packSave(before, MAP);
    giveHomeIsland(w.trade);
    offerHomeSpot(w.trade, MAP, 'spot-4');
    offerHomeSpot(w.trade, MAP, 'spot-1');
    buildOnSpot(w.trade, MAP, 'spot-1', 'rigging-loft');
    const save = serializeWorld(w);
    const bytes = packSave(save, MAP);
    // Section, fingerprint, offered flags, one number per spot.
    expect(bytes.length - plain.length).toBeLessThanOrEqual(12);
    const read = unpackSave(bytes, MAP, save.version);
    expect(read.ok && read.raw.home).toEqual(save.home);
    const old = unpackSave(plain, MAP, save.version);
    expect(old.ok && old.raw.home).toBeUndefined();
    // Spots or buildings changed since the code was made: refused, not misread.
    const other = structuredClone(MAP);
    other.homeIsland = undefined;
    expect(unpackSave(bytes, other, save.version)).toEqual({
      ok: false,
      problem: 'otherVersion',
    });
  });

  it('draws the run-down island first, then each building on its spot', () => {
    const design = designOf(homeIsland(MAP)!)!;
    const tagged = (d: typeof design, prefix: string) =>
      d.props.filter((p) => p.tags?.some((t) => t.startsWith(prefix)));
    const first = homeDesign(design);
    expect(tagged(first, 'home:')).toEqual([]);
    expect(tagged(first, 'home-empty:')).toHaveLength(3);

    const built = homeDesign(design, { 'spot-1': 'workshop', 'spot-5': 'pilot-house' });
    const home = tagged(built, 'home:');
    expect(new Set(home.flatMap((p) => p.tags))).toEqual(
      new Set(['home:workshop', 'home:pilot-house']),
    );
    // The cabin on spot 1 is gone; the pilot house moved from spot 3 to the spare spot 5.
    expect(tagged(built, 'home-empty:spot-1')).toEqual([]);
    const spot3 = design.homeSpots!.find((s) => s.id === 'spot-3')!;
    const spot5 = design.homeSpots!.find((s) => s.id === 'spot-5')!;
    const original = design.props.find((p) => p.tags?.includes('home:pilot-house'))!;
    const moved = home.find((p) => p.tags?.includes('home:pilot-house'))!;
    expect(moved.x).toBeCloseTo(original.x - spot3.x + spot5.x);
    expect(moved.z).toBeCloseTo(original.z - spot3.z + spot5.z);
  });

  it('gives the island and offers spots as quest rewards, and checks them', () => {
    const w = world();
    payReward(w.trade, MAP, { homeIsland: true, homeSpot: ['spot-2'] }, () => {});
    expect(w.trade.home).toMatchObject({ owned: true, offered: ['spot-2'] });
    buildOnSpot(w.trade, MAP, 'spot-2', 'warehouse');
    const ctx = { trade: w.trade, map: MAP } as Parameters<typeof testCondition>[1];
    expect(testCondition({ is: 'built', building: 'warehouse' }, ctx)).toBe(true);
    expect(testCondition({ is: 'built', building: 'bakehouse' }, ctx)).toBe(false);

    const quest = (reward: object, goal: object = { is: 'always' }) =>
      [
        {
          id: 'q',
          name: 'q',
          text: 'q',
          start: { is: 'always' },
          steps: [{ id: 's', goal, reward }],
        },
      ] as unknown as QuestDef[];
    expect(checkQuests(quest({ homeIsland: true, homeSpot: ['spot-1'] }), MAP)).toEqual([]);
    expect(checkQuests(quest({ homeSpot: ['spot-5'] }), MAP).join()).toMatch(/no arc spot/);
    expect(checkQuests(quest({}, { is: 'built', building: 'castle' }), MAP).join()).toMatch(
      /no building/,
    );
  });
});
