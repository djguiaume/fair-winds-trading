import { formatNumber, t, tOptional } from '../i18n';
import { type GoodId } from '../sim/goods';
import type { MapDef } from '../sim/map';
import { deref, type StepNews } from '../sim/questLibrary';
import { QUEST_DONE, type QuestBook, type QuestDef, lastRoundStep, roundStep } from '../sim/quests';
import { quoteHandOver } from '../sim/trade';
import { type Character, type Mood, MOODS, character } from './portraits';
import { lineNumber, mainLine } from './questLine';
import { type RaceCardInfo, raceInfo } from './regattaView';
import {
  goodOf,
  arcName,
  newsLine,
  cardPort,
  roleLine,
  stepParams,
  rewardWords,
  stepWhere,
  stepProgress,
} from './questWords';

/*
 * What the quest card, the journal and the chart show (decision 0124), read from the quest
 * engine (0125) and the quest files. Plain data, so it is tested without a page. Text comes from
 * the quest's keys: `<text>.name` (the arc), `<text>.<step>.copy` (what the giver says),
 * `<text>.<step>.title` (the ask), `<text>.<step>.<option>.title` / `.copy` (a choice) and
 * `<text>.done.copy` (the thanks). A key nobody wrote is left out.
 *
 * Where each part lives: the cards and the Quay tab here, the words in `questWords.ts`, the journal
 * in `questJournal.ts`, chart pins and sea markers in `questPlaces.ts`, the lesson bubble in
 * `questLesson.ts`. This file passes them all on.
 */

export * from './questWords';
export * from './questJournal';
export * from './questPlaces';
export * from './questLesson';

export type CardKind = 'offer' | 'step' | 'choice' | 'finished';

/** What kind of message a card is, said on its tag (decision 0141). */
export type CardTag = 'new' | 'next' | 'done';
export const cardTag = (kind: CardKind): CardTag =>
  kind === 'offer' ? 'new' : kind === 'finished' ? 'done' : 'next';

export interface QuestCardModel {
  quest: string;
  kind: CardKind;
  giver?: Character;
  mood: Mood;
  look?: string;
  /** The giver's role and port, "Harbourmaster · Saltmere". */
  role?: string;
  /** The arc's name. */
  arc: string;
  stepNo: number;
  steps: number;
  speech?: string;
  ask?: string;
  /** "4 / 12" while goods are handed over. */
  progress?: string;
  /** The good the ask is about, for its icon. */
  good?: string;
  options?: { id: string; title: string; copy?: string }[];
  /** A story quest (`main`): its card greets the captain before the harbour screen (0141). */
  main: boolean;
  /** Where the ask happens, "3 places, marked on the chart". */
  where?: string;
  /** What the ask pays: gold, and the rest in words ("a building for your island"). */
  reward?: { gold: number; more: string[] };
  /** Steps after this one, on an offer: "then 2 more steps". */
  moreSteps?: number;
  /** A standing order's ask (decision 0214): its number, shown instead of the steps. */
  round?: number;
  /**
   * What just happened for this quest where the boat is (decision 0213): "1 millstone aboard for
   * Maren, 1 left on the quay…", or "Done! +150 gold." for the step finished here.
   */
  news?: string;
  /**
   * Goods this person wants here and the hold has (decision 0213): the card hands them over,
   * paid at the market price, instead of sending the captain to the market.
   */
  handOver?: { good: GoodId; n: number; gold: number };
  /**
   * A plot's card at the captain's island (decision 0210): the giver by their stake, with its own
   * tag and no arc line; the arrival button opens the Island tab on this plot.
   */
  plot?: { island: string; spot: string };
  /** A race of the regatta (decision 0217): its medal times, record and result. */
  race?: RaceCardInfo;
}

const isMood = (m: unknown): m is Mood => MOODS.includes(m as Mood);

