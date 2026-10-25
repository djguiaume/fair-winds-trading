// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { GAME_MAP, PHASE1_MAP } from '../src/data/maps';
import { TUNING } from '../src/data/tuning';
import { setLanguage } from '../src/i18n';
import { contractReward, standingOrderGold } from '../src/sim/contracts';
import { DIFFICULTIES, knobs } from '../src/sim/difficulty';
import { packSave, unpackSave } from '../src/sim/saveCode';
import {
  QUESTS,
  type QuestDef,
  QuestBook,
  checkQuests,
  questsFor,
  readQuests,
} from '../src/sim/quests';
import { serializeWorld } from '../src/sim/save';
import { SLOOP } from '../src/sim/ship';
import { type World, createWorld } from '../src/sim/world';
import { cardFor, quayItems } from '../src/ui/questView';

// Decision 0214: people whose arc is done ask again, one ask at a time per port, after a few calls
// elsewhere, and are paid like a help order.

const ask = (id: string, good: string, qty: number) => ({
  id,
  goal: { is: 'landed', place: 'saltmere', good, qty },
  reward: { order: true as const },
});
const KIT: QuestDef = {
  id: 'test-kit',
  name: 'Kit asks',
  start: { is: 'quest-done', quest: 'first-voyage' },
  text: 'quest.standing-kit',
  giver: 'kit',
  port: 'saltmere',
  offer: true,
  repeat: true,
  steps: [ask('ask-1', 'timber', 6), ask('ask-2', 'grain', 5)],
};
const ROOK: QuestDef = { ...KIT, id: 'test-rook', giver: 'rook', text: 'quest.standing-rook' };
const DOCKINGS = TUNING.economy.orders.standingDockings;

function setup(quests: QuestDef[] = [KIT, ROOK]) {
  setLanguage('en');
  const world: World = createWorld(PHASE1_MAP, SLOOP);
  const book = new QuestBook(world, quests, { doneElsewhere: (id) => id === 'first-voyage' });
  book.check();
  return { world, book };
}

/** Docks at `port` and lets the quests see it. */
function dock(world: World, book: QuestBook, port: string | null) {
  world.trade.dockedAt = port;
  return book.check(0.25);
}

