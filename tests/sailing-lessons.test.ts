import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { DEG } from '../src/sim/math';
import { QUESTS, QuestBook, type QuestDef } from '../src/sim/quests';
import { SLOOP } from '../src/sim/ship';
import { type World, createWorld } from '../src/sim/world';

/*
 * Decision 0164: Rook's sailing lessons, replayable from the title menu. Two new conditions read
 * the helm: seconds on a point of sail, and tacks (the bow crossing the wind, not a gybe).
 */

const WIND = { from: 30 * DEG, speedKn: 10 };

/** A drill: two tacks, then a few seconds on a beam reach. */
const drill = {
  id: 'test-drill',
  name: 'Test: a drill',
  start: { is: 'asked' },
  text: 'quest.test-drill',
  steps: [
    { id: 'tacks', goal: { is: 'tacked', count: 2 } },
    { id: 'reach', goal: { is: 'point-of-sail', point: 'beam-reach', holdSec: 3 } },
  ],
} as unknown as QuestDef;

function setup(quests: QuestDef[]) {
  const world = createWorld(PHASE1_MAP, SLOOP);
  world.wind = { ...WIND };
  const book = new QuestBook(world, quests, { doneElsewhere: () => true, nightOk: () => false });
  return { world, book };
}

/** Steer to a true wind angle (degrees, + wind on the starboard bow) and hold it `sec` seconds. */
function hold(world: World, book: QuestBook, twaDeg: number, sec: number) {
  world.boat.heading = WIND.from - twaDeg * DEG;
  for (let t = 0; t < sec - 1e-9; t += 0.05) book.update(0.05, { sailStep: 2, steer: 0 });
}

describe('tacks and points of sail (decision 0164)', () => {
  it('counts the bow crossing the wind as a tack', () => {
    const { world, book } = setup([drill]);
    book.ask('test-drill');
    hold(world, book, 50, 1);
    hold(world, book, -50, 1);
    expect(book.progress('test-drill')?.step).toBe('tacks');
    hold(world, book, 50, 1);
    expect(book.progress('test-drill')?.step).toBe('reach');
  });

  it('does not count a gybe round to the other tack', () => {
    const { world, book } = setup([drill]);
    book.ask('test-drill');
    for (const twa of [50, 100, 150, 180, -150, -100, -50, -100, -150, 180, 150, 100, 50])
      hold(world, book, twa, 0.5);
    expect(book.progress('test-drill')?.step).toBe('tacks');
  });

  it('holds a point of sail for its seconds', () => {
    const { world, book } = setup([drill]);
    book.ask('test-drill');
    hold(world, book, 50, 0.5);
    hold(world, book, -50, 0.5);
    hold(world, book, 50, 0.5);
    hold(world, book, 90, 2);
    expect(book.progress('test-drill')?.step).toBe('reach');
    hold(world, book, 90, 1.5);
    expect(book.isDone('test-drill')).toBe(true);
  });
});

describe('the sailing lessons quest (decision 0164)', () => {
  const lessons = QUESTS.find((q) => q.id === 'sailing-lessons')!;

  it('is a lesson the menu asks for, with no reward', () => {
    expect(lessons.lesson).toBe(true);
    expect(lessons.start).toEqual({ is: 'asked' });
    expect(lessons.steps.some((s) => s.reward)).toBe(false);
  });

  it('takes the boat to the course, then sails it: sails, no-go, tack to A, reach to B, home', () => {
    const { world, book } = setup([lessons]);
    const step = () => book.progress('sailing-lessons')?.step;
    Object.assign(world.boat, { x: -300, y: 200, speedKn: 6, sailStep: 2 });
    world.trade.dockedAt = null;
    const events = book.ask('sailing-lessons');
    expect(events).toContainEqual({ type: 'moved', quest: 'sailing-lessons', step: 'sails' });
    expect([world.boat.x, world.boat.y, world.boat.speedKn, world.boat.sailStep]).toEqual([
      300, -85, 0, 0,
    ]);
    expect(step()).toBe('sails');
    for (const sailStep of [0, 2]) book.update(0.3, { sailStep, steer: 0 });
    for (let t = 0; t < 3; t += 0.1) {
      world.boat.speedKn = 3;
      book.update(0.1, { sailStep: 2, steer: 1 });
    }
    expect(step()).toBe('no-go');
    hold(world, book, 0, 3.5);
    expect(step()).toBe('tack');
    hold(world, book, 50, 0.5);
    hold(world, book, -50, 0.5);
    hold(world, book, 50, 0.5);
    world.boat.x = 380;
    world.boat.y = -31;
    book.check(0.25);
    expect(step()).toBe('reach');
    world.boat.x = 319;
    world.boat.y = 4;
    hold(world, book, 90, 6.5);
    expect(step()).toBe('home');
    world.trade.dockedAt = 'saltmere';
    book.check(0.25);
    expect(book.isDone('sailing-lessons')).toBe(true);
  });

  it('shows its buoys and holds its breeze only while it runs', () => {
    const { world, book } = setup([lessons]);
    expect(book.runningMarks).toEqual([]);
    expect(book.trackedWind).toBeUndefined();
    book.ask('sailing-lessons');
    expect(book.runningMarks.map((m) => [m.type, m.name])).toEqual([
      ['buoy-yellow', 'A'],
      ['buoy-yellow', 'B'],
    ]);
    expect(book.trackedWind).toEqual({ speedKn: 10, fromDeg: 30 });
    book.drop('sailing-lessons');
    expect(book.runningMarks).toEqual([]);
    expect(book.trackedWind).toBeUndefined();
    expect(world.boat.x).toBe(300);
  });
});
