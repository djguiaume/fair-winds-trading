// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { GAME_MAP } from '../src/data/maps';
import { setLanguage } from '../src/i18n';
import { RACE_FINISHED, RACE_GOING } from '../src/sim/questLibrary';
import {
  type QuestDef,
  type QuestEvent,
  QuestBook,
  checkQuests,
  readQuests,
} from '../src/sim/quests';
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
import { pilot, stepRival } from '../src/sim/traffic';
import { releaseRival } from '../src/sim/rival';
import { type World, createWorld } from '../src/sim/world';
import { QUESTS } from '../src/sim/quests';
import { cardFor } from '../src/ui/questView';
import { raceBookCards, raceClock, raceHud, raceResultCard } from '../src/ui/regattaView';

// Decision 0217: the Saltmere Regatta. A race is a quest with a `race` block and one `raced`
// step: the horn sequence, a start line crossed toward the course, marks in order, a finish line.

const START: Gate = [
  { x: 0, y: 0 },
  { x: 84, y: 0 },
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

describe('regatta (decision 0217)', () => {
  it('the data and the shipped races are sound', () => {
    expect(checkRegattaData()).toEqual([]);
    // A line too short for two big ships side by side.
    const short: Gate = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    ];
    const cramped = {
      ...RACE,
      steps: [{ ...RACE.steps[0]!, goal: { ...RACE.steps[0]!.goal, start: short } }],
    } as QuestDef;
    expect(
      checkQuests([cramped], GAME_MAP, ['fair-winds']).some((p) =>
        p.includes('start line is 40 long'),
      ),
    ).toBe(true);
    const { book } = setup();
    expect(checkQuests([RACE], GAME_MAP, ['fair-winds'])).toEqual([]);
    expect(book.offered.map((q) => q.id)).toEqual(['test-race']);
  });

  it('lines: crossed toward the course only from the far side', () => {
    const toward = { x: 20, y: 50 };
    expect(crossesForward(START, { x: 20, y: -5 }, { x: 20, y: 5 }, toward)).toBe(true);
    expect(crossesForward(START, { x: 20, y: 5 }, { x: 20, y: -5 }, toward)).toBe(false);
    // Outside the ends is no crossing.
    expect(crossesGate(START, { x: 100, y: -5 }, { x: 100, y: 5 })).toBe(false);
  });

  it('Kestrel goes round the other boats, never through them', () => {
    const { world, book } = setup();
    world.boat.x = 20;
    world.boat.y = -10;
    book.accept('test-race');
    const kestrel = world.rival!;
    const other = world.traffic.boats[0]!;
    other.awake = true;
    other.boat.x = kestrel.boat.x;
    other.boat.y = kestrel.boat.y + 1;
    stepRival(world, 0.1);
    // At least as far as two hulls touch side by side.
    const reach = (kestrel.ship.radius + other.ship.radius) * 0.42 * 1.1;
    const d = Math.hypot(other.boat.x - kestrel.boat.x, other.boat.y - kestrel.boat.y);
    expect(d).toBeGreaterThanOrEqual(reach - 1e-6);
  });

  it('Kestrel steers round the captain, and a touch slows both boats', () => {
    const { world, book } = setup();
    world.boat.x = 20;
    world.boat.y = -10;
    book.accept('test-race');
    const kestrel = world.rival!;
    // The captain dead ahead of her, close: she bears away.
    kestrel.boat.heading = 0;
    world.boat.x = kestrel.boat.x;
    world.boat.y = kestrel.boat.y + 15;
    world.time = 1;
    releaseRival(world, true);
    expect(pilot(world, kestrel, { from: Math.PI / 2, speedKn: 12 }).steer).not.toBe(0);
    // Touching, bow to bow: both lose way.
    world.boat.y = kestrel.boat.y + 2;
    world.boat.heading = Math.PI;
    world.boat.speedKn = kestrel.boat.speedKn = 6;
    stepRival(world, 0.01);
    expect(world.boat.speedKn).toBeLessThan(6);
    expect(kestrel.boat.speedKn).toBeLessThan(6);
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

  it('the shipped races: eight, all sound, and their gold a small share of the game', () => {
    const races = QUESTS.filter((q) => q.race);
    expect(races.map((q) => q.id).sort()).toEqual(
      [
        'race-calda',
        'race-floe',
        'race-four-winds',
        'race-gap',
        'race-greyback',
        'race-narrows',
        'race-smoulder',
        'race-stormbreak',
      ].sort(),
    );
    // Every series has its races: the ring 3, the seas 4, the Cup 1.
    const count = (s: string) => races.filter((q) => q.race!.series === s).length;
    expect([count('regatta-ring'), count('regatta-seas'), count('regatta-cup')]).toEqual([3, 4, 1]);
    // Every medal the first time comes to under 6,000 gold: pride, not power (storyteller).
    const all = races.reduce((n, q) => n + medalGold(q.race!, 0, 3), 0);
    expect(all).toBeLessThanOrEqual(6000);
    // Every ship class has a par on every level.
    for (const q of races)
      for (const ship of ['sloop', 'cutter', 'schooner', 'clipper', 'hoy', 'fluyt', 'indiaman'])
        expect(Object.keys(q.race!.pars[ship] ?? {}).sort(), `${q.id} ${ship}`).toEqual([
          'captain',
          'fair',
          'salt',
        ]);
  });

  it('the race screens: the course pill, the offer, the result card, the regatta book', () => {
    const { world, book } = setup();
    expect(raceClock(62.44)).toBe('1:02.4');
    world.boat.x = 20;
    world.boat.y = -10;
    const offer = cardFor(book, GAME_MAP, 'test-race', 'offer')!;
    expect(offer.reward).toBeUndefined();
    expect(offer.race?.times.map((m) => [m.medal, m.gold])).toEqual([
      ['gold', 30],
      ['silver', 20],
      ['bronze', 10],
    ]);
    book.accept('test-race');
    expect(raceHud(book)).toMatchObject({ label: 'Horn in 10', sec: null });
    horn(world, book);
    expect(raceHud(book)?.label).toBe('Cross the start line');
    sail(world, book, 20, 5);
    expect(raceHud(book)).toMatchObject({ label: 'Mark 1 of 1', short: '1/1' });
    sail(world, book, 20, 98, 40);
    expect(raceHud(book)?.label).toBe('To the finish line');
    const events = sail(world, book, 20, -5, 40);
    expect(raceHud(book)).toBeNull();
    const raced = events.find((e) => e.type === 'raced')!;
    const card = raceResultCard(book, GAME_MAP, raced as never)!;
    expect(card.ask).toBe('Gold medal');
    expect(card.race?.result?.medal).toBe(3);
    expect(card.race?.again).toBe(true);
    // The ring series is won: Wren's pennant line, and the pennant said to fly.
    expect(card.speech).toContain('Saltmere pennant');
    expect(card.news).toContain('masthead');
    const bookCards = raceBookCards(book, GAME_MAP, 'saltmere');
    expect(bookCards.map((c) => [c.quest, c.race?.book, c.race?.again])).toEqual([
      ['test-race', true, true],
    ]);
  });
});
