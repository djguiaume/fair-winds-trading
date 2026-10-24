import { describe, expect, it } from 'vitest';
import { PHASE0_MAP, PHASE1_MAP } from '../src/data/maps';
import { type Screen } from '../src/sim/questLibrary';
import { QUESTS, QuestBook, type QuestDef, checkQuests, questsFor } from '../src/sim/quests';
import { packSave, unpackSave } from '../src/sim/saveCode';
import { serializeWorld } from '../src/sim/save';
import { homePort } from '../src/sim/shipyards';
import { SLOOP } from '../src/sim/ship';
import { createWorld } from '../src/sim/world';
import { stepParams } from '../src/ui/questView';

/*
 * Decision 0148: what the tutorial needed, as step data any quest can use: vars picked in play,
 * ways back, a goal with buttons, options shown only when a condition holds, the chart, the
 * course and buying as conditions, map places by word, and quests the game asks for.
 */

/** A small errand: pick a port on the chart, buy there, go back if you sail off empty-handed. */
const errand = {
  id: 'test-errand',
  name: 'Test: an errand',
  start: { is: 'asked' },
  text: 'quest.test-errand',
  lesson: true,
  storms: false,
  vars: { shop: 'port', ware: 'good' },
  steps: [
    {
      id: 'look',
      goal: { is: 'screen', screen: 'chart' },
      choose: [{ id: 'skip-look' }],
    },
    { id: 'pick', goal: { is: 'course' }, set: { shop: 'course' } },
    {
      id: 'go',
      port: '$shop',
      goal: { is: 'docked', port: '$shop' },
      unless: [{ if: { is: 'not', of: { is: 'course' } }, to: 'pick' }],
    },
    {
      id: 'buy',
      goal: { is: 'bought', port: '$shop', qty: 2 },
      choose: [{ id: 'mine', if: { is: 'has-cargo' } }],
      set: { ware: 'aboard' },
      unless: [{ if: { is: 'not', of: { is: 'docked', port: '$shop' } }, to: 'go' }],
    },
    { id: 'keep', goal: { is: 'has-cargo', good: '$ware', qty: 2 } },
  ],
} as unknown as QuestDef;

function voyage(quests: QuestDef[] = [errand], map = PHASE1_MAP) {
  const world = createWorld(map, SLOOP);
  let screen: Screen = 'sea';
  const book = new QuestBook(world, quests, { screen: () => screen });
  const course = (id: string | null) => {
    world.destination = id ? { portId: id, label: id, x: 0, y: 0 } : null;
    book.check();
  };
  const show = (s: Screen) => {
    screen = s;
    book.check();
  };
  return { world, book, course, show, step: () => book.progress(errand.id)?.step };
}

