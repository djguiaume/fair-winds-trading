import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../../src/data/maps';
import { ISLAND_DESIGNS } from '../../src/data/islands';
import { clearAt } from '../../src/sim/mapChecks';
import { landmarkSpot } from '../../src/sim/landmarks';
import {
  type QuestEvent,
  QUESTS,
  QuestBook,
  checkQuestHooks,
  checkQuests,
  questsFor,
} from '../../src/sim/quests';
import { producesAt } from '../../src/sim/settlement';
import { SLOOP } from '../../src/sim/ship';
import { type World, createWorld } from '../../src/sim/world';
import { stepMarkers } from '../../src/ui/questView';
import { t } from '../../src/i18n';
import en from '../../src/i18n/en.json';
import fr from '../../src/i18n/fr.json';
import quest from '../../src/data/quests/saltmere-shoals.json';

// The Saltmere arc, "Where the shoals went" (decisions 0122, 0129, 0130), played on the engine.

const ID = 'saltmere-shoals';
type Point = { x: number; y: number };
const goalPoints = (step: number) =>
  (quest.steps[step]!.goal as unknown as { points: Point[] }).points;

function voyage() {
  const world = createWorld(PHASE1_MAP, SLOOP);
  world.trade.quests.byId['rooks-thanks'] = { step: 'done', counts: [], chose: {} };
  const book = new QuestBook(world, QUESTS, {
    doneElsewhere: (id) => id === 'first-voyage',
    nightOk: () => true,
  });
  book.check();
  return { world, book };
}

/** Sail to (x, y) at `kn` knots and let `sec` seconds of checks go by there. */
function sailTo(world: World, book: QuestBook, at: Point, kn = 6, sec = 0.25) {
  world.boat.x = at.x;
  world.boat.y = at.y;
  world.boat.speedKn = kn;
  const events: QuestEvent[] = [];
  for (let s = 0; s < sec - 1e-9; s += 0.25) events.push(...book.check(0.25));
  return events;
}

/**
 * Make for `at` from open water to the north-east, the way a boat comes in: a straight jump
 * would sweep past the other spots along the reef on the way.
 */
function visit(world: World, book: QuestBook, at: Point) {
  sailTo(world, book, { x: 360, y: 260 });
  sailTo(world, book, { x: at.x + 30, y: at.y + 27 });
  return sailTo(world, book, at);
}

