import { describe, expect, it } from 'vitest';
import { grownMap } from '../../src/data/grownMap';
import { PHASE1_SOURCE, prepareMap } from '../../src/data/maps';
import { setLanguage, tOptional } from '../../src/i18n';
import { insideOutline } from '../../src/sim/flowShapes';
import type { Condition, QuestSpot } from '../../src/sim/questLibrary';
import { QUESTS, QuestBook } from '../../src/sim/quests';
import { testBerth } from '../../src/sim/questTest';
import { SLOOP } from '../../src/sim/ship';
import { type World, createWorld } from '../../src/sim/world';
import { cardFor } from '../../src/ui/questView';

// Issue #361: the chapter after Four Winds. Ness lays the four oddities on her chart, the drift
// lines meet in the Stormbreak's quiet, a buoy there holds Rook's father's sea chest; then the old
// flag and Ness go home to Skerry, where the family meets on the pier. Nothing can fail.
const MAP = prepareMap(grownMap(PHASE1_SOURCE));
const quest = (id: string) => QUESTS.find((q) => q.id === id)!;
const goalOf = (q: string, s: string) => quest(q).steps.find((x) => x.id === s)!.goal!;

function at(questId: string, stepId: string) {
  setLanguage('en');
  const world: World = createWorld(MAP, SLOOP);
  const book = new QuestBook(world, QUESTS, { nightOk: () => false });
  book.testStart(questId, stepId);
  return { world, book };
}

function hold(world: World, book: QuestBook, spot: { x: number; y: number }, kn: number) {
  world.trade.dockedAt = null;
  Object.assign(world.boat, { x: spot.x, y: spot.y, speedKn: kn });
  for (let t = 0; t < 4; t += 0.25) book.check(0.25);
}

function dock(world: World, book: QuestBook, port: string) {
  world.trade.dockedAt = port;
  book.check();
  world.trade.dockedAt = null;
}

describe('the chapter after Four Winds (#361)', () => {
  it('follows Four Winds, then the homecoming follows the mystery', () => {
    expect(quest('star-over-wave').start).toEqual({ is: 'quest-done', quest: 'four-winds' });
    expect(quest('homecoming').start).toEqual({ is: 'quest-done', quest: 'star-over-wave' });
  });

  it('finds the buoy where Elias’s lull was, inside the Stormbreak', () => {
    const lull = (goalOf('fogwatch-amber', 'lull') as Condition & { from: QuestSpot }).from;
    const buoy = (goalOf('star-over-wave', 'buoy') as Condition & { points: QuestSpot[] })
      .points[0]!;
    expect([buoy.x, buoy.y]).toEqual([lull.x, lull.y]);
    expect(quest('star-over-wave').marks).toEqual([{ type: 'quest-buoy', x: lull.x, y: lull.y }]);
    const belt = MAP.windZones!.find((z) => z.id === 'stormbreak')!.outline;
    expect(insideOutline(buoy.x, buoy.y, belt as [number, number][])).toBe(true);
  });

  it('plays the mystery: Ness’s chart, the buoy, the chest to Rook', () => {
    const { world, book } = at('star-over-wave', 'lay');
    expect(cardFor(book, world.map, 'star-over-wave', 'step')!.giver?.id).toBe('ness');
    dock(world, book, 'watchman-key');
    expect(book.progress('star-over-wave')!.step).toBe('buoy');
    const spot = { x: 760, y: 290 };
    hold(world, book, spot, 6);
    expect(book.progress('star-over-wave')!.step).toBe('buoy');
    hold(world, book, spot, 2);
    expect(book.progress('star-over-wave')!.step).toBe('chest');
    hold(world, book, spot, 2);
    dock(world, book, 'saltmere');
    expect(book.isDone('star-over-wave')).toBe(true);
    expect(cardFor(book, world.map, 'star-over-wave', 'finished')!.giver?.id).toBe('rook');
  });

  it('plays the homecoming: the old flag and Ness moored at Skerry’s pier', () => {
    const { world, book } = at('homecoming', 'flag');
    const berth = testBerth(world.map, world.trade, world.piers, 'skerry', SLOOP.id)!;
    dock(world, book, 'saltmere');
    hold(world, book, berth, 0);
    expect(book.progress('homecoming')!.step).toBe('ness');
    expect(cardFor(book, world.map, 'homecoming', 'step')!.giver?.id).toBe('ness');
    dock(world, book, 'watchman-key');
    hold(world, book, berth, 0);
    expect(book.isDone('homecoming')).toBe(true);
  });

  it('has every line and object name in English and French', () => {
    const keys = [
      ...['lay', 'buoy', 'chest', 'done'].map((s) => `quest.star-over-wave.${s}`),
      ...['flag', 'ness', 'done'].map((s) => `quest.homecoming.${s}`),
    ].flatMap((k) => [`${k}.title`, `${k}.copy`]);
    const forms = ['one', 'many', 'the', 'own', 'unloadedOne', 'unloadedMany'];
    const items = ['sea-chest', 'old-flag'].flatMap((i) =>
      forms.map((f) => `quest.item.${i}.${f}`),
    );
    for (const lang of ['en', 'fr'] as const) {
      setLanguage(lang);
      for (const key of [...keys, ...items]) expect(tOptional(key), `${lang} ${key}`).toBeTruthy();
    }
  });
});
