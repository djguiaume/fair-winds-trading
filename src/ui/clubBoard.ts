import { t, tOptional } from '../i18n';
import type { QuestBook, QuestDef } from '../sim/quests';
import { bestFor } from '../sim/raceRecords';
import { type MedalRank, REGATTA, parOf } from '../sim/regatta';

/*
 * The Sailing Club's board (decision 0226): Wren pins the captain's own times up at Saltmere, on
 * the Quay tab beside Rook's book. Only this captain's times, no ranking. Each race shows the best
 * time and medal of the ship sailed now and that ship's par. Words: `club.*`.
 */

export const CLUB_SERIES = 'regatta-club';
/** The harbour that keeps the board. */
export const CLUB_PORT = 'saltmere';

export interface ClubRow {
  quest: string;
  name: string;
  /** This ship's best time, seconds; absent when unsailed. */
  best?: number;
  medal: MedalRank;
  /** The par of this ship on this level, seconds. */
  par: number;
}

export interface ClubBoard {
  /** Races with a medal, of all races in the game. */
  won: number;
  all: number;
  /** Series in `regatta.json` order, each with its races the captain has met. */
  groups: { series: string; rows: ClubRow[] }[];
  /** Whether any race has a time yet. */
  pinned: boolean;
  /** "Race again" works: no race under way. */
  again: boolean;
}

/** A race the captain has met: sailed, begun, or on offer. */
const met = (book: QuestBook, q: QuestDef) =>
  !!book.progress(q.id) || book.offered.includes(q) || book.ignoredOffers.includes(q);

/** The board, or null when this is not the club's harbour or no club race has opened yet. */
export function clubBoard(book: QuestBook, docked: string | null): ClubBoard | null {
  const races = book.quests.filter((q) => q.race);
  if (docked !== CLUB_PORT || !races.some((q) => q.race!.series === CLUB_SERIES && met(book, q)))
    return null;
  const { activeShip } = book.world.trade.captain;
  const { difficulty } = book.world.trade;
  const rows = (series: string): ClubRow[] =>
    races
      .filter((q) => q.race!.series === series && met(book, q))
      .map((q) => {
        const p = book.progress(q.id);
        const best = p && bestFor(p, activeShip);
        return {
          quest: q.id,
          name: tOptional(`${q.text}.name`) ?? q.name,
          ...(best !== undefined ? { best: best / 100 } : {}),
          medal: (p?.medal ?? 0) as MedalRank,
          par: parOf(q.race!, activeShip, difficulty),
        };
      });
  const groups = REGATTA.series
    .map((s) => ({ series: s.id, rows: rows(s.id) }))
    .filter((g) => g.rows.length);
  return {
    won: races.filter((q) => book.progress(q.id)?.medal).length,
    all: races.length,
    groups,
    pinned: groups.some((g) => g.rows.some((r) => r.best !== undefined)),
    again: !book.race() && !book.lesson,
  };
}

/**
 * Wren's opening line, on the offer of a club race while no club race has been entered yet: the
 * club exists, there are new courses, a board, a few squalls.
 */
export function clubOpening(book: QuestBook, quest: QuestDef, speech?: string): string | undefined {
  if (quest.race?.series !== CLUB_SERIES) return speech;
  const entered = book.quests.some(
    (q) => q.race?.series === CLUB_SERIES && book.progress(q.id) !== undefined,
  );
  return entered ? speech : [t('club.open'), speech].filter(Boolean).join(' ');
}
