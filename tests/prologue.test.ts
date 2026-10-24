import { describe, expect, it } from 'vitest';
import { PHASE0_MAP, PHASE1_MAP } from '../src/data/maps';
import { QUESTS, QuestBook, type QuestDef, checkQuests } from '../src/sim/quests';
import { checkStepEffects, heldWind } from '../src/sim/stepEffects';
import { landmarkSpot } from '../src/sim/landmarks';
import { SLOOP } from '../src/sim/ship';
import { TUTORIAL_QUEST, Tutorial } from '../src/sim/tutorial';
import { DEG } from '../src/sim/math';
import { questGoal } from '../src/ui/questView';
import { createWorld, startAtPrologue, stepWorld, type World } from '../src/sim/world';

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
  it('starts a fresh voyage alone on open sea, sails down, nothing docked', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.boat.sailStep = 2;
    expect(startAtPrologue(world)).toBe(true);
    const { start } = PHASE1_MAP.prologue!;
    // Lying still with the sails down: raising them is the first lesson (decision 0139).
    expect(world.boat).toMatchObject({ x: start.x, y: start.y, sailStep: 0, speedKn: 0 });
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
    expect(world.trade.home.islands.skerry?.owned ?? false).toBe(false);
    quests.check();
    quests.check();
    expect(quests.isDone('rooks-thanks')).toBe(true);
    expect(world.trade.home.islands.skerry?.owned ?? false).toBe(true);
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
    expect(world.trade.home.islands.skerry?.owned ?? false).toBe(true);
  });
});