export function cardFor(
  book: QuestBook,
  map: MapDef,
  questId: string,
  kind: CardKind,
): QuestCardModel | null {
  const quest = book.quests.find((q) => q.id === questId);
  if (!quest) return null;
  const p = book.progress(questId);
  const step =
    kind === 'offer'
      ? roundStep(quest, p)
      : kind === 'finished'
        ? undefined
        : quest.steps.find((s) => s.id === p?.step);
  if (kind !== 'finished' && !step) return null;
  // A standing order thanks for the ask just delivered, in its own words (decision 0214).
  const last = kind === 'finished' ? lastRoundStep(quest, p) : undefined;
  // A step's `speaker` talks on its card instead of the giver, and `doneSpeaker` on the done card.
  const who = step ? (step.speaker ?? quest.giver) : (quest.doneSpeaker ?? quest.giver);
  const giver = who ? character(who) : undefined;
  const key = `${quest.text}.${step?.id ?? QUEST_DONE}`;
  // A card counts the steps along the quest's main line, as a lesson's bubble does (decision
  // 0185); a step off it (Rook's offer to a stranger, 0190) counts as the step that leads there.
  const line = mainLine(quest);
  const card: QuestCardModel = {
    quest: quest.id,
    kind,
    giver,
    mood: kind === 'finished' ? 'pleased' : isMood(step?.mood) ? step.mood : 'neutral',
    look: step?.look,
    role: roleLine(map, giver),
    arc: arcName(quest),
    stepNo: step ? lineNumber(quest, step.id) : line.length,
    steps: line.length,
    speech: last
      ? tOptional(`${quest.text}.${last.id}.thanks`)
      : tOptional(`${key}.copy`, stepParams(book, step, quest)),
    ask: last
      ? tOptional(`${quest.text}.${last.id}.title`)
      : tOptional(`${key}.title`, stepParams(book, step, quest)),
    // A standing order's ask never says how many in words: its offer shows the count (0214).
    progress:
      kind === 'step' || (kind === 'offer' && quest.repeat)
        ? stepProgress(step?.goal, kind === 'step' ? (p?.counts ?? []) : [])
        : undefined,
    good: goodOf(deref(step?.goal?.good, p?.vars)),
    main: !!quest.main,
  };
  if (quest.repeat) {
    card.round = (p?.rounds ?? 0) + (kind === 'finished' ? 0 : 1);
    if (last) card.good = goodOf(last.goal?.good);
  }
  if (kind === 'offer' || kind === 'step') {
    card.where = stepWhere(step);
    const end = step === quest.steps.at(-1) && !quest.repeat;
    card.reward = rewardWords(map, [step?.reward, end ? quest.reward : undefined]);
    // A step paid like a help order says what it pays now (decision 0214).
    const order = book.orderGold(step);
    if (order !== undefined) card.reward = { gold: order, more: card.reward?.more ?? [] };
    if (kind === 'offer' && quest.steps.length > 1 && !quest.repeat)
      card.moreSteps = quest.steps.length - 1;
  }
  // A race's offer shows its medal times and what each pays the first time (decision 0217).
  if (quest.race && kind === 'offer') {
    Object.assign(card, { reward: undefined, race: raceInfo(book, quest) });
  }
  if (kind === 'choice')
    card.options = book.options(quest.id).map((o) => ({
      id: o.id,
      title: tOptional(`${key}.${o.id}.title`) ?? o.id,
      copy: tOptional(`${key}.${o.id}.copy`),
    }));
  return card;
}

/**
 * The card to show now, if any: an offer at its port, a step (or choice) not seen yet where it
 * happens, or the thanks for a finished quest. `seen` holds `<quest>:<step>` keys already shown;
 * `finished` the quests whose thanks are waiting. `only` keeps the quests it holds for (the main
 * ones, for the arrival card, decision 0141).
 */
