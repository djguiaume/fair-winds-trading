import { describe, expect, it } from 'vitest';
import { PHASE1_MAP, PHASE1_SOURCE, prepareMap } from '../src/data/maps';
import {
  ISLAND_DESIGNS,
  type IslandDesign,
  islandDesign,
  questApart,
  questDesign,
  questShown,
} from '../src/data/islands';
import type { MapDef } from '../src/sim/map';
import { clearAt, quickChecks } from '../src/sim/mapChecks';
import { landmarkSpot } from '../src/sim/landmarks';
import { type QuestDef, QUESTS, QuestBook, checkQuestHooks, checkQuests } from '../src/sim/quests';
import { madeGoods, portNow, producesAt } from '../src/sim/settlement';
import { SLOOP, SHIP_CLASSES } from '../src/sim/ship';
import { checkIsland } from '../src/sim/islandChecks';
import { TUTORIAL_QUEST } from '../src/sim/tutorial';
import { createWorld } from '../src/sim/world';
import { islandCheckKit } from '../src/render/models/towns';
import { stepMarkers } from '../src/ui/questView';
import { stressMap } from '../src/data/stressMap';
import pier from './fixtures/quests/test-pier.json';

// Decision 0130: what waits on a quest (props, sea marks, a port's trade), the East Reef's gap
// and the step's places drawn at sea.

const PIER = pier as unknown as QuestDef;

/** The shipped map, with Saltmere making smoked fish from level 2 once test-pier is done. */
function hookedMap(): MapDef {
  const source = structuredClone(PHASE1_SOURCE);
  const saltmere = source.ports.find((p) => p.id === 'saltmere')!;
  saltmere.afterQuest = { 'test-pier': { levelProduces: { '2': ['smokedFish'] } } };
  source.marks = [
    { type: 'buoy-red', x: 134, y: 51, tags: ['after:test-pier'], chart: true },
    { type: 'light', x: -226, y: -80, tags: ['after:test-pier'], chart: true },
  ];
  return prepareMap(source);
}

describe('after:/before: tags', () => {
  const done = new Set(['a']);
  it('show a prop after its quest and hide one before it', () => {
    expect(questShown({ tags: ['after:a'] }, done)).toBe(true);
    expect(questShown({ tags: ['after:b'] }, done)).toBe(false);
    expect(questShown({ tags: ['before:a'] }, done)).toBe(false);
    expect(questShown({ tags: ['before:b', 'windmill'] }, done)).toBe(true);
    expect(questShown({}, done)).toBe(true);
  });

  it('filter an island file, and never put a before/after pair together', () => {
    const design = structuredClone(islandDesign('calda')) as IslandDesign;
    const slip = design.props.findIndex((p) => p.type === 'slipway');
    const base = design.props[slip]!;
    design.props.push({ ...base, type: 'slipway-hull', tags: ['after:q'] });
    design.props[slip] = { ...base, tags: ['before:q'] };
    const before = questDesign(design, new Set());
    const after = questDesign(design, new Set(['q']));
    const hull = design.props.at(-1)!;
    expect(before.props.includes(hull)).toBe(false);
    expect(after.props.includes(hull)).toBe(true);
    expect(before.props.includes(design.props[slip]!)).toBe(true);
    expect(after.props.includes(design.props[slip]!)).toBe(false);
    expect(questApart(design.props[slip]!, hull)).toBe(true);
    // An untagged file is the same object: nothing to rebuild.
    expect(questDesign(islandDesign('saltmere'), new Set())).toBe(islandDesign('saltmere'));
    // A building and its replacement on one spot: the island checks know they never stand together.
    const R = 26 / 2.2;
    const shed = design.props.findIndex((p) => p.type === 'cutting-shed');
    const overlaps = (d: IslandDesign) =>
      checkIsland(d, { ...islandCheckKit(d, R), triangles: undefined }).filter(
        (i) => i.check === 'overlap',
      ).length;
    const clean = overlaps(design);
    const twin = structuredClone(design);
    twin.props.push({ ...twin.props[shed]!, type: 'lumber-store' });
    expect(overlaps(twin)).toBeGreaterThan(clean);
    twin.props[shed]!.tags = ['before:q'];
    twin.props.at(-1)!.tags = ['after:q'];
    expect(overlaps(twin)).toBe(clean);
  });

  it('only name quests there are, and a moored boat cannot wait on one', () => {
    const map = hookedMap();
    expect(checkQuestHooks(map, Object.values(ISLAND_DESIGNS), [PIER, ...QUESTS])).toEqual([]);
    expect(checkQuestHooks(map, [], [])).toEqual([
      'map › mark 0 (buoy-red): no quest "test-pier"',
      'map › mark 1 (light): no quest "test-pier"',
      'port saltmere › afterQuest: no quest "test-pier"',
    ]);
    const design = structuredClone(islandDesign('saltmere'));
    const boat = design.props.findIndex((p) => p.type === 'moored-boat');
    design.props[boat]!.tags = ['after:test-pier'];
    expect(checkQuestHooks(PHASE1_MAP, [design], [PIER, ...QUESTS])).toEqual([
      `island saltmere › prop ${boat} (moored-boat): a moored boat cannot wait on a quest (use a sea mark)`,
    ]);
  });

  it('the shipped quests, islands and map hold together', () => {
    expect(
      checkQuestHooks(PHASE1_MAP, Object.values(ISLAND_DESIGNS), QUESTS, [TUTORIAL_QUEST.id]),
    ).toEqual([]);
    expect(checkQuests(QUESTS, PHASE1_MAP, [TUTORIAL_QUEST.id])).toEqual([]);
  });
});