describe('a gentler prologue (decision 0139)', () => {
  it('holds a light, steady breeze until Rook is home, then gives the sea its wind back', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const harbours = harboursOf();
    const tutorial = new Tutorial(world, harbours, null);
    startAtPrologue(world);
    tutorial.start();
    // As the game does: the lesson's `wind` is held before every step.
    const sail = (seconds: number) => {
      for (let n = 0; n < seconds * 10; n++) {
        world.calmWind = tutorial.heldWind;
        stepWorld(world, { sailStep: 0, steer: 0 }, 0.1);
        tutorial.observe({ sailStep: 0, steer: 0 }, 0.1);
      }
    };
    sail(60);
    expect(world.seaWind.speedKn).toBe(TUTORIAL_QUEST.steps[0]!.wind!.speedKn);
    expect(world.seaWind.from).toBeCloseTo(PHASE1_MAP.wind.fromDeg * DEG);
    // Still calm while taking Rook home; the trading lessons sail in the sea's own wind.
    toChart(world, tutorial);
    world.destination = { portId: 'saltmere', label: 'Saltmere', ...harbours.saltmere! };
    tutorial.destinationSelected();
    tutorial.observe();
    expect(tutorial.step).toBe('home');
    expect(tutorial.heldWind).not.toBeNull();
    world.trade.dockedAt = 'saltmere';
    tutorial.observe();
    expect(tutorial.step).toBe('island');
    expect(tutorial.heldWind).toBeNull();
    tutorial.skip();
    expect(tutorial.heldWind).toBeNull();
  });

  it('sounds the foghorn from step data any quest can use, and checks it', () => {
    const foghorn = TUTORIAL_QUEST.steps.find((s) => s.id === 'foghorn')!;
    expect(foghorn.sound).toEqual({ effect: 'foghorn', everySec: 9 });
    for (const step of TUTORIAL_QUEST.steps) expect(checkStepEffects(step, step.id)).toEqual([]);
    expect(checkStepEffects({ sound: { effect: 'kazoo', everySec: 1 } }, 'x')).toEqual([
      'x › sound: no effect "kazoo" in audio.json',
      'x › sound: everySec of 2 or more',
    ]);
    expect(checkStepEffects({ wind: { speedKn: 0 } }, 'x')).toEqual([
      'x › wind: speedKn between 0 and 40',
    ]);
    expect(heldWind({ speedKn: 6, fromDeg: 90 }, PHASE1_MAP)).toEqual({
      from: 90 * DEG,
      speedKn: 6,
    });
    expect(heldWind(undefined, PHASE1_MAP)).toBeNull();
  });

  it("holds a tracked quest step's wind and points the sea at its compass", () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const quest = {
      id: 'test-calm',
      name: 'Test: a calm search',
      start: { is: 'always' },
      text: 'quest.test-calm',
      steps: [
        {
          id: 'listen',
          goal: { is: 'docked', port: 'calda' },
          compass: { x: 10, y: 20 },
          wind: { speedKn: 5 },
          sound: { effect: 'foghorn', everySec: 6 },
        },
      ],
    } as unknown as QuestDef;
    expect(checkQuests([quest], PHASE1_MAP)).toEqual([]);
    const quests = new QuestBook(world, [quest]);
    quests.check();
    quests.track('test-calm');
    expect(quests.trackedStep?.wind).toEqual({ speedKn: 5 });
    expect(heldWind(quests.trackedStep?.wind, PHASE1_MAP)?.speedKn).toBe(5);
    expect(questGoal(quests, PHASE1_MAP, {})).toEqual({
      x: 10,
      y: 20,
      label: 'Test: a calm search',
    });
  });

  it('starts far from the reef: a minute at full sail on the start heading touches nothing', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const tutorial = new Tutorial(world, harboursOf(), null);
    startAtPrologue(world);
    tutorial.start();
    const wreck = tutorial.wreck!;
    const { start } = PHASE1_MAP.prologue!;
    expect(Math.hypot(start.x - wreck.x, start.y - wreck.y)).toBeGreaterThan(150);
    const full = { sailStep: 2, steer: 0 };
    let bumped = false;
    for (let n = 0; n < 600; n++) {
      world.calmWind = tutorial.heldWind;
      const events = stepWorld(world, full, 0.1);
      tutorial.observe(full, 0.1);
      if (events.some((e) => e.type === 'crash' || e.type === 'reef-strike')) bumped = true;
    }
    expect(bumped).toBe(false);
    expect(world.boat.sinceBump).toBe(Infinity);
  });

  it('does not count coming alongside while she grinds on the reef', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const tutorial = new Tutorial(world, harboursOf(), null);
    toFoghorn(tutorial);
    const wreck = tutorial.wreck!;
    Object.assign(world.boat, { x: wreck.x + 12, y: wreck.y, speedKn: 0 });
    tutorial.observe();
    expect(tutorial.step).toBe('wreck');
    for (let n = 0; n < 20; n++) {
      world.boat.sinceBump = 0.1;
      tutorial.observe({ sailStep: 0, steer: 0 }, 0.5);
    }
    expect(tutorial.step).toBe('wreck');
    world.boat.sinceBump = Infinity;
    for (let n = 0; n < 7; n++) tutorial.observe({ sailStep: 0, steer: 0 }, 0.5);
    expect(tutorial.step).toBe('chart');
  });

  it('points the sea at the tracked quest when no course is set', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const harbours = harboursOf();
    const tutorial = new Tutorial(world, harbours, null);
    const quests = book(world, tutorial);
    tutorial.skip();
    world.trade.dockedAt = null;
    quests.check();
    expect(quests.tracked).toBe('rooks-thanks');
    expect(questGoal(quests, PHASE1_MAP, harbours)).toEqual({
      ...harbours.saltmere,
      label: 'Saltmere',
    });
  });
});

/** From the foghorn lesson to Rook aboard: alongside the wreck, slowly. */
function toChart(world: World, tutorial: Tutorial) {
  while (tutorial.step === 'sails' || tutorial.step === 'wind') tutorial.continueLesson();
  const wreck = tutorial.wreck!;
  Object.assign(world.boat, { x: wreck.x + 12, y: wreck.y, speedKn: 0, sinceBump: Infinity });
  tutorial.observe();
  for (let n = 0; n < 7; n++) tutorial.observe({ sailStep: 0, steer: 0 }, 0.5);
  expect(tutorial.step).toBe('chart');
}