describe('saltmere-shoals', () => {
  it('passes the quest checks and its hooks name it', () => {
    expect(checkQuests(questsFor(PHASE1_MAP), PHASE1_MAP)).toEqual([]);
    expect(checkQuestHooks(PHASE1_MAP, Object.values(ISLAND_DESIGNS), QUESTS)).toEqual([]);
    expect(QUESTS.some((q) => q.id === ID)).toBe(true);
  });

  it('has every card in both languages, short enough for the card', () => {
    const keys = ['name', ...quest.steps.flatMap((s) => [`${s.id}.title`, `${s.id}.copy`])];
    keys.push('done.title', 'done.copy');
    for (const dict of [en, fr] as Record<string, string>[])
      for (const key of keys) expect(dict[`quest.${ID}.${key}`], key).toBeTruthy();
    for (const s of [...quest.steps.map((s) => s.id), 'done']) {
      const copy = (en as Record<string, string>)[`quest.${ID}.${s}.copy`]!;
      expect(copy.length).toBeLessThanOrEqual(220);
      const french = (fr as Record<string, string>)[`quest.${ID}.${s}.copy`]!;
      expect(french.length).toBeLessThanOrEqual(220 * 1.2);
    }
    expect(t(`quest.${ID}.gulls.title`)).toBe('Find the diving gulls');
  });

  it('puts every gull spot clear of the reef and every gate in the gap', () => {
    for (const p of goalPoints(0))
      expect(clearAt(PHASE1_MAP, p.x, p.y, SLOOP.radius + 4)).toBe(true);
    for (const p of goalPoints(1))
      expect(clearAt(PHASE1_MAP, p.x, p.y, SLOOP.radius + 4)).toBe(true);
    // The wreck is not in the way of anything Kit asks for.
    const wreck = landmarkSpot(PHASE1_MAP, 'east-reef')!;
    for (const p of [...goalPoints(0), ...goalPoints(1)])
      expect(Math.hypot(p.x - wreck.x, p.y - wreck.y)).toBeGreaterThan(15);
  });

  it('is offered at Saltmere once Rook has given the island, and plays through', () => {
    const { world, book } = voyage();
    expect(book.offered.map((q) => q.id)).toContain(ID);
    const gold = world.trade.captain.gold;
    world.trade.dockedAt = 'saltmere';
    book.accept(ID);
    world.trade.dockedAt = null;
    expect(book.progress(ID)!.step).toBe('gulls');

    // Gulls: any order, and a scrape on the reef starts the step over.
    const [a, b, c] = goalPoints(0) as [Point, Point, Point];
    visit(world, book, c);
    visit(world, book, a);
    expect(stepMarkers(quest.steps[0]!.goal as never, book.progress(ID)!.counts)).toHaveLength(3);
    world.trade.captain.hullDamage.sloop = 1;
    expect(sailTo(world, book, { x: 300, y: 300 })).toEqual([
      { type: 'reset', quest: ID, step: 'gulls' },
    ]);
    visit(world, book, b);
    visit(world, book, a);
    expect(visit(world, book, c)).toContainEqual({ type: 'step', quest: ID, step: 'channel' });
    expect(world.trade.captain.gold).toBe(gold + 100);

    // The channel: gates in order only.
    const gates = goalPoints(1);
    sailTo(world, book, gates[2]!);
    expect(book.progress(ID)!.counts[0]).toBe(0);
    sailTo(world, book, gates[0]!);
    sailTo(world, book, gates[1]!);
    expect(sailTo(world, book, gates[2]!)).toContainEqual({
      type: 'step',
      quest: ID,
      step: 'catch',
    });
    expect(world.trade.captain.gold).toBe(gold + 250);

    // The catch: six crates from Saltmere to Port Calda, within par.
    world.trade.dockedAt = 'saltmere';
    book.check(0.25);
    expect(book.progress(ID)!.counts[0]).toBe(6);
    expect(world.trade.quests.hold).toBe(6);
    world.trade.dockedAt = null;
    book.check(0.25);
    for (let s = 0; s < 60; s++) book.check(1);
    world.trade.dockedAt = 'calda';
    const done = book.check(0.25);
    expect(done).toContainEqual({ type: 'finished', quest: ID });
    expect(world.trade.captain.gold).toBe(gold + 500);
    expect(world.trade.quests.hold).toBeUndefined();

    // The port change: smoked fish from level 2, and a spot on the home island to build.
    expect(producesAt(PHASE1_MAP, world.trade, 'saltmere')).toContain('smokedFish');
    expect(world.trade.home.islands.skerry?.offered ?? []).toContain('spot-3');
  });

  it('makes the catch run again when it goes over par', () => {
    const { world, book } = voyage();
    world.trade.quests.byId[ID] = { step: 'catch', counts: [0, 0, 0, 0, 0, 0], chose: {} };
    world.trade.dockedAt = 'saltmere';
    book.check(0.25);
    world.trade.dockedAt = null;
    book.check(0.25);
    for (let s = 0; s < 200; s++) book.check(1);
    world.trade.dockedAt = 'calda';
    expect(book.check(0.25)).toEqual([]);
    expect(book.progress(ID)!.step).toBe('catch');
  });

  it('keeps Saltmere’s smoked fish at level 3 before the arc', () => {
    const { world } = voyage();
    expect(producesAt(PHASE1_MAP, world.trade, 'saltmere')).toEqual(['fish']);
  });
});