export function dueCard(
  book: QuestBook,
  map: MapDef,
  docked: string | null,
  seen: ReadonlySet<string>,
  finished: ReadonlySet<string>,
  only: (quest: QuestDef) => boolean = () => true,
): { quest: string; kind: CardKind } | null {
  for (const id of finished) {
    const quest = book.quests.find((q) => q.id === id);
    if (!quest || !only(quest)) continue;
    const port = cardPort(map, quest);
    if (!port || port === docked) return { quest: id, kind: 'finished' };
  }
  for (const { quest, step } of book.active) {
    if (!only(quest) || seen.has(`${quest.id}:${step.id}`)) continue;
    const port = cardPort(map, quest, step);
    if (!port || port === docked) return { quest: quest.id, kind: step.choose ? 'choice' : 'step' };
  }
  if (docked)
    for (const quest of book.offered)
      if (only(quest) && !seen.has(`${quest.id}:offer`) && cardPort(map, quest) === docked)
        return { quest: quest.id, kind: 'offer' };
  return null;
}

/** One person on the Quay tab (decision 0141): their card, and whether it is news this call. */
export interface QuayItem {
  /** The `seen` key: `<quest>:<step>`, `<quest>:offer` or `<quest>:done`. */
  key: string;
  card: QuestCardModel;
  fresh: boolean;
  /**
   * The `seen` key of the card's dock news (decision 0213), `news:<quest>:<step>@<port>:<line>`:
   * the same news is told once, new news (more aboard, more handed over) again.
   */
  newsKey?: string;
}

/**
 * The harbour screen's Quay tab (decision 0141): everyone in this harbour with something to say,
 * other than the main quests' arrival cards. The thanks first, then the steps under way here, then
 * the offers; `fresh` ones count on the tab's badge until the tab is seen.
 *
 * Every stop of a started quest speaks here too (decision 0213): where its cargo is loaded or
 * unloaded, or its goods handed over, the step's card is listed with its dock news on top, and
 * `paid` (quest → gold, for steps done during this call) tops the next card with "Done! +150 gold".
 */
export function quayItems(
  book: QuestBook,
  map: MapDef,
  docked: string | null,
  seen: ReadonlySet<string>,
  finished: ReadonlySet<string>,
  paid: ReadonlyMap<string, number> = new Map(),
): QuayItem[] {
  if (!docked) return [];
  const out: QuayItem[] = [];
  const add = (quest: QuestDef, kind: CardKind, key: string, news?: string, hand?: StepNews) => {
    const card = cardFor(book, map, quest.id, kind);
    if (!card) return;
    const gold = paid.get(quest.id);
    const done = gold ? t('quest.news.paid', { gold: formatNumber(gold) }) : undefined;
    card.news = [done, news].filter(Boolean).join(' ') || undefined;
    const n = hand?.good ? Math.min(hand.left, book.world.trade.captain.cargo[hand.good]) : 0;
    const pay = n > 0 ? quoteHandOver(book.world.trade, hand!.good!, n) : null;
    if (pay !== null) card.handOver = { good: hand!.good!, n, gold: pay };
    const newsKey = card.news ? `news:${key}@${docked}:${card.news}` : undefined;
    const fresh = !seen.has(key) || (newsKey !== undefined && !seen.has(newsKey));
    out.push({ key, card, fresh, ...(newsKey ? { newsKey } : {}) });
  };
  for (const id of finished) {
    const quest = book.quests.find((q) => q.id === id);
    if (quest && !quest.main && (cardPort(map, quest) ?? docked) === docked)
      add(quest, 'finished', `${id}:done`);
  }
  const news = book.news();
  for (const { quest, step } of book.active) {
    if (quest.main) continue;
    const key = `${quest.id}:${step.id}`;
    const port = cardPort(map, quest, step);
    const here = news.filter((n) => n.quest === quest.id);
    if (port === docked || (!port && !seen.has(key)) || here.length || paid.has(quest.id))
      add(
        quest,
        step.choose ? 'choice' : 'step',
        key,
        here.map((n) => newsLine(book, map, n)).join(' ') || undefined,
        here.find((n) => n.kind === 'handHere'),
      );
  }
  for (const quest of book.offered)
    if (!quest.main && cardPort(map, quest) === docked) add(quest, 'offer', `${quest.id}:offer`);
  return out;
}
