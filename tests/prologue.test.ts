import { describe, expect, it } from 'vitest';
import { PHASE0_MAP, PHASE1_MAP } from '../src/data/maps';
import { QUESTS, QuestBook } from '../src/sim/quests';
import { landmarkSpot } from '../src/sim/landmarks';
import { SLOOP } from '../src/sim/ship';
import { TUTORIAL_QUEST, Tutorial } from '../src/sim/tutorial';
import { createWorld, startAtPrologue, type World } from '../src/sim/world';

// Decision 0127: the tutorial is the prologue rescue, and Rook's thanks is the island.

function harboursOf(map = PHASE1_MAP) {
  return Object.fromEntries(
    map.ports.map((p) => {
      const i = map.islands.find((i) => i.id === p.islandId)!;
      return [p.id, { x: i.x + i.radius + 5, y: i.y }];
    }),
  );
}

function book(world: World, tutorial: Tutorial) {
  return new QuestBook(world, QUESTS, {
    doneElsewhere: (id) => id === TUTORIAL_QUEST.id && !tutorial.isActive,
    atElsewhere: (id, step) => id === TUTORIAL_QUEST.id && tutorial.reached(step),
    nightOk: () => true,
  });
}

/** Through sails and wind to the foghorn lesson. */
function toFoghorn(tutorial: Tutorial) {
  tutorial.start();
  tutorial.continueLesson();
  tutorial.continueLesson();
  expect(tutorial.step).toBe('foghorn');
}

describe('the prologue at sea (decision 0127)', () => {
  it('starts a fresh voyage alone on open sea, sails kept, nothing docked', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.boat.sailStep = 2;
    expect(startAtPrologue(world)).toBe(true);
    const { start } = PHASE1_MAP.prologue!;
    expect(world.boat).toMatchObject({ x: start.x, y: start.y, sailStep: 2 });
    expect(world.trade.dockedAt).toBeNull();
    expect(world.destination).toBeNull();
    for (const island of PHASE1_MAP.islands)
      expect(Math.hypot(island.x - start.x, island.y - start.y) - island.radius).toBeGreaterThan(
        20,
      );
    // A map without a prologue leaves the voyage where it is.
    const plain = createWorld(PHASE0_MAP, SLOOP);
    const before = { ...plain.boat };
    expect(startAtPrologue(plain)).toBe(false);
    expect(plain.boat).toEqual(before);
  });

  it('puts the wreck on the East Reef, where the reef is drawn', () => {
    const wreck = landmarkSpot(PHASE1_MAP, PHASE1_MAP.prologue!.wreck)!;
    const reef = PHASE1_MAP.terrain!.find((t) => t.id === 'east-reef')!;
    expect(reef.kind).toBe('reef');
    expect(Number.isFinite(wreck.x) && Number.isFinite(wreck.y)).toBe(true);
    expect(new Tutorial(createWorld(PHASE1_MAP, SLOOP), {}, null).wreck).toEqual(wreck);
  });

  it('marks the wreck on the compass and only counts a slow, clean approach', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const tutorial = new Tutorial(world, harboursOf(), null);
    expect(tutorial.mark).toBeNull();
    toFoghorn(tutorial);
    const wreck = tutorial.wreck!;
    expect(tutorial.mark).toEqual(wreck);
    Object.assign(world.boat, { x: wreck.x + 60, y: wreck.y });
    tutorial.observe();
    expect(tutorial.step).toBe('foghorn');
    Object.assign(world.boat, { x: wreck.x + 30, y: wreck.y });
    tutorial.observe();
    expect(tutorial.step).toBe('wreck');
    // Too fast alongside: nothing.
    Object.assign(world.boat, { x: wreck.x + 10, y: wreck.y, speedKn: 4 });
    for (let n = 0; n < 10; n++) tutorial.observe({ sailStep: 2, steer: 0 }, 0.5);
    expect(tutorial.step).toBe('wreck');
    // Slow, but touching the reef starts the hold again.
    world.boat.speedKn = 1;
    for (let n = 0; n < 5; n++) tutorial.observe({ sailStep: 0, steer: 0 }, 0.5);
    const ship = world.trade.captain.activeShip;
    world.trade.captain.hullDamage[ship] = (world.trade.captain.hullDamage[ship] ?? 0) + 1;
    tutorial.observe({ sailStep: 0, steer: 0 }, 0.5);
    for (let n = 0; n < 4; n++) tutorial.observe({ sailStep: 0, steer: 0 }, 0.5);
    expect(tutorial.step).toBe('wreck');
    tutorial.observe({ sailStep: 0, steer: 0 }, 0.5);
    expect(tutorial.step).toBe('chart');
    expect(tutorial.mark).toBeNull();
    expect(tutorial.passenger).toBe(true);
    expect(tutorial.origin).toBe('saltmere');
  });

  it('skips the sea lessons on a map without a prologue', () => {
    const world = createWorld(PHASE0_MAP, SLOOP);
    const tutorial = new Tutorial(world, harboursOf(PHASE0_MAP), null);
    tutorial.start();
    tutorial.continueLesson();
    tutorial.continueLesson();
    expect(tutorial.wreck).toBeNull();
    expect(tutorial.step).toBe('chart');
  });
});

describe("Rook's thanks: the island (decision 0127)", () => {
  it('ends on the dock that brings Rook home, during the tutorial', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const harbours = harboursOf();
    const tutorial = new Tutorial(world, harbours, null);
    const quests = book(world, tutorial);
    toFoghorn(tutorial);
    quests.check();
    expect(quests.progress('rooks-thanks')).toBeUndefined();
    const wreck = tutorial.wreck!;
    Object.assign(world.boat, { x: wreck.x + 10, y: wreck.y, speedKn: 1 });
    tutorial.observe();
    for (let n = 0; n < 7; n++) tutorial.observe({ sailStep: 0, steer: 0 }, 0.5);
    world.destination = { portId: 'saltmere', label: 'Saltmere', ...harbours.saltmere! };
    tutorial.destinationSelected();
    expect(tutorial.step).toBe('home');
    world.trade.dockedAt = 'saltmere';
    tutorial.observe();
    expect(tutorial.step).toBe('island');
    expect(tutorial.reached('island')).toBe(true);
    quests.check();
    quests.check();
    expect(quests.isDone('rooks-thanks')).toBe(true);
  });

  it('waits for the next Saltmere dock when the tutorial is skipped', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const tutorial = new Tutorial(world, harboursOf(), null);
    tutorial.start();
    const quests = book(world, tutorial);
    world.trade.dockedAt = null;
    quests.check();
    expect(quests.progress('rooks-thanks')).toBeUndefined();
    tutorial.skip();
    quests.check();
    expect(quests.isAt('rooks-thanks', 'home')).toBe(true);
    expect(quests.isDone('rooks-thanks')).toBe(false);
    world.trade.dockedAt = 'calda';
    quests.check();
    expect(quests.isDone('rooks-thanks')).toBe(false);
    world.trade.dockedAt = 'saltmere';
    quests.check();
    expect(quests.isDone('rooks-thanks')).toBe(true);
  });
});
