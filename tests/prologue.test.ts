import { describe, expect, it } from 'vitest';
import { PHASE0_MAP, PHASE1_MAP } from '../src/data/maps';
import { QUESTS, QuestBook, type QuestDef, checkQuests } from '../src/sim/quests';
import { checkStepEffects, heldWind } from '../src/sim/stepEffects';
import { landmarkSpot } from '../src/sim/landmarks';
import { pointOf } from '../src/sim/questLibrary';
import { SLOOP } from '../src/sim/ship';
import { DEG } from '../src/sim/math';
import { cardFor, questGoal, questTarget, trackedMarkers } from '../src/ui/questView';
import { createWorld, startAtPrologue, stepWorld } from '../src/sim/world';
import { TUTORIAL, tutorialVoyage } from './helpers/tutorial';

// Decision 0127: the tutorial is the prologue rescue, and Rook's thanks is the island. Since 0151 it
// runs as an ordinary quest.

const TUTORIAL_QUEST = QUESTS.find((q) => q.id === TUTORIAL)!;

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
    // The quest names it by word; each map puts it (decision 0151).
    expect(pointOf(PHASE1_MAP, 'wreck')).toEqual(wreck);
    expect(pointOf(PHASE0_MAP, 'wreck')).toBeNull();
  });

  it('marks the wreck on the compass and only counts a slow, clean approach', () => {
    const v = tutorialVoyage();
    v.start();
    expect(v.quests.compassOf(v.quests.trackedStep)).toBeNull();
    v.cont();
    v.cont();
    expect(v.step).toBe('foghorn');
    const wreck = v.wreck!;
    expect(v.quests.compassOf(v.quests.trackedStep)).toEqual(wreck);
    // The wreck's ring and beam, like any quest's place at sea (decision 0139).
    expect(trackedMarkers(v.quests)!.points[0]).toMatchObject({ x: wreck.x, y: wreck.y });
    Object.assign(v.world.boat, { x: wreck.x + 60, y: wreck.y });
    v.check(0.25);
    expect(v.step).toBe('foghorn');
    Object.assign(v.world.boat, { x: wreck.x + 30, y: wreck.y });
    v.check(0.25);
    expect(v.step).toBe('wreck');
    // Too fast alongside: nothing.
    Object.assign(v.world.boat, { x: wreck.x + 10, y: wreck.y, speedKn: 4 });
    for (let n = 0; n < 10; n++) v.check(0.5);
    expect(v.step).toBe('wreck');
    // Slow, but touching the reef starts the hold again.
    v.world.boat.speedKn = 1;
    for (let n = 0; n < 5; n++) v.check(0.5);
    const ship = v.world.trade.captain.activeShip;
    v.world.trade.captain.hullDamage[ship] = (v.world.trade.captain.hullDamage[ship] ?? 0) + 1;
    v.check(0.5);
    for (let n = 0; n < 5; n++) v.check(0.5);
    expect(v.step).toBe('wreck');
    v.check(0.5);
    // Rook speaks on his card (decision 0185), then the chart lesson.
    expect(v.step).toBe('aboard');
    v.cont('welcome');
    expect(v.step).toBe('chart');
    expect(v.quests.compassOf(v.quests.trackedStep)).toBeNull();
    expect(v.vars.origin).toBe('saltmere');
  });

  it('skips the sea lessons on a map without a prologue', () => {
    const v = tutorialVoyage(PHASE0_MAP);
    v.start();
    v.cont();
    v.cont();
    expect(v.wreck).toBeNull();
    expect(v.step).toBe('aboard');
    v.cont('welcome');
    expect(v.step).toBe('chart');
    expect(v.vars.origin).toBeTruthy();
  });
});

