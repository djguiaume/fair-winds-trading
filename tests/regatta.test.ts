// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { GAME_MAP } from '../src/data/maps';
import { setLanguage } from '../src/i18n';
import { RACE_FINISHED, RACE_GOING } from '../src/sim/questLibrary';
import { type QuestDef, type QuestEvent, QuestBook, checkQuests, readQuests } from '../src/sim/quests';
import {
  REGATTA,
  type Gate,
  checkRegattaData,
  crossesForward,
  crossesGate,
  medalFor,
  medalGold,
  pennantFor,
  rivalPace,
  seriesWon,
} from '../src/sim/regatta';
import { packSave, unpackSave } from '../src/sim/saveCode';
import { serializeWorld } from '../src/sim/save';
import { questsDone } from '../src/sim/settlement';
import { SLOOP } from '../src/sim/ship';
import { type World, createWorld } from '../src/sim/world';

// Decision 0216: the Saltmere Regatta. A race is a quest with a `race` block and one `raced`
// step: the horn sequence, a start line crossed toward the course, marks in order, a finish line.

const START: Gate = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
];
const RACE: QuestDef = {
  id: 'test-race',
  name: 'Test race',
  start: { is: 'always' },
  text: 'quest.race-gap',
  giver: 'wren',
  starter: 'rook',
  port: 'saltmere',
  offer: true,
  race: {
    series: 'regatta-ring',
    gold: { bronze: 10, silver: 20, gold: 30 },
    pars: { sloop: { fair: 100, captain: 100, salt: 100 } },
  },
  steps: [
    {
      id: 'race',
      goal: { is: 'raced', start: START, marks: [{ x: 20, y: 100 }], finish: START },
    },
  ],
};

function setup(quests: QuestDef[] = [RACE]) {
  setLanguage('en');
  const world: World = createWorld(GAME_MAP, SLOOP);
  world.trade.captain.activeShip = 'sloop';
  const book = new QuestBook(world, quests);
  book.check();
  return { world, book };
}

/** Puts the boat at (x, y) and lets the quests see the move over `dt` seconds. */
function sail(world: World, book: QuestBook, x: number, y: number, dt = 1): QuestEvent[] {
  world.boat.x = x;
  world.boat.y = y;
  world.time += dt;
  return book.check(dt);
}

/** The horn sequence, waited out where the boat is. */
function horn(world: World, book: QuestBook): QuestEvent[] {
  const out: QuestEvent[] = [];
  for (let t = 0; t <= REGATTA.countdownSec; t++)
    out.push(...sail(world, book, world.boat.x, world.boat.y));
  return out;
}

