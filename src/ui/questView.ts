import { goodSome, goodThe, t, tOptional } from '../i18n';
import { isGood, type GoodId } from '../sim/goods';
import type { MapDef } from '../sim/map';
import {
  CONDITIONS,
  type Condition,
  type QuestPoint,
  type QuestReward,
  deref,
  isSpot,
  pointOf,
  resolvePort,
  slotLayout,
} from '../sim/questLibrary';
import {
  type CoachTarget,
  QUEST_DONE,
  type QuestBook,
  type QuestDef,
  type QuestStep,
} from '../sim/quests';
import { isDiscovered } from '../sim/shipyards';
import { findPort } from '../sim/trade';
import { type Character, type Mood, MOODS, character } from './portraits';

/*
 * What the quest card, the journal and the chart show (decision 0124), read from the quest
 * engine (0125) and the quest files. Plain data, so it is tested without a page. Text comes from
 * the quest's keys: `<text>.name` (the arc), `<text>.<step>.copy` (what the giver says),
 * `<text>.<step>.title` (the ask), `<text>.<step>.<option>.title` / `.copy` (a choice) and
 * `<text>.done.copy` (the thanks). A key nobody wrote is left out.
 */

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
}

const isMood = (m: unknown): m is Mood => MOODS.includes(m as Mood);
const goodOf = (g: unknown): GoodId | undefined => (isGood(g) ? g : undefined);

export function arcName(quest: QuestDef): string {
  return tOptional(`${quest.text}.name`) ?? quest.name;
}

