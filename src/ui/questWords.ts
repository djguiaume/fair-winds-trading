import { type MessageKey, formatNumber, goodMany, goodSome, goodThe, t, tOptional } from '../i18n';
import { isGood, type GoodId } from '../sim/goods';
import type { MapDef } from '../sim/map';
import { type Condition, resolvePort, type StepNews } from '../sim/questLibrary';
import type { QuestReward } from '../sim/questRewards';
import { type QuestBook, type QuestDef, type QuestStep } from '../sim/quests';
import { BUILDINGS, homeSpots, resolveSpot } from '../sim/home';
import { isDiscovered } from '../sim/shipyards';
import { findPort } from '../sim/trade';
import { type Character, character } from './portraits';

/* The quests in the captain's words (decision 0124): names, places, news, pars and rewards. */

/** A good parameter, if it names one. */
export const goodOf = (g: unknown): GoodId | undefined => (isGood(g) ? g : undefined);

export function arcName(quest: QuestDef): string {
  return tOptional(`${quest.text}.name`) ?? quest.name;
}

export function portName(map: MapDef, id: string | undefined): string | undefined {
  const port = resolvePort(map, id);
  return port ? (findPort(map, port)?.name ?? port) : undefined;
}

/** A person's short name in news lines: their `short`, else their first word ("Maren"). */
export function shortName(c: Character | undefined): string {
  return c ? (c.short ?? c.name.split(' ')[0]!) : '';
}

/** A dock news place: a port's name, or "the mark on the chart" for a spot at sea. */
function placeName(map: MapDef, place: string | undefined): string {
  if (!place) return '';
  return place === 'spot' ? t('quest.news.spot') : (portName(map, place) ?? place);
}

/**
 * Dock news in words (decision 0213): the line `quest.news.<kind>` with the quest's person, its
 * cargo's name in the right form (`quest.item.<id>.one|many|the|own|unloadedOne|unloadedMany`,
 * or a passenger's name) and the places.
 */
