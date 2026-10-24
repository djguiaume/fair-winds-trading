import { describe, expect, it } from 'vitest';
import { grownMap } from '../../src/data/grownMap';
import { ISLAND_DESIGNS } from '../../src/data/islands';
import { PHASE1_MAP, PHASE1_SOURCE, prepareMap } from '../../src/data/maps';
import { setLanguage, tOptional } from '../../src/i18n';
import { QUESTS, QuestBook, checkQuestHooks, checkQuests, questsFor } from '../../src/sim/quests';
import { SLOOP } from '../../src/sim/ship';
import { isDiscovered } from '../../src/sim/shipyards';
import { sell, syncMarketLevels } from '../../src/sim/trade';
import { type World, createWorld } from '../../src/sim/world';
import { cardFor, dueCard } from '../../src/ui/questView';

// Decision 0155: the south sea's story (storyteller brief, Phase 4): Old Ness's chart, then
// Juno's idle tea house at Sunreach, then founding Palm Key with Tam (decision 0158).
const MAP = prepareMap(grownMap(PHASE1_SOURCE));
const IDS = ['watchman-passage', 'sunreach-tea', 'outpost-south'];
const LANDING = { x: 487, y: -738 };

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

function deliver(world: World, book: QuestBook, good: 'bread' | 'planks', qty: number) {
  world.trade.captain.cargo[good] = qty;
  book.check();
  const r = sell(world.trade, good, qty, world.map);
  expect(r).toMatchObject({ ok: true });
  book.check();
  return r.ok ? r.gold : 0;
}

describe('the south sea story (decision 0155)', () => {
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

  it('plays through in a sloop: Ness’s chart, Juno’s three steps, then founding Palm Key', () => {
    const { world, book } = setup();
    book.check();
    expect(book.active.map((a) => a.quest.id)).not.toContain('watchman-passage');

    // After the four arcs and the epilogue: Port Calda saws planks and Westholm bakes bread.
    for (const id of [
      'rooks-thanks',
      'calda-slipway',
      'saltmere-shoals',
      'westholm-mill',
      'stonehaven-light',
    ])
      world.trade.quests.byId[id] = { step: 'done', counts: [], chose: {} };
    world.trade.quests.byId['fair-winds'] = { step: 'done', counts: [], chose: {} };
    world.trade.settlements.byPort.westholm!.level = 3;
    syncMarketLevels(world.trade, world.map);
    // Ness hands over his chart when the captain next calls at Watchman Key.
    dock(world, book, 'saltmere');
    expect(book.progress('watchman-passage')).toBeUndefined();
    dock(world, book, 'watchman-key');
    expect(book.progress('watchman-passage')!.step).toBe('chart');
    expect(dueCard(book, world.map, 'watchman-key', new Set(), new Set())).toEqual({
      quest: 'watchman-passage',
      kind: 'step',
    });
    const chart = cardFor(book, world.map, 'watchman-passage', 'step')!;
    expect([chart.giver?.id, chart.mood]).toEqual(['ness', 'worried']);

    // Docking at Sunreach ends it; Ness's thanks shows there, and Juno offers her arc.
    const gold = world.trade.captain.gold;
    dock(world, book, 'sunreach');
    expect(book.progress('watchman-passage')!.step).toBe('done');
    expect(world.trade.captain.gold).toBe(gold + 300);
    expect(book.offered.map((q) => q.id)).toContain('sunreach-tea');
    book.accept('sunreach-tea');
    expect(cardFor(book, world.map, 'sunreach-tea', 'step')!.giver?.id).toBe('juno');

    // 1. Eight bread (Westholm bakes it from town level, which the mill arc reaches).
    const bread = deliver(world, book, 'bread', 8);
    expect(book.progress('sunreach-tea')!.step).toBe('garden');
    // 2. A slow look at Palm Key's west beach.
    hold(world, book, 474, -730, 6, 4);
    expect(book.progress('sunreach-tea')!.step).toBe('garden');
    hold(world, book, 474, -730, 2, 4);
    expect(book.progress('sunreach-tea')!.step).toBe('racks');
    // 3. Ten planks for the drying racks.
    dock(world, book, 'sunreach');
    const planks = deliver(world, book, 'planks', 10);
    expect(book.progress('sunreach-tea')!.step).toBe('done');
    expect(world.trade.captain.gold - bread - planks).toBe(gold + 300 + 250 + 400 + 600);

    // Palm Key: Juno offers it at Sunreach; timber and planks landed, then Tam from Watchman Key.
    expect(book.offered.map((q) => q.id)).toContain('outpost-south');
    book.accept('outpost-south');
    expect(cardFor(book, world.map, 'outpost-south', 'step')!.giver?.id).toBe('juno');
    world.trade.captain.cargo.timber = 6;
    world.trade.captain.cargo.planks = 4;
    hold(world, book, LANDING.x, LANDING.y, 1, 4);
    expect(book.progress('outpost-south')!.step).toBe('supplies');
    world.trade.captain.cargo.timber = 4;
    world.trade.captain.cargo.planks = 2;
    hold(world, book, LANDING.x + 30, LANDING.y, 1, 1);
    hold(world, book, LANDING.x, LANDING.y, 1, 4);
    expect(book.progress('outpost-south')!.step).toBe('settler');
    expect(isDiscovered(world.trade, 'palm-key')).toBe(false);
    expect(cardFor(book, world.map, 'outpost-south', 'step')!.giver?.id).toBe('tam');
    dock(world, book, 'watchman-key');
    hold(world, book, LANDING.x, LANDING.y, 1, 4);
    expect(book.progress('outpost-south')!.step).toBe('done');
    expect(isDiscovered(world.trade, 'palm-key')).toBe(true);
    // Tam, not Juno, thanks the captain on the done card.
    expect(cardFor(book, world.map, 'outpost-south', 'finished')!.giver?.id).toBe('tam');
  });
});
