import { describe, expect, it } from 'vitest';
import { grownMap } from '../../src/data/grownMap';
import { ISLAND_DESIGNS } from '../../src/data/islands';
import { PHASE1_MAP, PHASE1_SOURCE, prepareMap } from '../../src/data/maps';
import { setLanguage, tOptional } from '../../src/i18n';
import { QUESTS, QuestBook, checkQuestHooks, checkQuests, questsFor } from '../../src/sim/quests';
import type { GoodId } from '../../src/sim/goods';
import { SLOOP } from '../../src/sim/ship';
import { isDiscovered } from '../../src/sim/shipyards';
import { sell, syncMarketLevels } from '../../src/sim/trade';
import { type World, createWorld } from '../../src/sim/world';
import { character } from '../../src/ui/portraits';
import { cardFor } from '../../src/ui/questView';

// The east sea's story (storyteller brief, "The east sea, step by step"): Maren's letter from her
// cousin, Elias Morrow's quiet amber workshop, then founding Amber Strand with Pip Holt; and the
// Phase 4 closing beat, Rook's "Four winds" at Skerry.
const MAP = prepareMap(grownMap(PHASE1_SOURCE));
const IDS = ['westholm-letter', 'fogwatch-amber', 'outpost-east', 'four-winds'];
const STRAND = { x: 692, y: 452 };
const LANDING = { x: 688, y: 465 };
const BEFORE = [
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
  'saltmere-letter',
  'rimewick-jam',
];

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

function deliver(world: World, book: QuestBook, good: GoodId, qty: number) {
  world.trade.captain.cargo[good] = qty;
  book.check();
  expect(sell(world.trade, good, qty, world.map)).toMatchObject({ ok: true });
  book.check();
}

describe('the east sea story', () => {
  it('runs only on the grown sea, passes the checks, every card in both languages', () => {
    for (const id of IDS) expect(questsFor(PHASE1_MAP).map((q) => q.id)).not.toContain(id);
    expect(questsFor(MAP).map((q) => q.id)).toEqual(expect.arrayContaining(IDS));
    expect(checkQuests(QUESTS, MAP)).toEqual([]);
    expect(checkQuestHooks(MAP, Object.values(ISLAND_DESIGNS), QUESTS)).toEqual([]);
    for (const id of ['elias', 'pip']) expect(character(id)?.voice).toBe(id);
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

  it('plays through in a sloop: Maren’s letter, Elias’s workshop, Amber Strand, then Four winds', () => {
    const { world, book } = setup();
    for (const id of [...BEFORE, 'outpost-north'])
      world.trade.quests.byId[id] = { step: 'done', counts: [], chose: {} };
    // Watchman Key fills lamps from town level, so Fogwatch buys lamp oil.
    world.trade.settlements.byPort['watchman-key']!.level = 2;
    syncMarketLevels(world.trade, world.map);

    // Maren has a letter from her cousin Pip: dock at Fogwatch.
    dock(world, book, 'westholm');
    expect(book.offered.map((q) => q.id)).toContain('westholm-letter');
    book.accept('westholm-letter');
    expect(cardFor(book, world.map, 'westholm-letter', 'step')!.giver?.id).toBe('maren');
    const gold = world.trade.captain.gold;
    dock(world, book, 'fogwatch');
    expect(book.progress('westholm-letter')!.step).toBe('done');
    expect(world.trade.captain.gold).toBe(gold + 350);
    expect(book.offered.map((q) => q.id)).toContain('fogwatch-amber');
    book.accept('fogwatch-amber');
    expect(cardFor(book, world.map, 'fogwatch-amber', 'step')!.giver?.id).toBe('elias');

    // 1. Eight smoked fish. 2. A card about the Stormbreak, then a slow look at the strand.
    deliver(world, book, 'smokedFish', 8);
    expect(book.progress('fogwatch-amber')!.step).toBe('way');
    book.choose('fogwatch-amber', 'continue');
    expect(book.progress('fogwatch-amber')!.step).toBe('strand');
    hold(world, book, STRAND.x, STRAND.y, 5, 4);
    expect(book.progress('fogwatch-amber')!.step).toBe('strand');
    hold(world, book, STRAND.x, STRAND.y, 2, 4);
    expect(book.progress('fogwatch-amber')!.step).toBe('light');
    // 3. Eight lamp oil for the foghorn tower.
    dock(world, book, 'fogwatch');
    deliver(world, book, 'lampOil', 8);
    expect(book.progress('fogwatch-amber')!.step).toBe('done');

    // Amber Strand: Elias offers it; timber and planks landed, then Pip from Fogwatch.
    dock(world, book, 'fogwatch');
    expect(book.offered.map((q) => q.id)).toContain('outpost-east');
    book.accept('outpost-east');
    world.trade.captain.cargo.timber = 8;
    world.trade.captain.cargo.planks = 6;
    hold(world, book, LANDING.x, LANDING.y, 1, 4);
    expect(book.progress('outpost-east')!.step).toBe('settler');
    expect(cardFor(book, world.map, 'outpost-east', 'step')!.giver?.id).toBe('pip');
    expect(isDiscovered(world.trade, 'amber-strand')).toBe(false);
    dock(world, book, 'fogwatch');
    hold(world, book, LANDING.x, LANDING.y, 1, 4);
    expect(book.progress('outpost-east')!.step).toBe('done');
    expect(isDiscovered(world.trade, 'amber-strand')).toBe(true);
    expect(cardFor(book, world.map, 'outpost-east', 'finished')!.giver?.id).toBe('pip');

    // Four seas, four outposts: Rook closes the book at Skerry.
    book.check();
    expect(book.progress('four-winds')).toBeTruthy();
    expect(cardFor(book, world.map, 'four-winds', 'step')!.giver?.id).toBe('rook');
  });
});
