import { zlibSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { PHASE0_MAP, PHASE1_MAP } from '../src/data/maps';
import {
  type QuestDef,
  QUESTS,
  QuestBook,
  checkQuests,
  questsFor,
  readQuests,
} from '../src/sim/quests';
import {
  type SaveStorage,
  loadGame,
  saveGame,
  serializeWorld,
  validateSave,
} from '../src/sim/save';
import { packSave, unpackSave } from '../src/sim/saveCode';
import { toBase64Url } from '../src/sim/saveTransfer';
import { SLOOP } from '../src/sim/ship';
import { buy, capacity, cargoUsed, sell } from '../src/sim/trade';
import { TUTORIAL_QUEST } from '../src/sim/tutorial';
import { type World, createWorld } from '../src/sim/world';
import pier from './fixtures/quests/test-pier.json';
import after from './fixtures/quests/test-after.json';
import sailing from './fixtures/quests/test-sailing.json';

// Decision 0125: the quest engine, run on test quest files (no quest content ships yet).
const TEST_QUESTS = [pier, after] as unknown as QuestDef[];

class MemoryStorage implements SaveStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

/** Alongside `port` (as if docked there), with plenty of gold. */
function dock(world: World, port: string) {
  world.trade.dockedAt = port;
  world.trade.captain.gold = 10_000;
}

function book(world: World, tutorialDone = true, quests = TEST_QUESTS, night = false) {
  return new QuestBook(world, quests, {
    doneElsewhere: (id) => tutorialDone && id === TUTORIAL_QUEST.id,
    nightOk: () => night,
  });
}

const SAILING = [sailing] as unknown as QuestDef[];

/** Sail to (x, y) at `kn` knots and let `sec` seconds of checks go by there. */
function sailTo(world: World, quests: QuestBook, x: number, y: number, kn = 6, sec = 0.25) {
  world.boat.x = x;
  world.boat.y = y;
  world.boat.speedKn = kn;
  const events = [];
  for (let t = 0; t < sec - 1e-9; t += 0.25) events.push(...quests.check(0.25));
  return events;
}

describe('quest engine (decision 0125)', () => {
  it('the shipped quest files and the test files pass the checks', () => {
    expect(checkQuests(QUESTS, PHASE1_MAP, [TUTORIAL_QUEST.id])).toEqual([]);
    expect(checkQuests(TEST_QUESTS, PHASE1_MAP, [TUTORIAL_QUEST.id])).toEqual([]);
    expect(checkQuests(SAILING, PHASE1_MAP)).toEqual([]);
    // The tutorial stays on its own runner.
    expect(QUESTS.map((q) => q.id)).not.toContain(TUTORIAL_QUEST.id);
  });

  it('the checks catch unknown kinds, ids and unreachable or backward steps', () => {
    const bad = structuredClone(pier) as unknown as QuestDef;
    bad.start = { is: 'moon-phase' };
    bad.steps[0]!.goal = { is: 'delivered', port: 'atlantis', good: 'gold-bars', qty: 1.5 };
    bad.steps[1]!.next = 'timber';
    bad.steps[2]!.choose = [{ id: 'only' }];
    bad.steps[1]!.reward = { building: 'x' } as never;
    bad.reward = { gold: -1 };
    const problems = checkQuests([bad], PHASE1_MAP).join('\n');
    expect(problems).toContain('unknown condition "moon-phase"');
    expect(problems).toContain('no port "atlantis"');
    expect(problems).toContain('no good "gold-bars"');
    expect(problems).toContain('needs a whole number');
    expect(problems).toContain('not a later step');
    expect(problems).toContain('two options or more');
    expect(problems).toContain('unknown reward "building"');
    const startDelivered = structuredClone(after) as unknown as QuestDef;
    startDelivered.start = { is: 'delivered', port: 'saltmere', good: 'fish', qty: 1 };
    expect(checkQuests([startDelivered], PHASE1_MAP, ['test-pier']).join()).toContain(
      'only works in a step',
    );
    const skipped = structuredClone(pier) as unknown as QuestDef;
    skipped.steps[0]!.next = 'build';
    expect(checkQuests([skipped], PHASE1_MAP, ['first-voyage']).join()).toContain(
      'visit: no step leads here',
    );
  });

  it('starts on its condition, counts deliveries, pays rewards and waits for a choice', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const notYet = book(world, false);
    expect(notYet.check()).toEqual([]);
    const quests = book(world);
    expect(quests.check()).toEqual([
      { type: 'started', quest: 'test-pier' },
      { type: 'step', quest: 'test-pier', step: 'timber' },
    ]);
    dock(world, 'calda');
    expect(buy(world.trade, 'timber', 8).ok).toBe(true);
    quests.check();
    dock(world, 'saltmere');
    quests.check();
    // Selling and buying back does not count twice.
    expect(sell(world.trade, 'timber', 3, PHASE1_MAP).ok).toBe(true);
    quests.check();
    expect(quests.progress('test-pier')!.counts).toEqual([3]);
    expect(buy(world.trade, 'timber', 2).ok).toBe(true);
    quests.check();
    expect(quests.progress('test-pier')!.counts).toEqual([1]);
    expect(sell(world.trade, 'timber', 3, PHASE1_MAP).ok).toBe(true);
    quests.check();
    expect(quests.progress('test-pier')!.counts).toEqual([4]);
    const gold = world.trade.captain.gold;
    expect(sell(world.trade, 'timber', 4, PHASE1_MAP).ok).toBe(true);
    const sale = world.trade.captain.gold - gold;
    // Five delivered: the timber step pays, and alongside home the visit is done at once.
    expect(quests.check()).toEqual([
      { type: 'step', quest: 'test-pier', step: 'visit' },
      { type: 'choice', quest: 'test-pier', step: 'build' },
    ]);
    expect(world.trade.captain.gold - gold - sale).toBe(100);
    expect(quests.check()).toEqual([]);
    expect(quests.choose('test-pier', 'nonsense')).toEqual([]);
    expect(quests.isDone('test-pier')).toBe(false);
    expect(world.trade.progress.discovered).not.toContain('abbey-head');
    const before = world.trade.captain.gold;
    expect(quests.choose('test-pier', 'workshop')).toEqual([
      { type: 'finished', quest: 'test-pier' },
      { type: 'started', quest: 'test-after' },
      { type: 'step', quest: 'test-after', step: 'both' },
    ]);
    expect(world.trade.captain.gold - before).toBe(10);
    expect(world.trade.progress.standing.saltmere).toBe(2);
    expect(world.trade.progress.discovered).toContain('abbey-head');
    expect(quests.progress('test-pier')).toEqual({
      step: 'done',
      counts: [],
      chose: { build: 'workshop' },
    });
    expect(quests.active.map((a) => a.step.id)).toEqual(['both']);
  });

  it('a goal of several deliveries keeps one count each, only at its port', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.trade.quests.byId['test-pier'] = {
      step: 'done',
      counts: [],
      chose: { build: 'workshop' },
    };
    const quests = book(world);
    quests.check();
    world.trade.captain.cargo.fish = 5;
    world.trade.captain.cargo.stone = 5;
    dock(world, 'saltmere');
    quests.check();
    expect(sell(world.trade, 'fish', 1, PHASE1_MAP).ok).toBe(true);
    quests.check();
    expect(quests.progress('test-after')!.counts).toEqual([0, 0]);
    dock(world, 'westholm');
    quests.check();
    sell(world.trade, 'fish', 4, PHASE1_MAP);
    quests.check();
    expect(quests.progress('test-after')!.counts).toEqual([3, 0]);
    world.trade.captain.cargo.grain = 1;
    sell(world.trade, 'stone', 2, PHASE1_MAP);
    // Both delivered, but grain aboard: the `not` holds it back.
    expect(quests.check()).toEqual([]);
    world.trade.captain.cargo.grain = 0;
    expect(quests.check()).toEqual([{ type: 'finished', quest: 'test-after' }]);
  });

  it('progress is saved with the voyage and checked on load', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const quests = book(world);
    quests.check();
    world.trade.quests.byId['test-pier']!.counts = [2];
    const storage = new MemoryStorage();
    expect(saveGame(storage, world)).toBe(true);
    const resumed = createWorld(PHASE1_MAP, SLOOP);
    expect(loadGame(storage, resumed)).toBe(true);
    // The game's own quest list has none of the test quests, so loading drops them.
    expect(resumed.trade.quests.byId).toEqual({});
    const read = readQuests(serializeWorld(world).quests, PHASE1_MAP, TEST_QUESTS);
    expect(read.byId['test-pier']).toEqual({ step: 'timber', counts: [2], chose: {} });
    // Unknown quests or steps, bad counts and options drop that quest only.
    const raw = {
      byId: {
        'test-pier': { step: 'gone', counts: [], chose: {} },
        'test-after': { step: 'both', counts: [1, 1], chose: {} },
        other: { step: 'x', counts: [], chose: {} },
      },
    };
    expect(readQuests(raw, PHASE1_MAP, TEST_QUESTS).byId).toEqual({
      'test-after': { step: 'both', counts: [1, 1], chose: {} },
    });
    raw.byId['test-after'].counts = [1];
    expect(readQuests(raw, PHASE1_MAP, TEST_QUESTS).byId).toEqual({});
    expect(
      readQuests(
        { byId: { 'test-pier': { step: 'done', counts: [], chose: { build: 'castle' } } } },
        PHASE1_MAP,
        TEST_QUESTS,
      ).byId,
    ).toEqual({});
    // An old save without quests reads as none started.
    const old = serializeWorld(world) as Partial<ReturnType<typeof serializeWorld>>;
    delete old.quests;
    expect(validateSave(old, world)!.quests).toEqual({ byId: {} });
  });

  it('a quest whose ports are not on the map does not run there', () => {
    expect(questsFor(PHASE1_MAP, TEST_QUESTS).map((q) => q.id)).toEqual([
      'test-pier',
      'test-after',
    ]);
    // The first test sea has no Abbey Head.
    expect(questsFor(PHASE0_MAP, TEST_QUESTS).map((q) => q.id)).toEqual(['test-after']);
  });

  it('quest cargo takes hold space, cannot be sold, and goes in as many trips as it takes', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const quests = book(world, true, SAILING);
    quests.check();
    expect(quests.tracked).toBe('test-sailing');
    world.trade.captain.cargo.fish = 5;
    dock(world, 'stonehaven');
    quests.check();
    // Ten spaces, five of fish: one millstone of four fits.
    expect(quests.progress('test-sailing')!.counts).toEqual([1, 0]);
    expect(cargoUsed(world.trade)).toBe(9);
    expect(quests.check()).toEqual([]);
    expect(quests.progress('test-sailing')!.counts).toEqual([1, 0]);
    dock(world, 'westholm');
    quests.check();
    expect(quests.progress('test-sailing')!.counts).toEqual([0, 1]);
    expect(cargoUsed(world.trade)).toBe(5);
    world.trade.captain.cargo.fish = 0;
    dock(world, 'stonehaven');
    quests.check();
    expect(cargoUsed(world.trade)).toBe(4);
    expect(capacity(world.trade)).toBe(10);
    // Saved with it aboard, the room is still taken on the other side.
    const resumed = createWorld(PHASE1_MAP, SLOOP);
    resumed.trade.quests = readQuests(serializeWorld(world).quests, PHASE1_MAP, SAILING);
    expect(cargoUsed(resumed.trade)).toBe(4);
    dock(world, 'westholm');
    expect(quests.check()).toEqual([{ type: 'step', quest: 'test-sailing', step: 'sound' }]);
    expect(cargoUsed(world.trade)).toBe(0);
  });

  it('a passenger (quest cargo of no space) comes aboard with a full hold', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const rescue = {
      id: 'test-rescue',
      name: 'Test: a passenger',
      start: { is: 'always' },
      text: 'quest.test-rescue',
      items: { harbourmaster: { space: 0 } },
      steps: [
        {
          id: 'home',
          compass: { x: 10, y: 10 },
          goal: { is: 'carried', item: 'harbourmaster', qty: 1, from: 'calda', to: 'saltmere' },
        },
      ],
    } as unknown as QuestDef;
    expect(checkQuests([rescue], PHASE1_MAP)).toEqual([]);
    const quests = book(world, true, [rescue]);
    quests.check();
    world.trade.captain.cargo.timber = capacity(world.trade);
    dock(world, 'calda');
    quests.check();
    expect(quests.progress('test-rescue')!.counts).toEqual([1, 0]);
    expect(cargoUsed(world.trade)).toBe(capacity(world.trade));
    dock(world, 'saltmere');
    expect(quests.check()).toEqual([{ type: 'finished', quest: 'test-rescue' }]);
  });

  it('markers in any order or in order, a slow hold, and a reef hit starts a clean step over', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.trade.quests.byId['test-sailing'] = { step: 'sound', counts: [0, 0], chose: {} };
    const quests = book(world, true, SAILING);
    world.boat.x = 200;
    world.boat.y = 5;
    quests.check();
    sailTo(world, quests, 500, 500);
    sailTo(world, quests, 0, 10);
    expect(quests.progress('test-sailing')!.counts[0]).toBe(0b101);
    // Touching the reef: the step starts over, nothing else is lost.
    world.trade.captain.hullDamage.sloop = 3;
    expect(quests.check()).toEqual([{ type: 'reset', quest: 'test-sailing', step: 'sound' }]);
    expect(quests.progress('test-sailing')!.counts).toEqual([0, 0]);
    sailTo(world, quests, 200, 300);
    sailTo(world, quests, 200, 0);
    expect(quests.progress('test-sailing')!.counts[0]).toBe(0b101);
    // Passed between two checks: the marker still counts.
    expect(sailTo(world, quests, 60, 0)).toEqual([
      { type: 'step', quest: 'test-sailing', step: 'gates' },
    ]);
    sailTo(world, quests, 100, 100);
    expect(quests.progress('test-sailing')!.counts[0]).toBe(0);
    sailTo(world, quests, 0, 100);
    expect(sailTo(world, quests, 100, 100)).toEqual([
      { type: 'step', quest: 'test-sailing', step: 'wreck' },
    ]);
    // Too fast, then slow but not for long enough, then five seconds alongside under 2 kn.
    sailTo(world, quests, 50, 45, 4, 10);
    sailTo(world, quests, 50, 45, 1, 3);
    sailTo(world, quests, 80, 80, 1, 1);
    expect(quests.progress('test-sailing')!.step).toBe('wreck');
    expect(sailTo(world, quests, 52, 50, 1.5, 5)).toEqual([
      { type: 'step', quest: 'test-sailing', step: 'trial' },
    ]);
  });

  it('a timed run starts leaving its port, has a par per level and can be tried again', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.trade.quests.byId['test-sailing'] = { step: 'trial', counts: [0, 0, 0], chose: {} };
    const quests = book(world, true, SAILING);
    quests.check();
    dock(world, 'calda');
    quests.check();
    world.trade.dockedAt = null;
    quests.check(0.25);
    expect(quests.progress('test-sailing')!.counts[0]).toBe(1);
    sailTo(world, quests, 300, 300);
    // Captain's par is 200 s: too slow.
    sailTo(world, quests, 500, 500, 6, 200);
    expect(quests.progress('test-sailing')!.counts).toEqual([0, 0, 0]);
    // Again, in time.
    dock(world, 'calda');
    quests.check();
    world.trade.dockedAt = null;
    quests.check(0.25);
    sailTo(world, quests, 300, 300, 6, 60);
    world.trade.dockedAt = 'calda';
    expect(quests.check(0.25)).toEqual([{ type: 'step', quest: 'test-sailing', step: 'light' }]);
  });

  it('a night step waits for night (or night switched off) and the reward puts a town up a level', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.trade.quests.byId['test-sailing'] = { step: 'light', counts: [0, 0], chose: {} };
    const day = book(world, true, SAILING, false);
    day.check();
    sailTo(world, day, -50, -50);
    expect(day.progress('test-sailing')!.step).toBe('light');
    const night = book(world, true, SAILING, true);
    night.check();
    const level = world.trade.settlements.byPort.westholm!.level;
    expect(sailTo(world, night, -45, -50)).toEqual([{ type: 'finished', quest: 'test-sailing' }]);
    expect(world.trade.settlements.byPort.westholm!.level).toBe(level + 1);
    expect(world.trade.quests.tracked).toBeUndefined();
  });

  it('an offered quest waits for the player\'s yes; "Not now" keeps it offered', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const offered = { ...structuredClone(after), offer: true } as unknown as QuestDef;
    world.trade.quests.byId['test-pier'] = {
      step: 'done',
      counts: [],
      chose: { build: 'workshop' },
    };
    const quests = book(world, true, [...TEST_QUESTS.slice(0, 1), offered]);
    expect(quests.check()).toEqual([{ type: 'offered', quest: 'test-after' }]);
    expect(quests.check()).toEqual([]);
    expect(quests.offered.map((q) => q.id)).toEqual(['test-after']);
    expect(quests.progress('test-after')).toBeUndefined();
    expect(quests.accept('test-after')).toEqual([
      { type: 'started', quest: 'test-after' },
      { type: 'step', quest: 'test-after', step: 'both' },
    ]);
    expect(quests.offered).toEqual([]);
    expect(quests.tracked).toBe('test-after');
  });

  it('one quest is tracked at a time', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const quests = book(world, true, [...TEST_QUESTS, ...SAILING]);
    quests.check();
    expect(quests.active.map((a) => a.quest.id)).toEqual(['test-pier', 'test-sailing']);
    expect(quests.tracked).toBe('test-pier');
    expect(quests.track('test-after')).toBe(false);
    expect(quests.track('test-sailing')).toBe(true);
    expect(readQuests(world.trade.quests, PHASE1_MAP, [...TEST_QUESTS, ...SAILING]).tracked).toBe(
      'test-sailing',
    );
  });

  it('runs a few times a second, not every step', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const quests = book(world);
    expect(quests.update(1 / 60)).toEqual([]);
    let events = 0;
    for (let i = 0; i < 20; i++) events += quests.update(1 / 60).length;
    expect(events).toBe(2);
  });
});

