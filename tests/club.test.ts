import { describe, expect, it } from 'vitest';
import { GAME_MAP } from '../src/data/maps';
import { setLanguage } from '../src/i18n';
import { QUESTS, QUEST_DONE, QuestBook } from '../src/sim/quests';
import {
  bestFor,
  cleanRaceRecord,
  readRaceRecord,
  recordTime,
  writeRaceRecord,
} from '../src/sim/raceRecords';
import { SLOOP } from '../src/sim/ship';
import { createWorld } from '../src/sim/world';
import { clubBoard } from '../src/ui/clubBoard';
import { clubBoardBody } from '../src/ui/clubBoardView';
import { raceBookCards } from '../src/ui/regattaView';

// Decision 0226: the Sailing Club, its six races, the club board and best times per ship class.

const CLUB = QUESTS.filter((q) => q.race?.series === 'regatta-club');
const HOME = ['race-mill', 'race-light', 'race-abbey'];
const SQUALL = ['race-coral-squall', 'race-snowberry-squall', 'race-sandwick-squall'];
const LONG = ['race-meridian', 'race-great-reach'];

function bookWith(done: string[]) {
  setLanguage('en');
  const world = createWorld(GAME_MAP, SLOOP);
  world.trade.captain.activeShip = 'sloop';
  const book = new QuestBook(world, QUESTS);
  for (const id of done) world.trade.quests.byId[id] = { step: QUEST_DONE, counts: [], chose: {} };
  book.check();
  return book;
}

describe('best times per ship class', () => {
  it('keeps one best per class and the best overall', () => {
    const p: { best?: number; bests?: Record<string, number> } = {};
    expect(recordTime(p, 'sloop', 9000)).toBe(true);
    expect(recordTime(p, 'sloop', 9500)).toBe(false);
    expect(recordTime(p, 'cutter', 9800)).toBe(true);
    expect(p.best).toBe(9000);
    expect([bestFor(p, 'sloop'), bestFor(p, 'cutter'), bestFor(p, 'fluyt')]).toEqual([
      9000,
      9800,
      undefined,
    ]);
  });

  it('a record from before the classes counts for every ship', () => {
    expect(bestFor({ best: 7000 }, 'hoy')).toBe(7000);
  });

  it('round-trips through the save code numbers and drops what makes no sense', () => {
    const record = { best: 8000, medal: 2, bests: { sloop: 8000, cutter: 8300 } };
    const numbers: number[] = [];
    writeRaceRecord(record, (n) => numbers.push(n));
    const at = { i: 0 };
    expect(readRaceRecord(() => numbers[at.i++]!)).toEqual(record);
    expect(cleanRaceRecord({ best: -1, medal: 5, bests: { kayak: 10, sloop: 1.5 } })).toEqual({});
  });
});

describe('the Sailing Club races', () => {
  it('are eight: three in home waters, three with one fixed squall, two long one-way crossings', () => {
    expect(CLUB.map((q) => q.id).sort()).toEqual([...HOME, ...SQUALL, ...LONG].sort());
    for (const q of CLUB) {
      const gold = q.race!.gold;
      expect(q.race!.storms?.length ?? 0, q.id).toBe(SQUALL.includes(q.id) ? 1 : 0);
      expect([gold.bronze, gold.silver, gold.gold], q.id).toEqual(
        LONG.includes(q.id)
          ? [200, 400, 650]
          : SQUALL.includes(q.id)
            ? [120, 240, 400]
            : [40, 80, 130],
      );
    }
  });

  it('open after the prologue, the squall races also with their sea', () => {
    const open = (done: string[]) => bookWith(done).offered.map((q) => q.id);
    expect(open([])).not.toContain('race-mill');
    expect(open(['rooks-thanks'])).toEqual(expect.arrayContaining(HOME));
    expect(open(['race-greyback'])).not.toContain('race-coral-squall');
    expect(open(['race-greyback', 'outpost-south'])).toContain('race-coral-squall');
    expect(open(['race-greyback', 'outpost-north'])).toContain('race-snowberry-squall');
    expect(open(['race-greyback', 'outpost-east'])).toContain('race-sandwick-squall');
  });
});

describe('the club board', () => {
  it('stays shut until the club opens, and only at Abbey Head', () => {
    expect(clubBoard(bookWith([]), 'abbey-head')).toBeNull();
    const book = bookWith(['rooks-thanks']);
    expect(clubBoard(book, 'saltmere')).toBeNull();
    expect(clubBoard(book, 'abbey-head')).not.toBeNull();
  });

  it('lists the races met by series, with a medal count, "not sailed yet" and the ship par', () => {
    const book = bookWith(['rooks-thanks', 'race-greyback']);
    book.world.trade.quests.byId['race-mill'] = {
      step: QUEST_DONE,
      counts: [],
      chose: {},
      best: 9000,
      medal: 2,
      bests: { sloop: 9000 },
    };
    const board = clubBoard(book, 'abbey-head')!;
    expect(board.groups.map((g) => g.series)).toContain('regatta-club');
    const rows = board.groups.flatMap((g) => g.rows);
    expect(rows.find((r) => r.quest === 'race-mill')).toMatchObject({ best: 90, medal: 2 });
    expect(rows.find((r) => r.quest === 'race-light')?.best).toBeUndefined();
    expect(rows.find((r) => r.quest === 'race-light')?.par).toBeGreaterThan(0);
    expect(board.pinned).toBe(true);
    const html = clubBoardBody(board);
    expect(html).toContain('Not sailed yet');
    expect(html).toContain('1:30.0');
    expect(html).toContain('data-quest="race-mill"');
    expect(html).not.toContain('data-quest="race-light"');
  });

  it('shows the best of the ship sailed now', () => {
    const book = bookWith(['rooks-thanks', 'race-greyback']);
    book.world.trade.quests.byId['race-mill'] = {
      step: QUEST_DONE,
      counts: [],
      chose: {},
      best: 9000,
      medal: 2,
      bests: { sloop: 9000 },
    };
    book.world.trade.captain.activeShip = 'cutter';
    const row = clubBoard(book, 'abbey-head')!
      .groups.flatMap((g) => g.rows)
      .find((r) => r.quest === 'race-mill');
    expect(row?.best).toBeUndefined();
  });
});

describe('the board card on the Quay', () => {
  it('leads the regatta book at Abbey Head, and nowhere else', () => {
    const book = bookWith(['rooks-thanks', 'race-greyback']);
    const cards = raceBookCards(book, GAME_MAP, 'abbey-head');
    expect(cards[0]?.race?.board).toBeDefined();
    expect(cards[0]?.giver?.id).toBe('wren');
    expect(raceBookCards(book, GAME_MAP, 'westholm')).toEqual([]);
  });
});