describe('step data for lessons (decision 0148)', () => {
  it('is checked like the rest of a quest', () => {
    expect(checkQuests([errand], PHASE1_MAP)).toEqual([]);
    const bad = structuredClone(errand) as QuestDef;
    bad.steps[1]!.set = { shop: 'nowhere', nobody: 'course' };
    bad.steps[2]!.unless = [{ if: { is: 'docked', port: '$lost' }, to: 'gone' }];
    bad.steps[3]!.coach = { sea: 'the-moon' as never, port: '$ware' };
    bad.steps[4]!.goal = { is: 'asked' };
    bad.steps[0]!.compass = 'atlantis';
    bad.vars = { ...bad.vars, oops: 'ship' as never };
    const problems = checkQuests([bad], PHASE1_MAP).join('\n');
    expect(problems).toContain('set.shop: course, docked, home or a port');
    expect(problems).toContain('no var "nobody"');
    expect(problems).toContain('no port var "lost"');
    expect(problems).toContain('no step "gone"');
    expect(problems).toContain('coach.sea: one of');
    expect(problems).toContain('coach.port: a port, home');
    expect(problems).toContain('"asked" only works as a quest\'s start');
    expect(problems).toContain('compass: needs { "x", "y" } or a map place');
    expect(problems).toContain('vars.oops');
  });

  it('starts only when asked, again each time; dropping it counts as done, unpaid', () => {
    const v = voyage();
    v.book.check();
    expect(v.step()).toBeUndefined();
    v.book.ask(errand.id);
    expect(v.step()).toBe('look');
    expect(v.book.tracked).toBe(errand.id);
    expect(v.book.holdsStorms).toBe(true);
    expect(v.book.drop(errand.id)).toBe(true);
    expect(v.book.isDone(errand.id)).toBe(true);
    expect(v.book.holdsStorms).toBe(false);
    v.book.ask(errand.id);
    expect(v.step()).toBe('look');
  });

  it('a goal with buttons: either ends the step', () => {
    const v = voyage();
    v.book.ask(errand.id);
    v.show('chart');
    expect(v.step()).toBe('pick');
    v.show('sea');
    v.book.ask(errand.id);
    v.book.choose(errand.id, 'skip-look');
    expect(v.step()).toBe('pick');
  });

  it('fills vars from the voyage, reads them as $name, and goes back when the place is lost', () => {
    const v = voyage();
    v.book.ask(errand.id);
    v.book.choose(errand.id, 'skip-look');
    v.course('calda');
    expect(v.step()).toBe('go');
    expect(v.book.progress(errand.id)!.vars).toEqual({ shop: 'calda' });
    expect(v.book.portOf(errand.id, '$shop')).toBe('calda');
    expect(stepParams(v.book, errand.steps[2], errand).shop).toBe('Port Calda');
    // Clearing the course is a way back to picking one.
    v.course(null);
    expect(v.step()).toBe('pick');
    v.course('westholm');
    v.world.trade.dockedAt = 'calda';
    v.book.check();
    expect(v.step()).toBe('go');
    v.world.trade.dockedAt = 'westholm';
    v.book.check();
    expect(v.step()).toBe('buy');
    // Sailing off goes back one step, and only one way back per check.
    v.world.trade.dockedAt = null;
    v.book.check();
    expect(v.step()).toBe('go');
  });

  it('counts goods bought at the port, and shows an option only while its condition holds', () => {
    const v = voyage();
    v.book.ask(errand.id);
    v.book.choose(errand.id, 'skip-look');
    v.course('saltmere');
    v.world.trade.dockedAt = 'saltmere';
    v.book.check();
    expect(v.step()).toBe('buy');
    expect(v.book.options(errand.id)).toEqual([]);
    expect(v.book.choose(errand.id, 'mine')).toEqual([]);
    v.world.trade.captain.cargo.fish += 1;
    v.book.check();
    expect(v.step()).toBe('buy');
    expect(v.book.options(errand.id).map((o) => o.id)).toEqual(['mine']);
    v.world.trade.captain.cargo.fish += 1;
    v.book.check();
    // Two fish aboard: the last step holds at once.
    expect(v.step()).toBe('done');
    expect(v.book.progress(errand.id)!.vars).toEqual({ shop: 'saltmere', ware: 'fish' });
  });

  it('passes by a step about a map place the map lacks', () => {
    const quest = {
      id: 'test-wreck',
      name: 'Test: the wreck',
      start: { is: 'always' },
      text: 'quest.test-wreck',
      vars: { here: 'port' },
      steps: [
        {
          id: 'find',
          goal: { is: 'reach', points: ['wreck'], within: 20 },
          compass: 'wreck',
          set: { here: 'home' },
        },
        { id: 'home', goal: { is: 'docked', port: '$here' } },
      ],
    } as unknown as QuestDef;
    expect(checkQuests([quest], PHASE0_MAP)).toEqual([]);
    const plain = new QuestBook(createWorld(PHASE0_MAP, SLOOP), [quest]);
    plain.check();
    expect(plain.progress('test-wreck')).toMatchObject({
      step: 'home',
      vars: { here: homePort(PHASE0_MAP).id },
    });
    const prologue = new QuestBook(createWorld(PHASE1_MAP, SLOOP), [quest]);
    prologue.check();
    expect(prologue.progress('test-wreck')!.step).toBe('find');
    expect(prologue.compassOf(prologue.trackedStep)).not.toBeNull();
  });

  it('keeps a lesson tracked while it runs', () => {
    const other = {
      ...structuredClone(errand),
      id: 'test-other',
      lesson: false,
      start: { is: 'always' },
    };
    const v = voyage([errand, other as QuestDef]);
    v.book.check();
    expect(v.book.tracked).toBe('test-other');
    v.book.ask(errand.id);
    expect(v.book.tracked).toBe(errand.id);
    expect(v.book.track('test-other')).toBe(false);
    v.book.drop(errand.id);
    expect(v.book.tracked).toBe('test-other');
  });

  it('carries the vars in the save code', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const book = new QuestBook(world, QUESTS);
    book.ask('first-voyage');
    expect(book.restore('first-voyage', 'deliver')).toBe(false);
    world.trade.quests.byId['first-voyage'] = {
      step: 'deliver',
      counts: [],
      chose: { sails: 'continue' },
      vars: { origin: 'saltmere', delivery: 'calda', cargo: 'fish' },
    };
    const save = serializeWorld(world);
    const read = unpackSave(packSave(save, PHASE1_MAP), PHASE1_MAP, save.version);
    expect(read.ok && read.raw.quests).toEqual(save.quests);
    expect(questsFor(PHASE1_MAP).map((q) => q.id)).toContain('first-voyage');
  });
});