describe('standing orders (decision 0214)', () => {
  it('one ask at a time per port; the goods land on docking and pay like a help order', () => {
    const { world, book } = setup();
    expect(book.offered.map((q) => q.id)).toEqual(['test-kit']);
    world.trade.captain.cargo.timber = 10;
    const gold = world.trade.captain.gold;
    const pay = standingOrderGold(world.map, world.trade, 'saltmere', 'timber', 6)!;
    expect(pay).toBeGreaterThan(0);
    book.accept('test-kit');
    // Rook waits while Kit's ask runs.
    expect(book.offered).toEqual([]);
    const events = dock(world, book, 'saltmere');
    expect(events.map((e) => e.type)).toContain('finished');
    expect(world.trade.captain.cargo.timber).toBe(4);
    expect(world.trade.captain.gold).toBe(gold + pay);
    expect(book.progress('test-kit')).toMatchObject({ step: 'done', rounds: 1, wait: DOCKINGS });
    // Rook asks next; Kit waits for calls elsewhere.
    expect(book.offered.map((q) => q.id)).toEqual(['test-rook']);
  });

  it('asks again after calls at other ports, the next ask in turn', () => {
    const { world, book } = setup([KIT]);
    world.trade.captain.cargo.timber = 6;
    book.accept('test-kit');
    dock(world, book, 'saltmere');
    expect(book.offered).toEqual([]);
    // Calls at the same port do not count, other ports do.
    for (let i = 0; i < DOCKINGS; i++) {
      dock(world, book, null);
      dock(world, book, 'saltmere');
    }
    expect(book.offered).toEqual([]);
    for (let i = 0; i < DOCKINGS; i++) {
      dock(world, book, null);
      dock(world, book, i % 2 ? 'westholm' : 'calda');
    }
    expect(book.offered.map((q) => q.id)).toEqual(['test-kit']);
    const card = cardFor(book, world.map, 'test-kit', 'offer')!;
    expect(card.good).toBe('grain');
    expect(card.round).toBe(2);
    expect(card.ask).toBe('Bring grain to Saltmere');
    book.accept('test-kit');
    expect(book.progress('test-kit')).toMatchObject({ step: 'ask-2', rounds: 1 });
  });

  it('the thanks card speaks the ask just delivered, and the offer shows the pay', () => {
    const { world, book } = setup([KIT]);
    const offer = cardFor(book, world.map, 'test-kit', 'offer')!;
    expect(offer.reward?.gold).toBe(
      standingOrderGold(world.map, world.trade, 'saltmere', 'timber', 6),
    );
    expect(offer.moreSteps).toBeUndefined();
    world.trade.captain.cargo.timber = 6;
    book.accept('test-kit');
    dock(world, book, 'saltmere');
    const items = quayItems(book, world.map, 'saltmere', new Set(), new Set(['test-kit']));
    expect(items[0]!.card.kind).toBe('finished');
    expect(items[0]!.card.speech).toBe(
      'Thwarts in, boats out. Gulls are already circling. Thanks, captain.',
    );
  });

  it('pays on every level what a help order there would', () => {
    const { world } = setup([KIT]);
    for (const level of DIFFICULTIES) {
      world.trade.difficulty = level;
      const port = world.map.ports.find((p) => p.id === 'saltmere')!;
      const order = contractReward(world.map, port, 'timber', 6, knobs(level).orderFactor);
      const help = TUNING.economy.orders.helpRewardFactor;
      expect(standingOrderGold(world.map, world.trade, 'saltmere', 'timber', 6)).toBe(
        Math.round((order * help) / 5) * 5,
      );
    }
  });

  it('keeps its rounds and wait in the save and the save code', () => {
    const { world, book } = setup([KIT]);
    world.trade.captain.cargo.timber = 6;
    book.accept('test-kit');
    dock(world, book, 'saltmere');
    const json = JSON.parse(JSON.stringify(world.trade.quests));
    expect(readQuests(json, world.map, [KIT]).byId['test-kit']).toMatchObject({
      rounds: 1,
      wait: DOCKINGS,
    });
    // A wait longer than the tuning allows is cut down to it.
    json.byId['test-kit'].wait = 99;
    expect(readQuests(json, world.map, [KIT]).byId['test-kit']!.wait).toBe(DOCKINGS);
    const save = serializeWorld(world);
    const back = unpackSave(packSave(save, world.map, [KIT]), world.map, save.version, [KIT]);
    expect(back.ok && back.raw.quests?.byId['test-kit']).toMatchObject({
      rounds: 1,
      wait: DOCKINGS,
    });
  });

  it('checks a standing order', () => {
    const lines = (q: Partial<QuestDef>) =>
      checkQuests([{ ...KIT, ...q } as QuestDef], PHASE1_MAP, ['first-voyage']);
    expect(lines({})).toEqual([]);
    expect(lines({ offer: undefined }).join()).toContain('a standing order is offered');
    expect(lines({ port: undefined }).join()).toContain('a standing order needs its port');
    expect(lines({ steps: [{ ...ask('ask-1', 'fish', 6) }] }).join()).toContain(
      'saltmere never wants fish',
    );
    expect(lines({ steps: [{ ...ask('ask-1', 'timber', 6), next: 'done' }] }).join()).toContain(
      'is one ask',
    );
  });

  it('every person whose arc is done has one, at their port, after their arc', () => {
    const standing = QUESTS.filter((q) => q.repeat);
    expect(standing.map((q) => q.giver).sort()).toEqual(
      [
        'ada',
        'bram',
        'elias',
        'ines',
        'juno',
        'kit',
        'maren',
        'ness',
        'nell',
        'oskar',
        'pip',
        'rook',
        'sigrun',
        'tam',
        'wren',
      ].sort(),
    );
    expect(
      checkQuests(
        standing,
        GAME_MAP,
        QUESTS.filter((q) => !q.repeat).map((q) => q.id),
      ),
    ).toEqual([]);
    expect(questsFor(GAME_MAP).filter((q) => q.repeat)).toHaveLength(15);
    for (const q of standing) {
      expect(q.steps.length).toBeGreaterThanOrEqual(3);
      for (const s of q.steps) expect(s.goal?.place).toBe(q.port);
    }
  });
});

describe('standing orders in a quest test (decision 0214)', () => {
  it('plays an ask from its offer, the asks before it done', () => {
    const { world, book } = setup([KIT]);
    book.testStart('test-kit', 'ask-2');
    expect(book.offered.map((q) => q.id)).toEqual(['test-kit']);
    expect(cardFor(book, world.map, 'test-kit', 'offer')!.good).toBe('grain');
  });
});