describe('quests in the save code (decisions 0118, 0125)', () => {
  const played = () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const quests = book(world);
    quests.check();
    world.trade.quests.byId['test-pier']!.counts = [4];
    return world;
  };

  it('a code without quest progress is what it was before', () => {
    const save = serializeWorld(createWorld(PHASE1_MAP, SLOOP));
    const none = { ...save };
    delete none.quests;
    expect(packSave(save, PHASE1_MAP, TEST_QUESTS)).toEqual(
      packSave(none, PHASE1_MAP, TEST_QUESTS),
    );
    expect(packSave(save, PHASE1_MAP, TEST_QUESTS)).toEqual(packSave(save, PHASE1_MAP, []));
  });

  it('carries quest progress, and refuses a code made with other quest files', () => {
    const world = played();
    const save = serializeWorld(world);
    const bytes = packSave(save, PHASE1_MAP, TEST_QUESTS);
    const read = unpackSave(bytes, PHASE1_MAP, save.version, TEST_QUESTS);
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.raw.quests).toEqual(save.quests);
    const done = structuredClone(save);
    done.quests = {
      byId: {
        'test-pier': { step: 'done', counts: [], chose: { build: 'rigging-loft' } },
        'test-after': { step: 'both', counts: [3, 1], chose: {} },
      },
    };
    const back = unpackSave(packSave(done, PHASE1_MAP, TEST_QUESTS), PHASE1_MAP, 1, TEST_QUESTS);
    expect(back.ok && back.raw.quests).toEqual(done.quests);
    const renamed = structuredClone(TEST_QUESTS);
    renamed[0]!.steps[0]!.id = 'wood';
    expect(unpackSave(bytes, PHASE1_MAP, save.version, renamed)).toEqual({
      ok: false,
      problem: 'otherVersion',
    });
  });

  it('four arcs of three steps add only a few characters', () => {
    // A guess at the arcs of decision 0120: four quests, a delivery, a visit and a choice each.
    const arcs = ['a', 'b', 'c', 'd'].map((n) => {
      const q = structuredClone(pier) as unknown as QuestDef;
      q.id = `arc-${n}`;
      return q;
    });
    const save = serializeWorld(played());
    const plain = packSave({ ...save, quests: { byId: {} } }, PHASE1_MAP, arcs);
    save.quests = {
      byId: {
        'arc-a': { step: 'done', counts: [], chose: { build: 'workshop' } },
        'arc-b': { step: 'done', counts: [], chose: { build: 'rigging-loft' } },
        'arc-c': { step: 'timber', counts: [4], chose: {} },
      },
    };
    const packed = packSave(save, PHASE1_MAP, arcs);
    const chars = (b: Uint8Array) => toBase64Url(zlibSync(b, { level: 9 })).length;
    console.log(
      `quests add ${packed.length - plain.length} bytes, ${chars(packed) - chars(plain)} chars`,
    );
    expect(packed.length - plain.length).toBeLessThanOrEqual(12);
    expect(chars(packed) - chars(plain)).toBeLessThanOrEqual(20);
  });
});