describe("Rook's thanks: the island (decision 0127)", () => {
  it('ends on the dock that brings Rook home, during the tutorial', () => {
    const v = tutorialVoyage();
    v.toFoghorn();
    expect(v.quests.progress('rooks-thanks')).toBeUndefined();
    v.rescue();
    v.course('saltmere');
    expect(v.step).toBe('home');
    expect(v.world.trade.home.islands.skerry?.owned ?? false).toBe(false);
    v.dock('saltmere');
    // Rook thanks her on the quay (decision 0190), then the island lesson.
    expect(v.step).toBe('thanks');
    v.cont();
    expect(v.step).toBe('island');
    expect(v.quests.isAt(TUTORIAL, 'island')).toBe(true);
    v.check();
    // The island is hers at once; Rook's last step sends her to see it (decision 0159), in the
    // words of the man she pulled off the reef (decision 0190).
    expect(v.quests.progress('rooks-thanks')?.step).toBe('skerry');
    expect(v.world.trade.home.islands.skerry?.owned ?? false).toBe(true);
    // The lesson stays the tracked quest.
    expect(v.quests.tracked).toBe(TUTORIAL);
  });

  it('ends when she first moors at Skerry, where Rook explains the plots (decision 0159)', () => {
    const v = tutorialVoyage();
    v.skip();
    v.dock('saltmere');
    expect(v.quests.isAt('rooks-thanks', 'skerry')).toBe(true);
    // No rescue on this voyage: Rook offers Skerry as to a stranger (decision 0190), at once.
    expect(v.quests.progress('rooks-thanks')?.step).toBe('skerry-stranger');
    // Its card counts as the step it stands in for: 2 of 3.
    const card = cardFor(v.quests, PHASE1_MAP, 'rooks-thanks', 'step')!;
    expect([card.stepNo, card.steps]).toEqual([2, 3]);
    expect(card.speech).toContain('I hear you handle a boat well');
    expect(questTarget(v.quests, PHASE1_MAP)).toEqual({ point: { x: -60, y: -150 } });
    // The arcs open as soon as the island is hers, not only once she has seen it.
    expect(v.quests.offered.map((q) => q.id)).toContain('saltmere-shoals');
    v.world.trade.dockedAt = null;
    v.world.trade.home.docked = 'skerry';
    v.check();
    // Two cards one after the other (Guillaume, 0159): the plots, then what the buildings do.
    expect(v.quests.progress('rooks-thanks')?.step).toBe('plots');
    v.quests.choose('rooks-thanks', 'continue');
    expect(v.quests.isDone('rooks-thanks')).toBe(true);
  });

  it('waits for the next Saltmere dock when the tutorial is skipped', () => {
    const v = tutorialVoyage();
    v.start();
    v.world.trade.dockedAt = null;
    v.check();
    expect(v.quests.progress('rooks-thanks')).toBeUndefined();
    v.skip();
    v.check();
    expect(v.quests.isAt('rooks-thanks', 'home')).toBe(true);
    expect(v.quests.isDone('rooks-thanks')).toBe(false);
    v.dock('calda');
    expect(v.quests.isAt('rooks-thanks', 'skerry')).toBe(false);
    v.dock('saltmere');
    expect(v.quests.isAt('rooks-thanks', 'skerry')).toBe(true);
    expect(v.world.trade.home.islands.skerry?.owned ?? false).toBe(true);
  });

  it('reaches a voyage that never saw the tutorial', () => {
    const v = tutorialVoyage();
    v.world.trade.dockedAt = null;
    v.check();
    expect(v.quests.isAt('rooks-thanks', 'home')).toBe(true);
  });
});

describe('a gentler prologue (decision 0139)', () => {
  it('holds a light, steady breeze until Rook is home, then gives the sea its wind back', () => {
    const v = tutorialVoyage();
    const { world } = v;
    startAtPrologue(world);
    v.start();
    // As the game does: the tracked step's `wind` is held before every step.
    const sail = (seconds: number) => {
      for (let n = 0; n < seconds * 10; n++) {
        world.calmWind = heldWind(v.quests.trackedStep?.wind, world.map);
        stepWorld(world, { sailStep: 0, steer: 0 }, 0.1);
        v.quests.update(0.1, { sailStep: 0, steer: 0 });
      }
    };
    sail(60);
    expect(world.seaWind.speedKn).toBe(TUTORIAL_QUEST.steps[0]!.wind!.speedKn);
    expect(world.seaWind.from).toBeCloseTo(PHASE1_MAP.wind.fromDeg * DEG);
    // Still calm while taking Rook home; the trading lessons sail in the sea's own wind.
    v.rescue();
    v.course('saltmere');
    expect(v.step).toBe('home');
    expect(v.quests.trackedStep?.wind).toBeDefined();
    v.dock('saltmere');
    expect(v.step).toBe('thanks');
    expect(v.quests.trackedStep?.wind).toBeUndefined();
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
    const v = tutorialVoyage();
    const { world } = v;
    startAtPrologue(world);
    v.start();
    const wreck = v.wreck!;
    const { start } = PHASE1_MAP.prologue!;
    expect(Math.hypot(start.x - wreck.x, start.y - wreck.y)).toBeGreaterThan(150);
    const full = { sailStep: 2, steer: 0 };
    let bumped = false;
    for (let n = 0; n < 600; n++) {
      world.calmWind = heldWind(v.quests.trackedStep?.wind, world.map);
      const events = stepWorld(world, full, 0.1);
      v.quests.update(0.1, full);
      if (events.some((e) => e.type === 'crash' || e.type === 'reef-strike')) bumped = true;
    }
    expect(bumped).toBe(false);
    expect(world.boat.sinceBump).toBe(Infinity);
  });

  it('does not count coming alongside while she grinds on the reef', () => {
    const v = tutorialVoyage();
    v.toFoghorn();
    const wreck = v.wreck!;
    Object.assign(v.world.boat, { x: wreck.x + 12, y: wreck.y, speedKn: 0 });
    v.check(0.25);
    expect(v.step).toBe('wreck');
    for (let n = 0; n < 20; n++) {
      v.world.boat.sinceBump = 0.1;
      v.check(0.5);
    }
    expect(v.step).toBe('wreck');
    v.world.boat.sinceBump = Infinity;
    for (let n = 0; n < 7; n++) v.check(0.5);
    expect(v.step).toBe('aboard');
  });

  it('points the sea at the tracked quest when no course is set, the lesson too', () => {
    const v = tutorialVoyage();
    v.world.trade.dockedAt = null;
    v.check();
    expect(v.quests.tracked).toBe('rooks-thanks');
    expect(questGoal(v.quests, PHASE1_MAP, v.harbours)).toEqual({
      ...v.harbours.saltmere,
      label: 'Saltmere',
    });
    // A running lesson takes the sea: the foghorn, by its ask.
    v.toFoghorn();
    expect(v.quests.tracked).toBe(TUTORIAL);
    expect(questGoal(v.quests, PHASE1_MAP, v.harbours)).toMatchObject({
      ...v.wreck,
      label: 'A foghorn',
    });
    expect(v.quests.track('rooks-thanks')).toBe(false);
  });
});
