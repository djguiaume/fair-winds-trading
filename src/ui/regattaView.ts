import { type MessageKey, shipName, t, tOptional } from '../i18n';
import type { MapDef } from '../sim/map';
import type { QuestBook, QuestDef, QuestEvent } from '../sim/quests';
import {
  MEDALS,
  type Medal,
  type MedalRank,
  courseOf,
  gateMid,
  medalOf,
  medalTimes,
  pennantFor,
  seriesById,
} from '../sim/regatta';
import { SHIP_CLASSES } from '../sim/ship';
import { character, firstName } from './portraits';
import { type ClubBoard, CLUB_PORT, clubBoard } from './clubBoard';
import { type QuestCardModel, cardFor } from './questView';

/*
 * What the Saltmere Regatta shows (decision 0217), read from the quest engine like the quest
 * cards: the race's line in the course pill, the medal times on its offer, the result card with
 * "Race again", and the regatta book on the Quay. Words: `regatta.*`, and each race's
 * `<text>.race.title` / `.copy` (Wren's offer) and `<text>.race.start` (the starter at the line).
 */

/** A name that opens a sentence: "the Saltmere pennant" → "The Saltmere pennant". */
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type RaceEvent = Extract<QuestEvent, { type: 'raced' }>;

/** A race time, "1:02.4". */
export function raceClock(sec: number): string {
  const tenths = Math.max(0, Math.round(sec * 10));
  const m = Math.floor(tenths / 600);
  const s = (tenths % 600) / 10;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

/** What a race card shows besides the person's words (decision 0217). */
export interface RaceCardInfo {
  /** This ship's medal times on this level, gold first, and the gold each pays the first time. */
  times: { medal: Medal; sec: number; gold: number; won: boolean }[];
  /** The record: best time, seconds, and best medal. */
  best?: number;
  medal?: MedalRank;
  /** Just finished: the time, the medal and Kestrel's time if she finished first. */
  result?: { sec: number; medal: MedalRank; rival?: number; gold: number };
  /** "Race again" on the card. */
  again: boolean;
  /** "Medal times for your sloop". */
  label: string;
  /** The race's series, "The Saltmere Regatta", on the card's arc line. */
  series: string;
  /** An entry of the regatta book on the Quay. */
  book?: boolean;
  /** The Sailing Club's board on the Quay (decision 0226): the card shows it instead. */
  board?: ClubBoard;
}

export function raceInfo(book: QuestBook, quest: QuestDef, again = false): RaceCardInfo {
  const race = quest.race!;
  const { activeShip } = book.world.trade.captain;
  const times = medalTimes(race, activeShip, book.world.trade.difficulty);
  const p = book.progress(quest.id);
  const had = p?.medal ?? 0;
  const ship = SHIP_CLASSES[activeShip];
  return {
    times: [...MEDALS].reverse().map((m, i) => ({
      medal: m,
      sec: times[m],
      gold: had >= 3 - i ? 0 : (race.gold[m] ?? 0),
      won: had >= 3 - i,
    })),
    ...(p?.best !== undefined ? { best: p.best / 100 } : {}),
    ...(had ? { medal: had as MedalRank } : {}),
    again,
    label: t('regatta.times', { ship: ship ? shipName(ship) : activeShip }),
    series: seriesName(race.series),
  };
}

/**
 * The result card (decision 0217): Wren's line for the medal (two lines each, by the time's last
 * digit), the time against Kestrel's, the new best, a series won and its pennant, "Race again".
 */
export function raceResultCard(book: QuestBook, map: MapDef, e: RaceEvent): QuestCardModel | null {
  const quest = book.quests.find((q) => q.id === e.quest);
  const card = quest && cardFor(book, map, e.quest, 'finished');
  if (!quest || !card) return null;
  const m = medalOf(e.medal) ?? 'none';
  const line = Math.round(e.sec * 10) % 2 ? 'line2' : 'line1';
  const won = e.won.map((s) => t(`regatta.won.${s}` as MessageKey));
  // A series with a prize ship (decision 0228): Wren's gift after her line, the toast in the news.
  const gifts = e.won.map((s) => tOptional(`regatta.gift.${s}`)).filter(Boolean);
  const toasts = e.won.map((s) => tOptional(`regatta.gift.${s}.toast`)).filter(Boolean);
  const news = [
    e.best && !e.first ? t('regatta.newBest') : '',
    ...e.won.map((s) =>
      s === 'regatta-cup'
        ? t('regatta.cupSet')
        : t('regatta.pennantFlies', { pennant: capital(t(`regatta.pennant.${s}` as MessageKey)) }),
    ),
    ...toasts,
  ].filter(Boolean);
  Object.assign(card, {
    mood: 'pleased',
    ask: t(`regatta.result.${m}.title` as MessageKey),
    speech: [
      won.at(-1) ?? t(`regatta.result.${m}.${line}` as MessageKey),
      ...gifts,
      tOptional(`${quest.text}.race.done`),
    ]
      .filter(Boolean)
      .join(' '),
    news: news.join(' ') || undefined,
    reward: e.gold ? { gold: e.gold, more: [] } : undefined,
  });
  card.race = {
    ...raceInfo(book, quest, true),
    result: {
      sec: e.sec,
      medal: e.medal,
      gold: e.gold,
      ...(e.rival !== undefined ? { rival: e.rival } : {}),
    },
  };
  return card;
}

/**
 * The regatta book on the Quay (decision 0217): each race of this harbour finished before, with
 * its record and "Race again"; at Saltmere, Rook's line for the Cup once it is won.
 */
export function raceBookCards(book: QuestBook, map: MapDef, docked: string | null) {
  if (!docked) return [];
  const busy = !!book.race();
  const out = clubBoardCard(book, map, docked);
  for (const quest of book.raced) {
    if (book.portOf(quest.id, quest.port) !== docked) continue;
    const card = cardFor(book, map, quest.id, 'finished');
    if (!card) continue;
    card.mood = 'neutral';
    card.ask = tOptional(`${quest.text}.race.title`);
    card.speech = undefined;
    card.race = { ...raceInfo(book, quest, !busy && !book.lesson), book: true };
    if (quest.race!.series === 'regatta-cup' && book.won.includes('regatta-cup'))
      card.speech = t('regatta.cupBook');
    out.push(card);
  }
  return out;
}

/** Wren's club board for the Quay of Saltmere, from the first club race on offer (0226). */
function clubBoardCard(book: QuestBook, map: MapDef, docked: string): QuestCardModel[] {
  const board = clubBoard(book, docked);
  const base = board && book.quests.find((q) => q.race && q.port === CLUB_PORT);
  const card = base && cardFor(book, map, base.id, 'finished');
  if (!board || !card) return [];
  Object.assign(card, { mood: 'neutral', ask: undefined, speech: undefined });
  card.race = { ...raceInfo(book, base, false), board };
  return [card];
}

/**
 * The race's line in the course pill (decision 0217): "Horn in 7", the next mark, the clock once
 * the horn has gone; `short` for a phone held upright ("1/3", "Finish").
 */
export function raceHud(
  book: QuestBook,
): { label: string; short: string; sec: number | null } | null {
  const race = book.race();
  if (!race || race.state === 'finished') return null;
  if (race.state === 'sequence') {
    const label = t('regatta.horn', { n: Math.ceil(race.left) });
    return { label, short: label, sec: null };
  }
  const total = race.course.marks.length;
  const n = race.rounded + 1;
  if (!race.started)
    return { label: t('regatta.toStart'), short: t('regatta.shortStart'), sec: race.sec };
  if (race.rounded < total)
    return { label: t('regatta.toMark', { n, total }), short: `${n}/${total}`, sec: race.sec };
  return { label: t('regatta.toFinish'), short: t('regatta.shortFinish'), sec: race.sec };
}

/** Where the race leads now: the start line's middle, the next mark, the finish line's middle. */
export function raceNext(book: QuestBook): { x: number; y: number } | null {
  const race = book.race();
  if (!race) return null;
  const { course } = race;
  if (!race.started) return gateMid(course.start);
  return course.marks[race.rounded] ?? gateMid(course.finish);
}

/** The starter's line at the race's start, "Rook: On the horn, captain." */
export function starterLine(quest: QuestDef): string | undefined {
  const line = tOptional(`${quest.text}.race.start`);
  if (!line) return undefined;
  const who = quest.starter ? character(quest.starter) : undefined;
  return who ? `${firstName(who.name)}: ${line}` : line;
}

/** The pennant the captain flies, the latest series won (decision 0217). */
export const flownPennant = (book: QuestBook) => pennantFor(book.won);

/** A series' name, "The Saltmere Regatta". */
export const seriesName = (id: string) =>
  tOptional(`regatta.series.${id}`) ?? seriesById(id)?.name ?? id;

/** The course of a race quest, for the chart and the builder. */
export const raceCourse = (quest: QuestDef) => courseOf(quest.steps[0]?.goal);