describe('a port that trades differently after a quest', () => {
  it('makes its specialty a level earlier once the quest is done, and its market follows', () => {
    const map = hookedMap();
    const world = createWorld(map, SLOOP);
    const trade = world.trade;
    const saltmere = map.ports.find((p) => p.id === 'saltmere')!;
    expect(producesAt(map, trade, 'saltmere')).toEqual(['fish']);
    expect(trade.markets.saltmere!.equilibrium.smokedFish).toBe(0);
    const book = new QuestBook(world, [PIER], { doneElsewhere: () => true });
    trade.quests.byId['test-pier'] = { step: 'build', counts: [], chose: {} };
    const events = book.choose('test-pier', 'workshop');
    expect(events.some((e) => e.type === 'finished')).toBe(true);
    expect(portNow(saltmere, trade).levelProduces).toEqual({ '2': ['smokedFish'] });
    expect(producesAt(map, trade, 'saltmere')).toEqual(['fish', 'smokedFish']);
    expect(madeGoods(map, trade).has('smokedFish')).toBe(true);
    expect(trade.markets.saltmere!.equilibrium.smokedFish).toBeGreaterThan(0);
    // The map itself is untouched: another voyage still waits for its own quest.
    expect(saltmere.levelProduces).toEqual({ '3': ['smokedFish'] });
  });

  it('counts for the map checks, and sea marks must stand in clear water', () => {
    const map = hookedMap();
    expect(quickChecks(map).filter((c) => !c.ok)).toEqual([]);
    map.marks!.push({ type: 'fishing-boat', x: 285, y: -140 });
    const marks = quickChecks(map).find((c) => c.id === 'marks')!;
    expect(marks).toMatchObject({ ok: false, severity: 'warning' });
    expect(marks.message).toBe('mark 2 (fishing-boat) on land or a reef');
  });

  it('sea marks and pinned landmarks move with the stress copies', () => {
    const stress = stressMap(hookedMap());
    expect(stress.marks!.length).toBeGreaterThan(2);
    const reefs = stress.terrain!.filter((t) => t.id.startsWith('east-reef') && t.look?.landmarkAt);
    for (const reef of reefs) {
      const spot = landmarkSpot(stress, reef.id)!;
      expect(clearAt(stress, spot.x, spot.y, 0)).toBe(false);
    }
  });
});

describe('the East Reef gap', () => {
  const reef = PHASE1_MAP.terrain!.find((t) => t.id === 'east-reef')!;

  it('keeps the prologue wreck where it was, on the reef', () => {
    // Where the seeded wreck stood before the reef was split (decision 0127).
    expect(landmarkSpot(PHASE1_MAP, 'east-reef')).toEqual({ x: 151.48, y: 46.33 });
    expect(reef.look?.landmark).toBe('wreck');
    expect(clearAt(PHASE1_MAP, 151.48, 46.33, 0)).toBe(false);
  });

  it('opens a channel at the north-west end that every ship fits through', () => {
    // Across the gap, from the inner side (south-west) to the outer side (north-east).
    const from = { x: 119.2, y: 52.6 };
    const to = { x: 148.8, y: 79.4 };
    const widest = Math.max(...Object.values(SHIP_CLASSES).map((s) => s.radius));
    for (let i = 0; i <= 20; i++) {
      const x = from.x + ((to.x - from.x) * i) / 20;
      const y = from.y + ((to.y - from.y) * i) / 20;
      expect(clearAt(PHASE1_MAP, x, y, widest)).toBe(true);
    }
    // And it is a gap: the reef stands on either side of the middle gate.
    const across = { x: -0.671, y: 0.741 };
    for (const side of [-1, 1])
      expect(clearAt(PHASE1_MAP, 134 + side * 22 * across.x, 66 + side * 22 * across.y, 0)).toBe(
        false,
      );
  });
});

describe('step markers', () => {
  const reach = {
    is: 'reach',
    points: [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { x: 5, y: 6 },
    ],
    within: 9,
  };

  it('mark reach points, in any order or the next gate in order', () => {
    expect(stepMarkers(reach, [0b010, 0]).map((m) => [m.reached, m.next])).toEqual([
      [false, true],
      [true, false],
      [false, true],
    ]);
    const gates = { ...reach, order: 'in-order' };
    expect(stepMarkers(gates, [1, 0]).map((m) => [m.reached, m.next])).toEqual([
      [true, false],
      [false, true],
      [false, false],
    ]);
    expect(stepMarkers(gates, [1, 0])[0]).toMatchObject({ x: 1, y: 2, within: 9 });
  });

  it("mark a timed run's via points and quest cargo's spot at sea, inside all/any", () => {
    const spot = { x: 10, y: 20, within: 6, maxKn: 2, holdSec: 3 };
    const goal = {
      is: 'all',
      of: [
        { is: 'carried', item: 'mast', qty: 1, from: spot, to: 'calda' },
        { is: 'timed', from: 'saltmere', via: [{ x: 7, y: 8 }], par: 100 },
      ],
    };
    // carried: aboard, delivered, hold; timed: state, clock, via passed.
    expect(stepMarkers(goal, [0, 0, 0, 0, 0, 0])).toEqual([
      { x: 10, y: 20, within: 6, reached: false, next: true },
      { x: 7, y: 8, within: 15, reached: false, next: true },
    ]);
    // Loaded: Calda is a port, so only the run's mark is left.
    expect(stepMarkers(goal, [1, 0, 0, 1, 500, 1])).toEqual([
      { x: 7, y: 8, within: 15, reached: true, next: false },
    ]);
    expect(stepMarkers({ is: 'docked', port: 'saltmere' }, [])).toEqual([]);
  });
});