export function newsLine(book: QuestBook, map: MapDef, news: StepNews & { quest: string }): string {
  const quest = book.quests.find((q) => q.id === news.quest);
  const who = shortName(quest?.giver ? character(quest.giver) : undefined);
  const person = news.item ? character(news.item) : undefined;
  const form = (f: string) =>
    person && quest?.items?.[news.item!]?.space === 0
      ? shortName(person)
      : (tOptional(`quest.item.${news.item}.${f}`) ?? news.item ?? '');
  const count = news.n;
  let item: string;
  if (news.good) item = goodMany(news.good);
  else if (news.kind === 'noRoom') item = form('own');
  else if (news.kind === 'nothingAboard' || news.kind === 'loadedOne') item = form('the');
  else if (news.kind === 'loadedPassenger') item = form('the');
  else item = form(count === 1 ? 'one' : 'many');
  const line = t(`quest.news.${news.kind}` as MessageKey, {
    who,
    item,
    good: item,
    n: formatNumber(news.n),
    left: formatNumber(news.left),
    done: formatNumber(news.done),
    total: formatNumber(news.total),
    space: formatNumber(news.space),
    to: placeName(map, news.to),
    from: placeName(map, news.from),
    par: news.par === undefined ? '' : parClock(news.par),
    unloaded: form(count === 1 ? 'unloadedOne' : 'unloadedMany'),
  });
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/**
 * Quest cargo in the hold lists (decision 0213): "Maren’s millstones: 1 (6 space)", a passenger
 * "Pip, passenger".
 */
export function cargoLines(book: QuestBook): string[] {
  return book.cargo().map(({ quest: id, item, n, space }) => {
    const quest = book.quests.find((q) => q.id === id);
    const who = shortName(quest?.giver ? character(quest.giver) : undefined);
    if (quest?.items?.[item]?.space === 0)
      return t('quest.cargoPassenger', { item: shortName(character(item)) || item });
    const line = t('quest.cargoLine', {
      who,
      item: tOptional(`quest.item.${item}.own`) ?? item,
      n: formatNumber(n),
      space: formatNumber(space),
    });
    return line.charAt(0).toUpperCase() + line.slice(1);
  });
}

/** Where a quest's card shows: the step's port, else the quest's. */
export function cardPort(map: MapDef, quest: QuestDef, step?: QuestStep): string | null {
  return resolvePort(map, step?.port ?? quest.port);
}

export function roleLine(map: MapDef, giver: Character | undefined): string | undefined {
  if (!giver) return undefined;
  const role = tOptional(`character.${giver.id}.role`) ?? giver.role;
  const port = portName(map, giver.port);
  return port ? `${role} · ${port}` : role;
}

/** A run's par as a clock, "2:20". */
export function parClock(secs: number): string {
  const s = Math.round(secs);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * What a step's title and copy can name: `{par}`, its timed run's par for the voyage's level; and
 * with its quest, the quest's vars (decision 0151): `{name}` (the port's name, or "the fish"),
 * `{nameMakes}` for a port (what it makes, "some fish") and `{nameBuyer}` for a good (the line
 * `<text>.nameBuyer` naming a charted port that wants it, or nothing). An unset var reads
 * `<text>.var.<name>` ("your chosen port"). A quest that gives a plot on the captain's island
 * (`homeSpot`) names its two buildings, `{spotA}` and `{spotB}` ("a warehouse", "l’entrepôt",
 * decision 0210).
 */
export function stepParams(
  book: QuestBook,
  step: QuestStep | undefined,
  quest?: QuestDef,
): Record<string, string> {
  const par = book.parSeconds(step);
  const out: Record<string, string> = par === undefined ? {} : { par: parClock(par) };
  if (quest) Object.assign(out, plotParams(book.map, quest));
  if (!quest?.vars) return out;
  const map = book.map;
  const unset = (name: string) => tOptional(`${quest.text}.var.${name}`) ?? '';
  for (const [name, kind] of Object.entries(quest.vars)) {
    const value = book.varOf(quest.id, name);
    if (kind === 'port') {
      out[name] = (value && findPort(map, value)?.name) || unset(name);
      const makes = value ? findPort(map, value)?.produces[0] : undefined;
      out[`${name}Makes`] = makes ? goodSome(makes) : unset(`${name}Makes`);
    } else {
      out[name] = isGood(value) ? goodThe(value) : unset(name);
      const buyer = isGood(value) ? buyerOf(book, value) : null;
      out[`${name}Buyer`] = buyer
        ? (tOptional(`${quest.text}.${name}Buyer`, { name: buyer.name, cargo: out[name]! }) ?? '')
        : '';
    }
  }
  return out;
}

/** The plot a quest gives on one of the captain's islands (its reward's first `homeSpot`). */
export function questPlot(map: MapDef, quest: QuestDef): { island: string; spot: string } | null {
  const ref = (quest.reward as { homeSpot?: unknown } | undefined)?.homeSpot;
  return resolveSpot(map, Array.isArray(ref) ? ref[0] : ref);
}

/** The quest that gives a plot, if any (decision 0210): whose plot it is. */
export function plotQuest(
  quests: readonly QuestDef[],
  map: MapDef,
  island: string,
  spot: string,
): QuestDef | undefined {
  return quests.find((q) => {
    const plot = questPlot(map, q);
    return plot?.island === island && plot.spot === spot;
  });
}

/** `{spotA}` and `{spotB}`: the two buildings of a plot's pair, with their article. */
export function plotParams(map: MapDef, quest: QuestDef): Record<string, string> {
  const plot = questPlot(map, quest);
  const pair = plot && homeSpots(map, plot.island).find((s) => s.id === plot.spot)?.pair;
  if (!pair) return {};
  const [a, b] = BUILDINGS.filter((x) => x.pair === pair).map((x) =>
    t(`building.${x.id}.a` as MessageKey),
  );
  return { spotA: a ?? '', spotB: b ?? '' };
}

/** A charted harbour that wants `good`, other than the one alongside, for lesson hints. */
export function buyerOf(book: QuestBook, good: GoodId) {
  const { trade } = book.world;
  return book.map.ports.find(
    (p) => p.id !== trade.dockedAt && p.wants.includes(good) && isDiscovered(trade, p.id),
  );
}

/** A reward in the card's words: its gold, and the rest ("a building for your island"). */
export function rewardWords(
  map: MapDef,
  rewards: (QuestReward | undefined)[],
): { gold: number; more: string[] } | undefined {
  let gold = 0;
  const more: string[] = [];
  for (const r of rewards) {
    if (!r) continue;
    gold += r.gold ?? 0;
    if (r.homeIsland) more.push(t('quest.rewardIsland'));
    if (r.homeSpot?.length) more.push(t('quest.rewardBuilding'));
    if (r.ship) more.push(t('quest.rewardShip', { name: tOptional(`ship.${r.ship}`) ?? r.ship }));
    const at = (key: MessageKey, ids: string[] = []) =>
      ids.map((id) => t(key, { name: portName(map, id) ?? id }));
    more.push(...at('quest.rewardGrows', r.levelUp), ...at('quest.rewardDiscover', r.discover));
    more.push(...at('quest.rewardFound', r.found));
  }
  return gold || more.length ? { gold, more } : undefined;
}

/** Where a step's ask happens, when the chart shows it: its markers, or its rough circle. */
export function stepWhere(step: QuestStep | undefined): string | undefined {
  const goal = step?.goal;
  const points = goal?.is === 'reach' && Array.isArray(goal.points) ? goal.points.length : 0;
  if (points > 1) return t('quest.whereMarks', { n: points });
  if (points || step?.chart || step?.compass) return t('quest.whereChart');
  return undefined;
}

/** "4 / 12" for a step that counts goods or quest cargo; nothing for the others. */
export function stepProgress(goal: Condition | undefined, counts: readonly number[]) {
  if (goal?.is === 'reach' && Array.isArray(goal.points)) {
    // Markers reached: a count in order, else one bit each.
    const s = counts[0] ?? 0;
    const n = goal.order === 'in-order' ? s : s.toString(2).replace(/0/g, '').length;
    return `${n} / ${goal.points.length}`;
  }
  // Founding goods (decision 0157): several goods landed count as one load.
  const of = goal?.is === 'all' && Array.isArray(goal.of) ? (goal.of as Condition[]) : [];
  if (of.length && of.every((c) => c.is === 'landed' && typeof c.qty === 'number')) {
    const landed = of.reduce((n, _c, i) => n + (counts[i * 2] ?? 0), 0);
    return `${landed} / ${of.reduce((n, c) => n + (c.qty as number), 0)}`;
  }
  const qty = typeof goal?.qty === 'number' ? goal.qty : null;
  if (qty === null) return undefined;
  if (goal!.is === 'delivered' || goal!.is === 'landed') return `${counts[0] ?? 0} / ${qty}`;
  if (goal!.is === 'carried') return `${counts[1] ?? 0} / ${qty}`;
  return undefined;
}
