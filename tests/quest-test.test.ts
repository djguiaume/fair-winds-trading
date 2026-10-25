import { describe, expect, it } from 'vitest';
import { editedQuests, memoryStorage } from '../src/data/editedMap';
import { PHASE1_MAP } from '../src/data/maps';
import { playUrl, seaStart, stepPort } from '../src/editor/quest/doc';
import { clearAt } from '../src/sim/mapChecks';
import { type QuestDef, QUESTS, QuestBook, routeTo } from '../src/sim/quests';
import { questTestFrom, sailableHeading, testBerth } from '../src/sim/questTest';
import { SLOOP } from '../src/sim/ship';
import { tryDock } from '../src/sim/trade';
import { createWorld } from '../src/sim/world';
import pier from './fixtures/quests/test-pier.json';
import after from './fixtures/quests/test-after.json';

/** Play a quest from one of its steps (decision 0142, part 2). */

const TEST_QUESTS = [pier, after] as unknown as QuestDef[];
const book = (quests: readonly QuestDef[] = TEST_QUESTS) => {
  const world = createWorld(PHASE1_MAP, SLOOP);
  world.trade.captain.gold = 0;
  return {
    world,
    quests: new QuestBook(world, quests, { doneElsewhere: (id) => id === 'first-voyage' }),
  };
};

const fork = {
  id: 'fork',
  name: 'Fork',
  start: { is: 'always' },
  text: 'quest.fork',
  steps: [
    {
      id: 'ask',
      choose: [
        { id: 'left', next: 'l' },
        { id: 'right', next: 'r' },
      ],
    },
    { id: 'l', goal: { is: 'gold', atLeast: 1 }, next: 'done', reward: { gold: 1 } },
    { id: 'r', goal: { is: 'gold', atLeast: 1 }, reward: { gold: 2 } },
  ],
} as unknown as QuestDef;

describe('play a quest from a step (decision 0142)', () => {
  it('finds the steps leading to a step or to the end, through a named option', () => {
    const ids = (route: ReturnType<typeof routeTo>) =>
      route?.map((r) => `${r.step.id}${r.option ? `:${r.option.id}` : ''}`);
    expect(ids(routeTo(fork, 'ask'))).toEqual([]);
    expect(ids(routeTo(fork, 'r'))).toEqual(['ask:right']);
    expect(ids(routeTo(fork, 'done'))).toEqual(['ask:left', 'l']);
    expect(ids(routeTo(fork, 'done', 'right'))).toEqual(['ask:right', 'r']);
    expect(routeTo(fork, 'done', 'nowhere')).toBeUndefined();
  });

  it('starts a quest at a step: the quests before it done, earlier rewards paid', () => {
    const { world, quests } = book();
    const events = quests.testStart('test-after', 'both');
    expect(events.map((e) => e.type)).toEqual(['started', 'step']);
    // test-pier finished through the workshop: 100 for the timber, 10 for the workshop.
    expect(quests.progress('test-pier')).toMatchObject({
      step: 'done',
      chose: { build: 'workshop' },
    });
    expect(world.trade.captain.gold).toBe(110);
    expect(quests.progress('test-after')?.step).toBe('both');
    expect(quests.tracked).toBe('test-after');
  });

  it('pays the earlier steps of the quest itself, and skips and restarts the step', () => {
    const { world, quests } = book();
    quests.testStart('test-pier', 'build');
    expect(world.trade.captain.gold).toBe(100);
    expect(quests.progress('test-pier')?.step).toBe('build');
    // A choice skipped takes its first option and finishes the quest; the next quest starts.
    const skipped = quests.skipStep();
    expect(skipped.map((e) => e.type)).toContain('finished');
    expect(quests.progress('test-pier')?.chose).toEqual({ build: 'workshop' });
    expect(quests.progress('test-after')?.step).toBe('both');
    expect(quests.restartStep().map((e) => e.type)).toEqual(['step']);
    expect(quests.testStart('test-pier', 'nowhere')).toEqual([]);
  });

  it('starts the epilogue with every arc done', () => {
    const { world, quests } = book(QUESTS);
    quests.testStart('fair-winds', 'home');
    expect(quests.isAt('rooks-thanks', 'skerry')).toBe(true);
    for (const id of ['saltmere-shoals', 'calda-slipway', 'westholm-mill'])
      expect(quests.isDone(id), id).toBe(true);
    expect(Object.values(world.trade.home.islands).some((i) => i.owned)).toBe(true);
    expect(quests.progress('fair-winds')?.step).toBe('home');
  });

  it('reads the address and finds a berth in docking range at every port', () => {
    expect(questTestFrom('?map=edited&quest=a&step=b&port=saltmere')).toEqual({
      quest: 'a',
      step: 'b',
      port: 'saltmere',
      at: undefined,
    });
    expect(questTestFrom('?map=edited&quest=a&step=b&x=10&y=-5&h=90')?.at).toEqual({
      x: 10,
      y: -5,
      headingDeg: 90,
    });
    expect(questTestFrom('?quest=a&step=b')).toBeNull();
    // Into the wind (from 0, no-go 45°) she turns 65° off it; off the wind she keeps her heading.
    const deg = (d: number) => (d * Math.PI) / 180;
    expect(sailableHeading(deg(10), 0, deg(45))).toBeCloseTo(deg(65));
    expect(sailableHeading(deg(-5), 0, deg(45))).toBeCloseTo(deg(-65));
    expect(sailableHeading(deg(90), 0, deg(45))).toBe(deg(90));
    for (const port of PHASE1_MAP.ports) {
      const world = createWorld(PHASE1_MAP, SLOOP);
      const berth = testBerth(world.map, world.trade, world.piers, port.id, SLOOP.id);
      expect(berth, port.id).not.toBeNull();
      const boat = { ...berth!, heading: (berth!.headingDeg * Math.PI) / 180, speedKn: 0 };
      expect(tryDock(world.trade, world.map, boat, port.id), port.id).toBe(true);
    }
  });

  it('the builder starts a test at sea in clear water, short of the step’s place', () => {
    const shoals = QUESTS.find((q) => q.id === 'saltmere-shoals')!;
    const clear = (x: number, y: number) => clearAt(PHASE1_MAP, x, y, 4);
    for (const step of shoals.steps) {
      const start = seaStart(step, PHASE1_MAP, clear);
      if (!start) continue;
      expect(clear(start.x, start.y), step.id).toBe(true);
    }
    expect(seaStart(shoals.steps[0]!, PHASE1_MAP, clear)).not.toBeNull();
    expect(stepPort(shoals, shoals.steps[0], PHASE1_MAP)).toBe('saltmere');
    expect(playUrl('saltmere-shoals', 'gulls', { port: 'saltmere' })).toBe(
      './?map=edited&sea=phase4&quest=saltmere-shoals&step=gulls&port=saltmere',
    );
    expect(playUrl('q', 's', { x: 1.5, y: -2, headingDeg: 45 })).toBe(
      './?map=edited&sea=phase4&quest=q&step=s&x=1.5&y=-2&h=45',
    );
  });

  it('the edited map plays the builder’s quests', () => {
    const storage = memoryStorage();
    expect(editedQuests('?map=edited', storage)).toBeNull();
    const doc = { quests: [pier], text: { en: { 'quest.x.name': 'X' }, fr: {} } };
    storage.setItem('fwt.editor.quests.v1', JSON.stringify(doc));
    expect(editedQuests('?map=edited', storage)).toEqual(doc);
    expect(editedQuests('', storage)).toBeNull();
  });
});