export function portName(map: MapDef, id: string | undefined): string | undefined {
  const port = resolvePort(map, id);
  return port ? (findPort(map, port)?.name ?? port) : undefined;
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
 * `<text>.var.<name>` ("your chosen port").
 */
export function stepParams(
  book: QuestBook,
  step: QuestStep | undefined,
  quest?: QuestDef,
): Record<string, string> {
  const par = book.parSeconds(step);
  const out: Record<string, string> = par === undefined ? {} : { par: parClock(par) };
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
    for (const id of r.levelUp ?? [])
      more.push(t('quest.rewardGrows', { name: portName(map, id) ?? id }));
    for (const id of r.discover ?? [])
      more.push(t('quest.rewardDiscover', { name: portName(map, id) ?? id }));
    for (const id of r.found ?? [])
      more.push(t('quest.rewardFound', { name: portName(map, id) ?? id }));
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
      ? quest.steps[0]
      : kind === 'finished'
        ? undefined
        : quest.steps.find((s) => s.id === p?.step);
  if (kind !== 'finished' && !step) return null;
  // A step's `speaker` talks on its card instead of the giver, and `doneSpeaker` on the done card.
  const who = step ? (step.speaker ?? quest.giver) : (quest.doneSpeaker ?? quest.giver);
  const giver = who ? character(who) : undefined;
  const key = `${quest.text}.${step?.id ?? QUEST_DONE}`;
  const card: QuestCardModel = {
    quest: quest.id,
    kind,
    giver,
    mood: kind === 'finished' ? 'pleased' : isMood(step?.mood) ? step.mood : 'neutral',
    look: step?.look,
    role: roleLine(map, giver),
    arc: arcName(quest),
    stepNo: step ? quest.steps.indexOf(step) + 1 : quest.steps.length,
    steps: quest.steps.length,
    speech: tOptional(`${key}.copy`, stepParams(book, step, quest)),
    ask: tOptional(`${key}.title`, stepParams(book, step, quest)),
    progress: kind === 'step' ? stepProgress(step?.goal, p?.counts ?? []) : undefined,
    good: goodOf(deref(step?.goal?.good, p?.vars)),
    main: !!quest.main,
  };
  if (kind === 'offer' || kind === 'step') {
    card.where = stepWhere(step);
    const last = step === quest.steps.at(-1);
    card.reward = rewardWords(map, [step?.reward, last ? quest.reward : undefined]);
    if (kind === 'offer' && quest.steps.length > 1) card.moreSteps = quest.steps.length - 1;
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
}

/**
 * The harbour screen's Quay tab (decision 0141): everyone in this harbour with something to say,
 * other than the main quests' arrival cards. The thanks first, then the steps under way here, then
 * the offers; `fresh` ones count on the tab's badge until the tab is seen.
 */
export function quayItems(
  book: QuestBook,
  map: MapDef,
  docked: string | null,
  seen: ReadonlySet<string>,
  finished: ReadonlySet<string>,
): QuayItem[] {
  if (!docked) return [];
  const out: QuayItem[] = [];
  const add = (quest: QuestDef, kind: CardKind, key: string) => {
    const card = cardFor(book, map, quest.id, kind);
    if (card) out.push({ key, card, fresh: !seen.has(key) });
  };
  for (const id of finished) {
    const quest = book.quests.find((q) => q.id === id);
    if (quest && !quest.main && (cardPort(map, quest) ?? docked) === docked)
      add(quest, 'finished', `${id}:done`);
  }
  for (const { quest, step } of book.active) {
    if (quest.main) continue;
    const key = `${quest.id}:${step.id}`;
    const port = cardPort(map, quest, step);
    if (port === docked || (!port && !seen.has(key)))
      add(quest, step.choose ? 'choice' : 'step', key);
  }
  for (const quest of book.offered)
    if (!quest.main && cardPort(map, quest) === docked) add(quest, 'offer', `${quest.id}:offer`);
  return out;
}

export interface JournalStep {
  title: string;
  state: 'done' | 'now' | 'later';
  progress?: string;
}

export interface JournalEntry {
  quest: string;
  giver?: Character;
  /** "Rook · Saltmere". */
  who?: string;
  arc: string;
  /** `ignored`: an offer the captain said "don't offer again" to (decision 0141). */
  state: 'tracked' | 'active' | 'offered' | 'ignored' | 'done';
  stepNo: number;
  steps: number;
  /** The tracked quest's steps: done ones, the one now, and one line for what is still hidden. */
  lines: JournalStep[];
  /** The options picked, for a finished quest. */
  chose: string[];
}

/** The journal: the tracked quest first, then the other started ones, offers, then done ones. */
export function journal(book: QuestBook, map: MapDef): JournalEntry[] {
  const out: JournalEntry[] = [];
  const base = (quest: QuestDef) => {
    const giver = quest.giver ? character(quest.giver) : undefined;
    const port = portName(map, giver?.port ?? quest.port);
    return {
      quest: quest.id,
      giver,
      who: giver ? (port ? `${giver.name} · ${port}` : giver.name) : port,
      arc: arcName(quest),
      steps: quest.steps.length,
      lines: [] as JournalStep[],
      chose: [] as string[],
    };
  };
  for (const { quest, step } of book.active) {
    const i = quest.steps.indexOf(step);
    const tracked = book.tracked === quest.id;
    const entry: JournalEntry = {
      ...base(quest),
      state: tracked ? 'tracked' : 'active',
      stepNo: i + 1,
    };
    if (tracked) {
      const p = book.progress(quest.id);
      const title = (s: QuestStep) =>
        tOptional(`${quest.text}.${s.id}.title`, stepParams(book, s, quest)) ?? s.id;
      for (const s of quest.steps.slice(0, i)) entry.lines.push({ title: title(s), state: 'done' });
      entry.lines.push({
        title: title(step),
        state: 'now',
        progress: stepProgress(step.goal, p?.counts ?? []),
      });
      if (i < quest.steps.length - 1) entry.lines.push({ title: '', state: 'later' });
    }
    if (tracked) out.unshift(entry);
    else out.push(entry);
  }
  for (const quest of book.offered) out.push({ ...base(quest), state: 'offered', stepNo: 0 });
  for (const quest of book.ignoredOffers) out.push({ ...base(quest), state: 'ignored', stepNo: 0 });
  for (const quest of book.quests) {
    const p = book.progress(quest.id);
    if (p?.step !== QUEST_DONE) continue;
    const entry: JournalEntry = { ...base(quest), state: 'done', stepNo: quest.steps.length };
    for (const [step, option] of Object.entries(p.chose))
      entry.chose.push(tOptional(`${quest.text}.${step}.${option}.title`) ?? option);
    out.push(entry);
  }
  return out;
}

export interface QuestPin {
  port: string;
  giver: Character;
  /** Something new to ask or to see. */
  alert: boolean;
  tracked: boolean;
}

/** A face on each port where someone has a started or offered quest (one per port). */
export function questPins(book: QuestBook, map: MapDef, seen: ReadonlySet<string>): QuestPin[] {
  const pins = new Map<string, QuestPin>();
  const add = (quest: QuestDef, alert: boolean, tracked: boolean) => {
    const giver = quest.giver ? character(quest.giver) : undefined;
    const port = resolvePort(map, giver?.port ?? quest.port);
    if (!giver || !port) return;
    const was = pins.get(port);
    pins.set(port, {
      port,
      giver: was && !tracked ? was.giver : giver,
      alert: alert || !!was?.alert,
      tracked: tracked || !!was?.tracked,
    });
  };
  for (const { quest, step } of book.active)
    add(quest, !seen.has(`${quest.id}:${step.id}`), book.tracked === quest.id);
  for (const quest of book.offered) add(quest, true, false);
  return [...pins.values()];
}

/** Where the tracked step leads on the chart: a port, or a spot at sea (decision 0131). */
export interface QuestTarget {
  port?: string;
  point?: QuestPoint;
  radius?: number;
}

/**
 * Where the tracked step leads on the chart: the step's rough circle, else the port its goal
 * names (quest cargo: where to load it, then where to bring it, which may be a spot at sea).
 */
export function questTarget(book: QuestBook, map: MapDef): QuestTarget | null {
  const active = book.active.find((a) => a.quest.id === book.tracked);
  if (!active) return null;
  const { step, quest } = active;
  if (step.chart) {
    const port = resolvePort(map, step.chart.port);
    return port ? { port, radius: step.chart.radius } : null;
  }
  const goal = step.goal;
  const counts = book.progress(quest.id)?.counts ?? [];
  // Founding goods (decision 0157): where they land, alone or the first of several.
  const landed =
    goal?.is === 'landed'
      ? goal
      : goal?.is === 'all'
        ? (goal.of as Condition[]).find((c) => c.is === 'landed')
        : undefined;
  const id =
    goal?.is === 'carried'
      ? (counts[0] ?? 0) > 0
        ? goal.to
        : goal.from
      : landed
        ? landed.place
        : (goal?.port ?? step.port ?? quest.port);
  if (isSpot(id)) return { point: { x: id.x, y: id.y }, radius: id.within };
  const port = book.portOf(quest.id, id);
  return port ? { port } : null;
}

/**
 * Where the tracked step leads, for the sea's objective panel and edge arrow when no course is set
 * (decision 0139): the step's `compass` point, else its spot at sea, else the harbour's pier
 * (`harbours`) or the island; named by the step's ask or the port.
 */
export function questGoal(
  book: QuestBook,
  map: MapDef,
  harbours: Record<string, { x: number; y: number }>,
): { x: number; y: number; label: string } | null {
  const target = questTarget(book, map);
  const active = book.active.find((a) => a.quest.id === book.tracked);
  if (!active) return null;
  const ask = tOptional(
    `${active.quest.text}.${active.step.id}.title`,
    stepParams(book, active.step, active.quest),
  );
  const point = book.compassOf(active.step) ?? target?.point;
  if (point) return { x: point.x, y: point.y, label: ask ?? active.quest.name };
  const port = target?.port ? findPort(map, target.port) : undefined;
  const island = port && map.islands.find((i) => i.id === port.islandId);
  const at = (port && harbours[port.id]) ?? island;
  return port && at ? { x: at.x, y: at.y, label: port.name } : null;
}

/** A place at sea the tracked step asks the boat to reach (decision 0130). */
export interface StepMarker extends QuestPoint {
  within: number;
  /** Passed already (a gate behind the boat, a spot visited). */
  reached: boolean;
  /** The one to make for: the next gate in order, every spot still to visit in any order. */
  next: boolean;
}

/**
 * The step's places at sea, read from its goal and its numbers: `reach` points, a timed run's
 * `via` points, and quest cargo's spot at sea (where to load it, then where to bring it). Places
 * that are ports are not markers: the chart's ring and route show them.
 */
export function stepMarkers(
  goal: Condition | undefined,
  counts: readonly number[],
  map?: MapDef,
): StepMarker[] {
  const out: StepMarker[] = [];
  for (const [c, at] of slotLayout(goal).at) {
    const s = counts.slice(at, at + (CONDITIONS[c.is]?.slots ?? 0));
    const first = s[0] ?? 0;
    if (c.is === 'reach' && Array.isArray(c.points)) {
      const inOrder = c.order === 'in-order';
      (c.points as unknown[]).forEach((at, i) => {
        // A map place (the prologue's wreck) where this map has it (decision 0151).
        const p = map ? pointOf(map, at) : typeof at === 'object' ? (at as QuestPoint) : null;
        if (!p) return;
        const reached = inOrder ? i < first : (first & (1 << i)) !== 0;
        const within = typeof c.within === 'number' ? c.within : 0;
        out.push({ x: p.x, y: p.y, within, reached, next: inOrder ? i === first : !reached });
      });
    }
    if (c.is === 'timed' && Array.isArray(c.via)) {
      const passed = s[2] ?? 0;
      const within = typeof c.within === 'number' ? c.within : 15;
      (c.via as QuestPoint[]).forEach((p, i) =>
        out.push({ x: p.x, y: p.y, within, reached: i < passed, next: i === passed }),
      );
    }
    if (c.is === 'carried' && (s[1] ?? 0) < (typeof c.qty === 'number' ? c.qty : 0)) {
      const spot = first > 0 ? c.to : c.from;
      if (isSpot(spot))
        out.push({ x: spot.x, y: spot.y, within: spot.within, reached: false, next: true });
    }
    // Founding goods' landing spot (decision 0157), until they are all ashore.
    if (c.is === 'landed' && isSpot(c.place) && first < (typeof c.qty === 'number' ? c.qty : 0)) {
      const p = c.place;
      if (!out.some((m) => m.x === p.x && m.y === p.y))
        out.push({ x: p.x, y: p.y, within: p.within, reached: false, next: true });
    }
  }
  return out;
}

/** The tracked step's markers and how they are drawn (the step's `marker`, default rings). */
export function trackedMarkers(book: QuestBook): { style: string; points: StepMarker[] } | null {
  const active = book.active.find((a) => a.quest.id === book.tracked);
  if (!active) return null;
  const points = stepMarkers(
    active.step.goal,
    book.progress(active.quest.id)?.counts ?? [],
    book.map,
  );
  return points.length ? { style: active.step.marker ?? 'ring', points } : null;
}

/** A lesson's coach bubble (decision 0151): the running lesson's step, its words and its mark. */
export interface LessonModel {
  quest: string;
  step: string;
  /** The step's number on the lesson's main line (1-based), or 0 for a way back off it. */
  stepNo: number;
  /** Steps on the main line. */
  steps: number;
  title: string;
  copy: string;
  /** The bubble's button: open the chart, the market, or the sailing tips. */
  action: 'chart' | 'market' | 'tips' | null;
  /** The step's options offered now ("Continue"), with their words. */
  options: { id: string; title: string }[];
  /** What the coach mark points at on each surface. */
  targets: Partial<Record<'sea' | 'chart' | 'market', CoachTarget>>;
  /** The harbour the port marker and the chart point at. */
  port: string | null;
  /** The good whose market button the mark points at. */
  good: GoodId | null;
}

/**
 * A lesson's main line (decision 0151): from its first step, each step's goal (or, with none, its
 * first option) to the next. Steps off it are only reached by ways back and are not numbered.
 */
export function mainLine(quest: QuestDef): string[] {
  const out: string[] = [];
  let step = quest.steps[0];
  while (step && !out.includes(step.id)) {
    out.push(step.id);
    const next =
      (step.goal ? step.next : (step.choose?.[0]?.next ?? step.next)) ??
      quest.steps[quest.steps.indexOf(step) + 1]?.id;
    step = quest.steps.find((s) => s.id === next);
  }
  return out;
}

/** The nearest charted harbour to the boat: the easiest first trip. */
function nearestPort(book: QuestBook, harbours: Record<string, { x: number; y: number }>) {
  const { boat, map, trade } = book.world;
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const port of map.ports) {
    if (!isDiscovered(trade, port.id)) continue;
    const at = harbours[port.id] ?? map.islands.find((i) => i.id === port.islandId);
    if (!at) continue;
    const distance = Math.hypot(at.x - boat.x, at.y - boat.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = port.id;
    }
  }
  return best;
}

/** The running lesson's bubble, if a lesson runs. */
export function lessonFor(
  book: QuestBook,
  harbours: Record<string, { x: number; y: number }>,
): LessonModel | null {
  const running = book.lesson;
  // A lesson without its coach plays its story in silence (decision 0160).
  if (!running || !book.isCoached(running.quest.id)) return null;
  const { quest, step } = running;
  const vars = book.progress(quest.id)?.vars;
  const coach = step.coach ?? {};
  const params = stepParams(book, step, quest);
  const key = `${quest.text}.${step.id}`;
  const line = mainLine(quest);
  const portRef = coach.port ?? step.port;
  let port: string | null;
  if (portRef === 'nearest') port = nearestPort(book, harbours);
  else if (portRef?.startsWith('buyer:')) {
    const good = deref(portRef.slice(6), vars);
    port = isGood(good) ? (buyerOf(book, good)?.id ?? null) : null;
  } else port = book.portOf(quest.id, portRef);
  let good: GoodId | null;
  if (coach.good?.startsWith('makes:')) {
    const from = book.portOf(quest.id, coach.good.slice(6));
    good = (from && findPort(book.map, from)?.produces[0]) || null;
  } else good = goodOf(deref(coach.good, vars)) ?? null;
  return {
    quest: quest.id,
    step: step.id,
    stepNo: line.indexOf(step.id) + 1,
    steps: line.length,
    title: tOptional(`${key}.title`, params) ?? step.id,
    copy: tOptional(`${key}.copy`, params) ?? '',
    action: coach.action ?? null,
    options: book.options(quest.id).map((o) => ({
      id: o.id,
      title: tOptional(`${key}.${o.id}.title`, params) ?? o.id,
    })),
    targets: { sea: coach.sea, chart: coach.chart, market: coach.market },
    port,
    good,
  };
}

/** A finished lesson's last bubble: `<text>.done.title` and `.copy`. */
export function lessonDone(book: QuestBook, questId: string): { title: string; copy: string } {
  const quest = book.quests.find((q) => q.id === questId);
  const key = `${quest?.text ?? questId}.${QUEST_DONE}`;
  return {
    title: tOptional(`${key}.title`) ?? (quest ? arcName(quest) : questId),
    copy: tOptional(`${key}.copy`) ?? '',
  };
}
