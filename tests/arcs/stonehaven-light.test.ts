import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../../src/data/maps';
import { setLanguage, tOptional } from '../../src/i18n';
import { QUESTS, QuestBook, checkQuests, questsFor } from '../../src/sim/quests';
import { SLOOP } from '../../src/sim/ship';
import { sell } from '../../src/sim/trade';
import { type World, createWorld } from '../../src/sim/world';
import { cardFor, dueCard } from '../../src/ui/questView';

// Decision 0133: "A light on the Teeth", Ada Flint's arc, played through on the engine.
const ID = 'stonehaven-light';
const LANDING = { x: -239, y: -80 };

function setup() {
  setLanguage('en');
  const world: World = createWorld(PHASE1_MAP, SLOOP);
  world.trade.captain.gold = 10_000;
  const book = new QuestBook(world, QUESTS, {
    doneElsewhere: (id) => id === 'first-voyage',
    nightOk: () => false,
  });
  return { world, book };
}

/** Let `sec` seconds of checks go by at (x, y), at `kn` knots, out of port. */
function hold(world: World, book: QuestBook, x: number, y: number, kn: number, sec: number) {
  world.trade.dockedAt = null;
  Object.assign(world.boat, { x, y, speedKn: kn });
  for (let t = 0; t < sec - 1e-9; t += 0.25) book.check(0.25);
}

function dock(world: World, book: QuestBook, port: string) {
  const island = world.map.ports.find((p) => p.id === port)!.islandId;
  const { x, y } = world.map.islands.find((i) => i.id === island)!;
  Object.assign(world.boat, { x, y, speedKn: 0 });
  world.trade.dockedAt = port;
  book.check();
}

describe('A light on the Teeth (decision 0133)', () => {
  it('passes the checks, with every card written in both languages', () => {
    expect(checkQuests(questsFor(PHASE1_MAP), PHASE1_MAP)).toEqual([]);
    const quest = QUESTS.find((q) => q.id === ID)!;
    for (const lang of ['en', 'fr'] as const) {
      setLanguage(lang);
      for (const step of [...quest.steps.map((s) => s.id), 'done'])
        for (const part of ['title', 'copy'])
          expect(tOptional(`quest.${ID}.${step}.${part}`), `${lang} ${step}.${part}`).toBeTruthy();
      expect(tOptional(`quest.${ID}.name`)).toBeTruthy();
    }
    setLanguage('en');
  });

  it('plays through in a sloop: timber, three trips of stone, then the lens from Old Ness', () => {
    const { world, book } = setup();
    book.check();
    expect(book.offered.map((q) => q.id)).not.toContain(ID);
    // Opens with the other arcs once Rook's thanks is done.
    world.trade.quests.byId['rooks-thanks'] = { step: 'done', counts: [], chose: {} };
    dock(world, book, 'stonehaven');
    expect(dueCard(book, world.map, 'stonehaven', new Set(), new Set())).toEqual({
      quest: ID,
      kind: 'offer',
    });
    const offer = cardFor(book, world.map, ID, 'offer')!;
    expect([offer.giver?.id, offer.mood]).toEqual(['ada', 'worried']);
    book.accept(ID);

    // 1. Six timber for the scaffold.
    const gold = world.trade.captain.gold;
    world.trade.captain.cargo.timber = 6;
    book.check();
    expect(sell(world.trade, 'timber', 6, world.map).ok).toBe(true);
    book.check();
    expect(book.progress(ID)!.step).toBe('stone');

    // 2. Three blocks of five spaces: a sloop's deck of eight takes one a trip (decision 0210).
    book.check();
    expect(book.progress(ID)!.counts[0]).toBe(1);
    expect(world.trade.quests.hold).toBe(5);
    // Too fast at the landing: nothing comes off.
    hold(world, book, LANDING.x, LANDING.y, 4, 4);
    expect(book.progress(ID)!.counts.slice(0, 2)).toEqual([1, 0]);
    hold(world, book, LANDING.x, LANDING.y, 1, 3.5);
    expect(book.progress(ID)!.counts.slice(0, 2)).toEqual([0, 1]);
    // Touching the reef on the way starts the step over.
    dock(world, book, 'stonehaven');
    expect(book.progress(ID)!.counts[0]).toBe(1);
    world.trade.captain.hullDamage[world.trade.captain.activeShip] = 5;
    hold(world, book, -200, -90, 5, 0.5);
    expect(book.progress(ID)!.counts).toEqual([0, 0, 0]);
    for (let trip = 1; trip <= 3; trip++) {
      dock(world, book, 'stonehaven');
      expect(book.progress(ID)!.counts[0]).toBe(1);
      hold(world, book, LANDING.x + (trip === 2 ? 2 : 0), LANDING.y, 1, 3.5);
    }
    expect(book.progress(ID)!.step).toBe('lens');

    // 3. Old Ness speaks the lens card at Watchman Key.
    expect(dueCard(book, world.map, null, new Set(), new Set())).toBeNull();
    expect(dueCard(book, world.map, 'watchman-key', new Set(), new Set())).toEqual({
      quest: ID,
      kind: 'step',
    });
    const lens = cardFor(book, world.map, ID, 'step')!;
    expect(lens.giver?.id).toBe('ness');
    expect(lens.speech).toContain('lens');
    dock(world, book, 'watchman-key');
    expect(book.progress(ID)!.counts[0]).toBe(1);
    hold(world, book, LANDING.x, LANDING.y, 1, 3.5);
    expect(book.progress(ID)!.step).toBe('done');
    expect(world.trade.captain.gold - gold).toBeGreaterThanOrEqual(500);

    // Ada's thanks waits at Stonehaven.
    const thanks = cardFor(book, world.map, ID, 'finished')!;
    expect([thanks.giver?.id, thanks.mood]).toEqual(['ada', 'pleased']);
  });
});
