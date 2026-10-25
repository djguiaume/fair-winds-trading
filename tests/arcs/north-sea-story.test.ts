import { describe, expect, it } from 'vitest';
import { grownMap } from '../../src/data/grownMap';
import { ISLAND_DESIGNS } from '../../src/data/islands';
import { PHASE1_MAP, PHASE1_SOURCE, prepareMap } from '../../src/data/maps';
import { setLanguage, tOptional } from '../../src/i18n';
import { landOut } from '../../src/sim/questLand';
import { QUESTS, QuestBook, checkQuestHooks, checkQuests, questsFor } from '../../src/sim/quests';
import { SLOOP } from '../../src/sim/ship';
import { isDiscovered } from '../../src/sim/shipyards';
import { sell, syncMarketLevels } from '../../src/sim/trade';
import { type World, createWorld } from '../../src/sim/world';
import { cardFor } from '../../src/ui/questView';

// Decision 0170: the north sea's story (storyteller brief, Phase 4): Kit's letter to his sister,
// Sigrun's cold jam house and the beacon on Lead Rock, then founding Snowberry Isle with Nell.
const MAP = prepareMap(grownMap(PHASE1_SOURCE));
const IDS = ['saltmere-letter', 'rimewick-jam', 'outpost-north'];
const LEAD = { x: -282, y: 721 };
const LANDING = { x: -364, y: 740 };

function setup() {
  setLanguage('en');
  const world: World = createWorld(MAP, SLOOP);
  world.trade.captain.gold = 10_000;
  const book = new QuestBook(world, QUESTS, {
    doneElsewhere: (id) => id === 'first-voyage',
    nightOk: () => false,
  });
  return { world, book };
}

function dock(world: World, book: QuestBook, port: string) {
  const island = world.map.ports.find((p) => p.id === port)!.islandId;
  const { x, y } = world.map.islands.find((i) => i.id === island)!;
  Object.assign(world.boat, { x, y, speedKn: 0 });
  world.trade.dockedAt = port;
  book.check();
}

function hold(world: World, book: QuestBook, x: number, y: number, kn: number, sec: number) {
  world.trade.dockedAt = null;
  Object.assign(world.boat, { x, y, speedKn: kn });
  for (let t = 0; t < sec - 1e-9; t += 0.25) book.check(0.25);
}

describe('the north sea story (decision 0170)', () => {
  it('runs only on the grown sea, passes the checks, every card in both languages', () => {
    expect(questsFor(PHASE1_MAP).map((q) => q.id)).not.toContain(IDS[0]);
    expect(questsFor(MAP).map((q) => q.id)).toEqual(expect.arrayContaining(IDS));
    expect(checkQuests(QUESTS, MAP)).toEqual([]);
    expect(checkQuestHooks(MAP, Object.values(ISLAND_DESIGNS), QUESTS)).toEqual([]);
    for (const id of IDS) {
      const quest = QUESTS.find((q) => q.id === id)!;
      for (const lang of ['en', 'fr'] as const) {
        setLanguage(lang);
        expect(tOptional(`quest.${id}.name`), `${lang} ${id}`).toBeTruthy();
        for (const step of [...quest.steps.map((s) => s.id), 'done'])
          for (const part of ['title', 'copy'])
            expect(
              tOptional(`quest.${id}.${step}.${part}`),
              `${lang} ${id}.${step}.${part}`,
            ).toBeTruthy();
      }
    }
    setLanguage('en');
  });

  it('keeps Snowberry Pack in the sea until the beacon is lit', () => {
    expect(landOut(MAP, new Set())).not.toContain('snowberry-pack');
    expect(landOut(MAP, new Set(['rimewick-jam']))).toContain('snowberry-pack');
  });

  it('plays through in a sloop: Kit’s letter, Sigrun’s three steps, then founding Snowberry Isle', () => {
    const { world, book } = setup();
    for (const id of [
      'rooks-thanks',
      'calda-slipway',
      'saltmere-shoals',
      'westholm-mill',
      'stonehaven-light',
      'fair-winds',
      'watchman-passage',
      'sunreach-tea',
      'outpost-south',
      'calda-letter',
      'emberhold-glass',
      'outpost-west',
    ])
      world.trade.quests.byId[id] = { step: 'done', counts: [], chose: {} };
    // Watchman Key fills lamps from town level, so Rimewick buys lamp oil.
    world.trade.settlements.byPort['watchman-key']!.level = 2;
    syncMarketLevels(world.trade, world.map);

    // Kit has a letter for his sister: dock at Rimewick.
    dock(world, book, 'saltmere');
    expect(book.offered.map((q) => q.id)).toContain('saltmere-letter');
    book.accept('saltmere-letter');
    expect(cardFor(book, world.map, 'saltmere-letter', 'step')!.giver?.id).toBe('kit');
    const gold = world.trade.captain.gold;
    dock(world, book, 'rimewick');
    expect(book.progress('saltmere-letter')!.step).toBe('done');
    expect(world.trade.captain.gold).toBe(gold + 300);
    // Sigrun answers for Kit's sister, and offers her own arc.
    expect(cardFor(book, world.map, 'saltmere-letter', 'finished')!.giver?.id).toBe('sigrun');
    expect(book.offered.map((q) => q.id)).toContain('rimewick-jam');
    book.accept('rimewick-jam');

    // 1. Eight lamp oil.
    world.trade.captain.cargo.lampOil = 8;
    book.check();
    const r = sell(world.trade, 'lampOil', 8, world.map);
    expect(r).toMatchObject({ ok: true });
    book.check();
    expect(book.progress('rimewick-jam')!.step).toBe('lead');
    // 2. A slow look at Lead Rock.
    hold(world, book, LEAD.x, LEAD.y, 5, 4);
    expect(book.progress('rimewick-jam')!.step).toBe('lead');
    hold(world, book, LEAD.x, LEAD.y, 2, 4);
    expect(book.progress('rimewick-jam')!.step).toBe('beacon');
    // 3. Six cut stone landed on the rock, under two knots.
    world.trade.captain.cargo.cutStone = 6;
    hold(world, book, LEAD.x, LEAD.y, 2.5, 4);
    expect(book.progress('rimewick-jam')!.step).toBe('beacon');
    hold(world, book, LEAD.x, LEAD.y, 1, 4);
    expect(book.progress('rimewick-jam')!.step).toBe('done');

    // Snowberry Isle: Sigrun offers it; planks and stone landed, then Nell from Rimewick.
    dock(world, book, 'rimewick');
    expect(book.offered.map((q) => q.id)).toContain('outpost-north');
    book.accept('outpost-north');
    expect(cardFor(book, world.map, 'outpost-north', 'step')!.giver?.id).toBe('sigrun');
    world.trade.captain.cargo.planks = 8;
    world.trade.captain.cargo.cutStone = 4;
    hold(world, book, LANDING.x, LANDING.y, 1, 4);
    expect(book.progress('outpost-north')!.step).toBe('settler');
    expect(cardFor(book, world.map, 'outpost-north', 'step')!.giver?.id).toBe('nell');
    expect(isDiscovered(world.trade, 'snowberry-isle')).toBe(false);
    dock(world, book, 'rimewick');
    hold(world, book, LANDING.x, LANDING.y, 1, 4);
    expect(book.progress('outpost-north')!.step).toBe('done');
    expect(isDiscovered(world.trade, 'snowberry-isle')).toBe(true);
    expect(cardFor(book, world.map, 'outpost-north', 'finished')!.giver?.id).toBe('nell');
  });
});
