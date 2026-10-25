import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { QUESTS, QUEST_DONE, QuestBook, type QuestEvent } from '../src/sim/quests';
import { giveHomeIsland } from '../src/sim/home';
import { SHIP_CLASSES, SLOOP } from '../src/sim/ship';
import { buy, cargoUsed } from '../src/sim/trade';
import { type World, createWorld } from '../src/sim/world';
import { cargoLines, newsLine, quayItems } from '../src/ui/questView';
import { setLanguage } from '../src/i18n';

// Dock news (decision 0210): every stop of a quest under way says what just happened there, and a
// timed run says when its clock starts, runs over par or is made.
const MILL = 'westholm-mill';

function start(step: string, counts: number[]) {
  const world = createWorld(PHASE1_MAP, SLOOP);
  world.trade.captain.gold = 10_000;
  world.trade.quests.byId['rooks-thanks'] = { step: QUEST_DONE, counts: [], chose: {} };
  giveHomeIsland(world.trade, PHASE1_MAP);
  world.trade.quests.byId[MILL] = { step, counts, chose: {} };
  const quests = new QuestBook(world, QUESTS, { doneElsewhere: (id) => id === 'first-voyage' });
  quests.check();
  return { world, quests };
}

const lines = (world: World, quests: QuestBook) =>
  quests.news().map((n) => newsLine(quests, world.map, n));

describe('dock news (0210)', () => {
  it('says what was loaded at the pick-up, and what is left on the quay for want of deck', () => {
    const { world, quests } = start('millstones', [0, 0, 0]);
    world.trade.dockedAt = 'stonehaven';
    quests.check();
    // On deck, apart from the hold: a sloop's deck of eight takes one millstone of six.
    expect(cargoUsed(world.trade)).toBe(0);
    expect(world.trade.quests.hold).toBe(6);
    expect(lines(world, quests)).toEqual([
      '1 millstone aboard for Maren, 1 left on the quay. The deck is full: deliver and come back.',
    ]);
    // On the Quay tab of Stonehaven, Maren's card carries it, fresh, though she lives elsewhere.
    const item = quayItems(
      quests,
      world.map,
      'stonehaven',
      new Set([`${MILL}:millstones`]),
      new Set(),
    ).find((i) => i.key === `${MILL}:millstones`)!;
    expect(item.card.news).toBe(lines(world, quests)[0]);
    expect(item.fresh).toBe(true);
    // Seen once, the same news is not news again.
    const seen = new Set([item.key, item.newsKey!]);
    expect(quayItems(quests, world.map, 'stonehaven', seen, new Set())[0]!.fresh).toBe(false);
  });

  it('says there is no room at all, and nothing aboard at the drop-off', () => {
    const { world, quests } = start('millstones', [0, 0, 0]);
    // A full hold does not matter; a deck too small for one piece does.
    world.trade.dockedAt = 'calda';
    expect(buy(world.trade, 'timber', 10).ok).toBe(true);
    const sloop = SHIP_CLASSES.sloop!;
    const deck = sloop.deck;
    sloop.deck = 4;
    try {
      world.trade.dockedAt = 'stonehaven';
      quests.check();
      expect(lines(world, quests)).toEqual([
        'No room on deck for Maren’s millstones. Deliver what’s on deck first, then call again.',
      ]);
    } finally {
      sloop.deck = deck;
    }
    world.trade.dockedAt = 'westholm';
    quests.check();
    expect(lines(world, quests)).toEqual([
      'Nothing aboard for Maren yet. Fetch the millstones from Stonehaven.',
    ]);
  });

  it('says how many were unloaded of how many, and a step done here pays on the next card', () => {
    const { world, quests } = start('millstones', [0, 0, 0]);
    const events: QuestEvent[] = [];
    quests.onEvent = (e) => events.push(e);
    world.trade.dockedAt = 'stonehaven';
    quests.check();
    world.trade.dockedAt = 'westholm';
    quests.check();
    expect(lines(world, quests)).toEqual([
      '1 millstone unloaded for Maren: 1 of 2. Fetch the rest from Stonehaven.',
    ]);
    world.trade.dockedAt = 'stonehaven';
    quests.check();
    expect(lines(world, quests)).toEqual(['1 millstone aboard for Maren. Sail to Westholm.']);
    world.trade.dockedAt = 'westholm';
    quests.check();
    expect(events).toContainEqual({ type: 'paid', quest: MILL, step: 'millstones', gold: 150 });
    const bread = quayItems(
      quests,
      world.map,
      'westholm',
      new Set(),
      new Set(),
      new Map([[MILL, 150]]),
    ).find((i) => i.key === `${MILL}:bread`)!;
    expect(bread.card.news).toMatch(
      /^Done! \+150 gold\. 4 baskets of bread aboard for Maren\. Sail to Saltmere\. The clock starts/,
    );
  });

  it('times a run: started, over par, made', () => {
    const { world, quests } = start('bread', [0, 0, 0, 0, 0]);
    const runs: QuestEvent[] = [];
    quests.onEvent = (e) => e.type === 'run' && runs.push(e);
    world.trade.dockedAt = 'westholm';
    quests.check();
    expect(lines(world, quests)).toContain(
      'The clock starts when you cast off. Par to Saltmere: 2:20.',
    );
    world.trade.dockedAt = null;
    quests.check(0.25);
    expect(runs.at(-1)).toMatchObject({
      state: 'started',
      par: 140,
      from: 'westholm',
      to: 'saltmere',
    });
    for (let t = 0; t < 30; t++) quests.check(1);
    expect(quests.runs()).toEqual([
      { quest: MILL, step: 'bread', sec: 30, par: 140, to: 'saltmere' },
    ]);
    for (let t = 0; t < 120; t++) quests.check(1);
    expect(runs.at(-1)).toMatchObject({ state: 'late' });
    expect(quests.runs()).toEqual([]);
    world.trade.dockedAt = 'saltmere';
    quests.check();
    expect(lines(world, quests)).toEqual([
      'Not this time. Try again from Westholm: par to Saltmere is 2:20.',
    ]);
    world.trade.dockedAt = 'westholm';
    quests.check();
    world.trade.dockedAt = null;
    quests.check(0.25);
    for (let t = 0; t < 60; t++) quests.check(1);
    world.trade.dockedAt = 'saltmere';
    quests.check(0.25);
    expect(runs.at(-1)).toMatchObject({ state: 'made' });
    expect(quests.progress(MILL)!.step).toBe(QUEST_DONE);
  });

  it('names quest cargo in the hold lists, whose and how much room', () => {
    const { world, quests } = start('millstones', [0, 0, 0]);
    expect(cargoLines(quests)).toEqual([]);
    world.trade.dockedAt = 'stonehaven';
    quests.check();
    expect(cargoLines(quests)).toEqual(['Maren’s millstones: 1 (6 space)']);
  });

  it('speaks French with the item’s own agreement', () => {
    setLanguage('fr');
    const { world, quests } = start('millstones', [0, 1, 0]);
    world.trade.dockedAt = 'westholm';
    quests.check();
    expect(lines(world, quests)).toEqual([
      '1 meule déchargée pour Maren : 1 sur 2. Le reste vous attend à Stonehaven.',
    ]);
    setLanguage('en');
  });
});