describe('regatta (decision 0216)', () => {
  it('the data and the shipped races are sound', () => {
    expect(checkRegattaData()).toEqual([]);
    const { book } = setup();
    expect(checkQuests([RACE], GAME_MAP, ['fair-winds'])).toEqual([]);
    expect(book.offered.map((q) => q.id)).toEqual(['test-race']);
  });

  it('lines: crossed toward the course only from the far side', () => {
    const toward = { x: 20, y: 50 };
    expect(crossesForward(START, { x: 20, y: -5 }, { x: 20, y: 5 }, toward)).toBe(true);
    expect(crossesForward(START, { x: 20, y: 5 }, { x: 20, y: -5 }, toward)).toBe(false);
    // Outside the ends is no crossing.
    expect(crossesGate(START, { x: 60, y: -5 }, { x: 60, y: 5 })).toBe(false);
  });

  it('medals, their first-time gold and the rival pace', () => {
    expect(medalFor(RACE.race!, 'sloop', 'captain', 99)).toBe(3);
    expect(medalFor(RACE.race!, 'sloop', 'captain', 110)).toBe(2);
    expect(medalFor(RACE.race!, 'sloop', 'captain', 130)).toBe(1);
    expect(medalFor(RACE.race!, 'sloop', 'captain', 200)).toBe(0);
    // A class with no par is held to the slowest one.
    expect(medalFor(RACE.race!, 'indiaman', 'captain', 99)).toBe(3);
    expect(medalGold(RACE.race!, 0, 3)).toBe(60);
    expect(medalGold(RACE.race!, 2, 3)).toBe(30);
    expect(medalGold(RACE.race!, 3, 1)).toBe(0);
    const pace = rivalPace(RACE.race!, 'sloop', 'captain');
    expect(pace).toBeGreaterThanOrEqual(REGATTA.rival.paceRange[0]);
    expect(pace).toBeLessThanOrEqual(REGATTA.rival.paceRange[1]);
  });

  it('a race: the horn, the start, the marks, the finish, the medal and the gold', () => {
    const { world, book } = setup();
    world.boat.x = 20;
    world.boat.y = -10;
    book.accept('test-race');
    expect(book.tracked).toBe('test-race');
    expect(world.rival).not.toBeNull();
    expect(book.race()?.state).toBe('sequence');
    // Over the line before the horn counts for nothing.
    sail(world, book, 20, 5);
    const at = horn(world, book);
    expect(at.map((e) => e.type)).toContain('horn');
    expect(world.rival?.racer?.gunAt).not.toBeNull();
    expect(book.progress('test-race')!.counts[0]).toBe(RACE_GOING);
    // Still over: back across, then over again.
    sail(world, book, 20, 30);
    expect(book.race()?.started).toBe(false);
    sail(world, book, 20, -5);
    sail(world, book, 20, 5);
    expect(book.race()?.started).toBe(true);
    // The finish before the mark is no finish.
    sail(world, book, 20, -5);
    expect(book.isRunning('test-race')).toBe(true);
    sail(world, book, 20, 98, 40);
    expect(book.race()?.rounded).toBe(1);
    const gold = world.trade.captain.gold;
    const events = sail(world, book, 20, -5, 40);
    const raced = events.find((e) => e.type === 'raced');
    expect(raced).toMatchObject({ medal: 3, had: 0, best: true, gold: 60 });
    expect(world.trade.captain.gold).toBe(gold + 60);
    expect(book.progress('test-race')).toMatchObject({ step: 'done', medal: 3 });
    expect(book.isDone('test-race')).toBe(true);
    expect(book.raced.map((q) => q.id)).toEqual(['test-race']);
    // The ring series has one race here, won with gold: its pennant and its "done".
    expect(book.won).toEqual(['regatta-ring']);
    expect(pennantFor(book.won)?.id).toBe('pennant-saltmere');
    expect(questsDone(world.trade).has('regatta-ring')).toBe(true);
  });

  it('sailed again: kept done, no gold twice, the best kept; docking gives it up', () => {
    const { world, book } = setup();
    world.boat.x = 20;
    world.boat.y = -10;
    book.accept('test-race');
    horn(world, book);
    sail(world, book, 20, 5);
    sail(world, book, 20, 98, 40);
    sail(world, book, 20, -5, 40);
    const best = book.progress('test-race')!.best!;
    expect(book.raceAgain('test-race').map((e) => e.type)).toContain('started');
    expect(book.isDone('test-race')).toBe(true);
    expect(questsDone(world.trade).has('test-race')).toBe(true);
    horn(world, book);
    sail(world, book, 20, 5);
    sail(world, book, 20, 98, 100);
    const gold = world.trade.captain.gold;
    const events = sail(world, book, 20, -5, 100);
    expect(events.find((e) => e.type === 'raced')).toMatchObject({ best: false, gold: 0 });
    expect(world.trade.captain.gold).toBe(gold);
    expect(book.progress('test-race')).toMatchObject({ best, medal: 3 });
    // Docked mid-race: given up, the record kept.
    book.raceAgain('test-race');
    world.trade.dockedAt = 'saltmere';
    const gave = book.check(0.25);
    expect(gave.map((e) => e.type)).toContain('retired');
    expect(book.progress('test-race')).toMatchObject({ step: 'done', best, medal: 3 });
    expect(world.rival).toBeNull();
  });

  it('given up before a first finish, the race is offered again', () => {
    const { world, book } = setup();
    book.accept('test-race');
    book.retire('test-race');
    expect(book.progress('test-race')).toBeUndefined();
    expect(book.offered.map((q) => q.id)).toEqual(['test-race']);
    expect(world.rival).toBeNull();
  });

  it('the record is saved, in JSON and in the save code', () => {
    const { world, book } = setup();
    world.boat.x = 20;
    world.boat.y = -10;
    book.accept('test-race');
    horn(world, book);
    sail(world, book, 20, 5);
    sail(world, book, 20, 98, 40);
    sail(world, book, 20, -5, 40);
    const p = book.progress('test-race')!;
    expect(p.counts).toEqual([]);
    const read = readQuests(structuredClone(world.trade.quests), GAME_MAP, [RACE]);
    expect(read.byId['test-race']).toMatchObject({ best: p.best, medal: 3 });
    expect(read.won).toEqual(['regatta-ring']);
    const save = serializeWorld(world);
    const back = unpackSave(packSave(save, GAME_MAP, [RACE]), GAME_MAP, save.version, [RACE]);
    expect(back.ok && back.raw.quests?.byId['test-race']).toMatchObject({
      best: p.best,
      medal: 3,
    });
  });

  it('series are won with the win medal in every race of them', () => {
    const races = [
      { id: 'a', race: { ...RACE.race!, series: 'regatta-seas' } },
      { id: 'b', race: { ...RACE.race!, series: 'regatta-seas' } },
    ];
    expect(seriesWon(races, (id) => (id === 'a' ? 3 : 1))).toEqual([]);
    expect(seriesWon(races, () => 2)).toEqual(['regatta-seas']);
    expect(RACE_FINISHED).toBe(2);
  });
});
