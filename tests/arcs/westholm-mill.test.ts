import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../../src/data/maps';
import { QUESTS, QUEST_DONE, QuestBook, checkQuests } from '../../src/sim/quests';
import { giveHomeIsland, islandHome } from '../../src/sim/home';
import { SLOOP } from '../../src/sim/ship';
import { buy, cargoUsed, sell } from '../../src/sim/trade';
import { TUTORIAL_QUEST } from '../../src/sim/tutorial';
import { type World, createWorld } from '../../src/sim/world';
import { cardFor, parClock } from '../../src/ui/questView';
import { setLanguage } from '../../src/i18n';
import en from '../../src/i18n/en.json';
import fr from '../../src/i18n/fr.json';

// The Westholm arc, "The mill on the hill" (storyteller brief 0129, decision 0132): Maren's
// three steps played through on the engine, with the shipped quest file and text.
const ID = 'westholm-mill';
const quest = QUESTS.find((q) => q.id === ID)!;

function dock(world: World, port: string) {
  world.trade.dockedAt = port;
}

function start(difficulty?: string) {
  const world = createWorld(PHASE1_MAP, SLOOP);
  if (difficulty) world.trade.difficulty = difficulty as never;
  world.trade.captain.gold = 10_000;
  world.trade.quests.byId['rooks-thanks'] = { step: QUEST_DONE, counts: [], chose: {} };
  giveHomeIsland(world.trade, PHASE1_MAP);
  const quests = new QuestBook(world, QUESTS, { doneElsewhere: (id) => id === TUTORIAL_QUEST.id });
  return { world, quests };
}

describe('the Westholm mill arc (0129, 0132)', () => {
  it('is a sound quest file, offered by Maren at Westholm once Rook has given the island', () => {
    expect(checkQuests(QUESTS, PHASE1_MAP, [TUTORIAL_QUEST.id])).toEqual([]);
    expect(quest.giver).toBe('maren');
    expect(quest.steps.map((s) => s.id)).toEqual(['sails', 'millstones', 'bread']);
    const { quests } = start();
    quests.check();
    expect(quests.offered.map((q) => q.id)).toContain(ID);
    const offer = cardFor(quests, PHASE1_MAP, ID, 'offer')!;
    expect(offer.giver?.id).toBe('maren');
    expect(offer.mood).toBe('worried');
    expect(offer.ask).toBe('Bring timber to Westholm');
  });

  it('plays through: timber, two millstones in a sloop (two trips), warm bread in time', () => {
    const { world, quests } = start();
    quests.check();
    quests.accept(ID);
    const gold = () => world.trade.captain.gold;

    // Sails: 8 timber sold at Westholm.
    dock(world, 'calda');
    expect(buy(world.trade, 'timber', 8).ok).toBe(true);
    quests.check();
    const before = gold();
    dock(world, 'westholm');
    const paid = gold();
    expect(sell(world.trade, 'timber', 8, PHASE1_MAP).ok).toBe(true);
    const sale = gold() - paid;
    quests.check();
    expect(quests.progress(ID)!.step).toBe('millstones');
    expect(gold() - paid - sale).toBe(100);

    // Millstones: space 6 each, the sloop's hold of 10 takes one a trip.
    for (let trip = 1; trip <= 2; trip++) {
      dock(world, 'stonehaven');
      quests.check();
      expect(cargoUsed(world.trade)).toBe(6);
      dock(world, 'westholm');
      quests.check();
    }
    expect(quests.progress(ID)!.step).toBe('bread');

    // Bread: four baskets loaded at Westholm, the run timed to Saltmere.
    quests.check();
    expect(cargoUsed(world.trade)).toBe(4);
    world.trade.dockedAt = null;
    quests.check(0.25);
    for (let t = 0; t < 90; t += 1) quests.check(1);
    const level = world.trade.settlements.byPort.westholm!.level;
    dock(world, 'saltmere');
    expect(quests.check(0.25)).toContainEqual({ type: 'finished', quest: ID });
    expect(cargoUsed(world.trade)).toBe(0);
    expect(world.trade.settlements.byPort.westholm!.level).toBe(level + 1);
    // About 500 gold over the arc, and the stores spot on Skerry offered.
    expect(gold() - before - sale).toBe(500);
    expect(islandHome(world.trade.home, 'skerry').offered).toContain('spot-2');
  });

  it('a run over par is tried again from Westholm', () => {
    const { world, quests } = start();
    world.trade.quests.byId[ID] = { step: 'bread', counts: [0, 0, 0, 0, 0], chose: {} };
    quests.check();
    dock(world, 'westholm');
    quests.check();
    world.trade.dockedAt = null;
    quests.check(0.25);
    // Captain's par is 140 s.
    for (let t = 0; t < 150; t += 1) quests.check(1);
    dock(world, 'saltmere');
    quests.check(0.25);
    expect(quests.progress(ID)!.step).toBe('bread');
    dock(world, 'westholm');
    quests.check();
    world.trade.dockedAt = null;
    quests.check(0.25);
    for (let t = 0; t < 100; t += 1) quests.check(1);
    dock(world, 'saltmere');
    expect(quests.check(0.25)).toContainEqual({ type: 'finished', quest: ID });
  });

  it('shows the par of the voyage level in the bread title, in both languages', () => {
    for (const [level, secs] of [
      ['fair', 180],
      ['captain', 140],
      ['salt', 110],
    ] as const) {
      const { world, quests } = start(level);
      world.trade.quests.byId[ID] = { step: 'bread', counts: [0, 0, 0, 0, 0], chose: {} };
      quests.check();
      expect(quests.parSeconds(quest.steps[2])).toBe(secs);
      expect(cardFor(quests, PHASE1_MAP, ID, 'step')!.ask).toBe(
        `Rush bread to Saltmere in ${parClock(secs)}`,
      );
    }
    expect(parClock(140)).toBe('2:20');
    setLanguage('fr');
    const { world, quests } = start();
    world.trade.quests.byId[ID] = { step: 'bread', counts: [0, 0, 0, 0, 0], chose: {} };
    quests.check();
    expect(cardFor(quests, PHASE1_MAP, ID, 'step')!.ask).toContain('2:20');
    setLanguage('en');
  });

  it('has every card in English and French, within the brief’s lengths', () => {
    const keys = ['name', 'done.title', 'done.copy'].concat(
      quest.steps.flatMap((s) => [`${s.id}.title`, `${s.id}.copy`]),
    );
    for (const k of keys) {
      const key = `quest.${ID}.${k}`;
      const e = (en as Record<string, string>)[key] ?? '';
      const f = (fr as Record<string, string>)[key] ?? '';
      expect(e, key).toBeTruthy();
      expect(f, key).toBeTruthy();
      if (k.endsWith('.copy')) {
        expect(e.length, key).toBeLessThanOrEqual(220);
        expect(f.length, key).toBeLessThanOrEqual(Math.max(220, e.length * 1.2) + 10);
        expect(f, key).not.toMatch(/\btu\b|\btoi\b|\bton\b|\bta\b|\btes\b/i);
      }
    }
  });
});
