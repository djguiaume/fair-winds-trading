import { type StepEffects, checkStepEffects } from './stepEffects';
import characterData from '../data/characters.json';
import { daylightAt } from './daylight';
import { GOODS, type GoodAmounts, type GoodId, isGood } from './goods';
import { type IslandDesign, questTagIds } from '../data/islands';
import type { MapDef } from './map';
import {
  type CheckScope,
  type Condition,
  type ConditionContext,
  type Helm,
  MAP_PLACES,
  type QuestPoint,
  type QuestReward,
  SCREENS,
  type Screen,
  VAR_KINDS,
  type VarKind,
  checkCondition,
  deref,
  isVarRef,
  pointOf,
  checkReward,
  itemsAboard,
  parFor,
  payReward,
  portsIn,
  resolvePort,
  rewardPorts,
  slotLayout,
  testCondition,
  updateGoal,
} from './questLibrary';
import { freeSpace, syncMarketLevels, type TradeState } from './trade';
import type { World } from './world';

/*
 * The quest engine (decision 0125): every file in `src/data/quests/` is a quest in the format of
 * decision 0113, the tutorial too (decision 0151). Each starts when its `start` condition holds
 * (the tutorial when the game asks for it) and runs here, several at once, with its progress saved
 * in the voyage (`trade.quests`). Conditions and rewards are the code library in `questLibrary.ts`.
 * How to write one: docs/content/README.md.
 */

/** A choice step's option: its reward, and optionally the step it leads to. */
export interface QuestOption {
  id: string;
  reward?: QuestReward;
  next?: string;
  /** Offered only while this holds (decision 0151: "Use my existing cargo" needs cargo). */
  if?: Condition;
}

/**
 * A way back (decision 0151): while a step runs and its goal does not hold, the first of these
 * whose `if` holds moves the quest to `to`, any step, even an earlier one (the lesson's harbour
 * lost, the cargo sold early). `set` fills vars on the way.
 */
export interface QuestWayBack {
  if: Condition;
  to: string;
  set?: Record<string, string>;
}

/**
 * Where a lesson's coach mark points (decision 0061, made quest data by 0151), on each surface:
 * `src/ui/tutorial.ts` has the selectors.
 */
export const COACH_TARGETS = [
  'chart-button',
  'sail-lever',
  'wind-compass',
  'port-marker',
  'dock-button',
  'chart-port',
  'close-chart',
  'buy-button',
  'sell-button',
] as const;
export type CoachTarget = (typeof COACH_TARGETS)[number];

/** The button a lesson bubble offers: open the chart, the market, or the sailing tips. */
export const COACH_ACTIONS = ['chart', 'market', 'tips'] as const;

/**
 * A lesson step's coach mark (decision 0151): what it points at on each surface, the harbour
 * (`port`: a port, `home`, a `$var`, `nearest` charted harbour or `buyer:$var`, a charted harbour
 * that wants that good) and the good (`good`: a good, a `$var`, or `makes:$var`, what that
 * harbour makes) the port marker and market buttons are for, and its button.
 */
export interface StepCoach {
  sea?: CoachTarget;
  chart?: CoachTarget;
  market?: CoachTarget;
  port?: string;
  good?: string;
  action?: (typeof COACH_ACTIONS)[number];
}

export interface QuestStep extends StepEffects {
  /** Stored in saves: never rename a shipped step. */
  id: string;
  /** The step is done when this holds. */
  goal?: Condition;
  /** Or: the player picks one of these (with a goal too: a lesson's "Continue", decision 0151). */
  choose?: QuestOption[];
  /** Ways back to another step while the goal does not hold (decision 0151). */
  unless?: QuestWayBack[];
  /**
   * Vars filled when the step is done (decision 0151): var → a port or good, `home`, another
   * `$var`, or what the voyage holds then: `course` (the course's port), `docked` (the port
   * alongside), `aboard` (the first good in the hold).
   */
  set?: Record<string, string>;
  /** A lesson step's coach mark (decision 0151). */
  coach?: StepCoach;
  /** Paid when the step is done. */
  reward?: QuestReward;
  /** A later step's id, or `done`; default the following step (after the last: done). */
  next?: string;
  /** Touching a reef or a shore (hull damage) starts the step over, at no other cost. */
  clean?: boolean;
  /** Where the step happens, for the interface. */
  port?: string;
  /** A rough circle the chart draws around a place to find, for the interface. */
  chart?: { port: string; radius: number };
  /**
   * A point the compass marks and the sea's objective points at while the step is tracked (a
   * foghorn, a wreck), for the interface; or a map place by its word (`wreck`, decision 0151).
   * `wind` and `sound` are in `stepEffects.ts` (0139).
   */
  compass?: QuestPoint | string;
  /** The giver's face on this step's card: `neutral`, `pleased` or `worried` (decision 0124). */
  mood?: string;
  /** A named look of the giver for this step (`characters.json` › `looks`, e.g. `soaked`). */
  look?: string;
  /**
   * Someone else speaks this step's card instead of the giver (a `characters.json` id); `mood` and
   * `look` are then theirs.
   */
  speaker?: string;
  /**
   * How its places at sea are drawn (decision 0130): `ring` (default, a floating ring) or
   * `gulls` (a flock diving over the spot), for the interface.
   */
  marker?: StepMarkerStyle;
}

export interface QuestDef {
  /** Stored in saves: never rename a shipped quest. */
  id: string;
  /** English name, for editors and lists. */
  name: string;
  /**
   * Starts when this holds (checked while it has not started). `{ "is": "asked" }`: when the game
   * asks for it (the tutorial's offer and the menu, decision 0151), again each time.
   */
  start: Condition;
  /** Prefix of the text keys: `<text>.<step>.title` and `.copy`. */
  text: string;
  /** Paid when the quest is done. */
  reward?: QuestReward;
  /** Quest cargo (`carried`): item id → hold spaces one piece takes (0: a passenger). Cannot be sold. */
  items?: Record<string, { space: number }>;
  /** The person giving it (`characters.json`), for the interface. */
  giver?: string;
  /** Where its card shows, for the interface. */
  port?: string;
  /**
   * The player says yes first: once `start` holds, the quest is offered (its card shows "I'll bring
   * it" / "Not now") and begins on `accept`. "Not now" needs nothing: it stays offered.
   */
  offer?: boolean;
  /**
   * A main quest (the story's spine: Rook's thanks, the epilogue; decision 0141): its cards greet
   * the captain on arrival, before the harbour screen, or at sea. Every other quest speaks on the
   * harbour screen's Quay tab and with a small note at sea, and never pops up.
   */
  main?: boolean;
  /**
   * A lesson (decision 0151): its steps speak in a coach bubble pinned to the control to use, not on
   * cards; while it runs it is the tracked quest and the other quests' cards wait.
   */
  lesson?: boolean;
  /** `false`: no storm forms while the quest runs (the tutorial, decision 0072). */
  storms?: false;
  /**
   * Ports and goods picked in play (decision 0151), name → `port` or `good`: steps fill them
   * (`set`) and read them as `$name` in their conditions, coach marks and text (`{name}`).
   */
  vars?: Record<string, VarKind>;
  steps: QuestStep[];
}

/** The people of `characters.json`, with their named looks, for the checks. */
const PEOPLE = new Map(
  (characterData.characters as { id: string; looks?: Record<string, unknown> }[]).map((c) => [
    c.id,
    Object.keys(c.looks ?? {}),
  ]),
);

/** How a step's places at sea are drawn (decision 0130). */
export const STEP_MARKER_STYLES = ['ring', 'gulls'] as const;
export type StepMarkerStyle = (typeof STEP_MARKER_STYLES)[number];

/** The `next` that finishes a quest. */
export const QUEST_DONE = 'done';

/** One started quest: its step (or `done`), the step's numbers, the options picked. */
export interface QuestProgress {
  step: string;
  /** The numbers the step's conditions keep (goods handed over, markers, a run's clock). */
  counts: number[];
  /** Choice step id → option id. */
  chose: Record<string, string>;
  /** The quest's vars set so far (decision 0151). */
  vars?: Record<string, string>;
}

export interface QuestState {
  byId: Record<string, QuestProgress>;
  /** The quest the journal and the sea show; one at a time. */
  tracked?: string;
  /** Hold spaces the quest cargo aboard takes (worked out from `byId` on load). */
  hold?: number;
  /**
   * Offers the captain said "don't offer again" to (decision 0141): no card, no badge; the
   * journal lists them and can take one up again.
   */
  ignored?: string[];
}

/** Every quest file, the tutorial's too (decision 0151), in file name order. */
export const QUESTS: readonly QuestDef[] = Object.entries(
  import.meta.glob<QuestDef>('../data/quests/*.json', { eager: true, import: 'default' }),
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, file]) => file);

/**
 * The quest builder's play-test (decision 0142): the edited quests take the shipped ones' place for
 * this page only, so the quest book, saves and save codes all follow.
 */
export function useEditedQuests(quests: readonly QuestDef[]) {
  (QUESTS as QuestDef[]).splice(0, QUESTS.length, ...quests);
}

const stepIndex = (def: QuestDef, id: string) => def.steps.findIndex((s) => s.id === id);
const findStep = (def: QuestDef, id: string | undefined) => def.steps.find((s) => s.id === id);

/** The map places a step names (its compass, its goal's points), by word. */
function placesNamed(step: QuestStep): string[] {
  const out: string[] = typeof step.compass === 'string' ? [step.compass] : [];
  const walk = (c: Condition | undefined) => {
    if (!c) return;
    if (c.is === 'reach' && Array.isArray(c.points))
      for (const p of c.points) if (typeof p === 'string') out.push(p);
    if (c.is === 'all' || c.is === 'any') (c.of as Condition[]).forEach(walk);
    if (c.is === 'not') walk(c.of as Condition);
  };
  walk(step.goal);
  return out;
}

/** Whether a step names a map place this map does not have: it is passed by (decision 0151). */
export const missesPlace = (step: QuestStep, map: MapDef) =>
  placesNamed(step).some((p) => !pointOf(map, p));

/** Whether a quest is started by the game asking for it (the tutorial, decision 0151). */
export const isAsked = (quest: QuestDef) => quest.start?.is === 'asked';

/** A port reference outside a condition: a port id, `home` or a `$var` (not a map port id). */
const portRefs = (...refs: (string | undefined)[]) =>
  refs.filter((p): p is string => typeof p === 'string' && p !== 'home' && !isVarRef(p));

/** The step after `step` (its own `next`, or a picked option's). */
function nextOf(def: QuestDef, step: QuestStep, option?: QuestOption): string {
  const next = option?.next ?? step.next;
  if (next) return next;
  return def.steps[stepIndex(def, step.id) + 1]?.id ?? QUEST_DONE;
}

/** Every port the quest names: it runs only on maps that have them all. */
function questPorts(def: QuestDef): string[] {
  return [
    ...portsIn(def.start),
    ...rewardPorts(def.reward),
    ...portRefs(def.port),
    ...def.steps.flatMap((s) => [
      ...portsIn(s.goal),
      ...rewardPorts(s.reward),
      ...(s.choose ?? []).flatMap((o) => rewardPorts(o.reward)),
      ...portRefs(s.port, s.chart?.port),
    ]),
  ];
}

/** The quests that can run on `map`, in order. */
export function questsFor(map: MapDef, quests: readonly QuestDef[] = QUESTS): QuestDef[] {
  return quests.filter((q) => questPorts(q).every((p) => resolvePort(map, p)));
}

/** Hold spaces the quest cargo aboard takes. */
export function questHold(state: QuestState, quests: readonly QuestDef[]): number {
  let hold = 0;
  for (const quest of quests) {
    const p = state.byId[quest.id];
    for (const [item, n] of itemsAboard(findStep(quest, p?.step)?.goal, p?.counts ?? []))
      hold += n * (quest.items?.[item]?.space ?? 1);
  }
  return hold;
}

/**
 * Problems with the quest files, as readable lines (none: they are sound). `others` are the quests
 * a condition may name besides these (the tutorial), with their step ids when known.
 */
export function checkQuests(
  quests: readonly QuestDef[],
  map: MapDef,
  others: string[] | Record<string, string[]> = [],
): string[] {
  const outside: Record<string, string[] | undefined> = Array.isArray(others)
    ? Object.fromEntries(others.map((id) => [id, undefined]))
    : others;
  const steps = new Map<string, string[]>([
    ...Object.entries(outside).flatMap(([id, list]) =>
      list ? [[id, list] as [string, string[]]] : [],
    ),
    ...quests.map((q) => [q.id, (q.steps ?? []).map((s) => s.id)] as [string, string[]]),
  ]);
  const all = new Map<string, string[]>([
    ...Object.keys(outside).map((id) => [id, []] as [string, string[]]),
    ...quests.map(
      (q) =>
        [q.id, (q.steps ?? []).flatMap((s) => (s.choose ?? []).map((o) => o.id))] as [
          string,
          string[],
        ],
    ),
  ]);
  const out: string[] = [];
  const ids = new Set<string>(Object.keys(outside));
  for (const q of quests) {
    const at = `quest ${q.id}`;
    const scope: CheckScope = {
      map,
      quests: all,
      steps,
      items: Object.keys(q.items ?? {}),
      vars: q.vars ?? {},
    };
    if (ids.has(q.id)) out.push(`${at}: id used twice`);
    ids.add(q.id);
    if (typeof q.name !== 'string' || typeof q.text !== 'string')
      out.push(`${at}: needs name and text`);
    for (const [item, def] of Object.entries(q.items ?? {}))
      if (!Number.isInteger(def?.space) || def.space < 0)
        out.push(`${at} › items.${item}: space needs a whole number (0 for a passenger)`);
    if (q.port !== undefined && !resolvePort(map, q.port)) out.push(`${at}: no port "${q.port}"`);
    if (q.giver !== undefined && !PEOPLE.has(q.giver)) out.push(`${at}: no person "${q.giver}"`);
    if (q.offer !== undefined && typeof q.offer !== 'boolean')
      out.push(`${at}: offer is true or false`);
    if (q.main !== undefined && typeof q.main !== 'boolean')
      out.push(`${at}: main is true or false`);
    if (q.main && q.offer) out.push(`${at}: a main quest is not offered (it cannot be ignored)`);
    if (q.lesson !== undefined && typeof q.lesson !== 'boolean')
      out.push(`${at}: lesson is true or false`);
    if (q.storms !== undefined && q.storms !== false) out.push(`${at}: storms is only ever false`);
    for (const [name, kind] of Object.entries(q.vars ?? {}))
      if (!/^\w+$/.test(name) || !VAR_KINDS.includes(kind))
        out.push(`${at} › vars.${name}: a word, holding one of ${VAR_KINDS.join(', ')}`);
    out.push(...checkCondition(q.start, scope, false, `${at} › start`));
    out.push(...checkReward(q.reward, scope, `${at} › reward`));
    if (!Array.isArray(q.steps) || q.steps.length === 0) {
      out.push(`${at}: needs steps`);
      continue;
    }
    const stepIds = q.steps.map((s) => s.id);
    const reached = new Set([stepIds[0]]);
    q.steps.forEach((s, i) => {
      const where = `${at} › ${s.id}`;
      if (typeof s.id !== 'string' || s.id === QUEST_DONE) out.push(`${where}: bad step id`);
      if (stepIds.indexOf(s.id) !== i) out.push(`${where}: step id used twice`);
      if (s.goal === undefined && s.choose === undefined)
        out.push(`${where}: needs a goal or a choice`);
      if (s.goal !== undefined) out.push(...checkCondition(s.goal, scope, true, `${where} › goal`));
      out.push(...checkReward(s.reward, scope, `${where} › reward`));
      for (const p of [s.port, s.chart?.port])
        if (
          p !== undefined &&
          !(isVarRef(p) ? q.vars?.[p.slice(1)] === 'port' : resolvePort(map, p))
        )
          out.push(`${where}: no port "${p}"`);
      if (s.speaker !== undefined && !PEOPLE.has(s.speaker))
        out.push(`${where}: no person "${s.speaker}"`);
      const face = s.speaker ?? q.giver;
      if (s.look !== undefined && face && PEOPLE.has(face) && !PEOPLE.get(face)!.includes(s.look))
        out.push(`${where}: ${face} has no look "${s.look}"`);
      if (
        s.compass !== undefined &&
        !(typeof s.compass === 'string'
          ? s.compass in MAP_PLACES
          : Number.isFinite(s.compass.x) && Number.isFinite(s.compass.y))
      )
        out.push(`${where} › compass: needs { "x", "y" } or a map place`);
      out.push(...checkSet(s.set, q.vars ?? {}, map, `${where} › set`));
      out.push(...checkCoach(s.coach, q.vars ?? {}, map, `${where} › coach`));
      if (s.unless !== undefined) {
        if (!Array.isArray(s.unless)) out.push(`${where} › unless: needs a list`);
        else
          s.unless.forEach((way, k) => {
            const w = `${where} › unless[${k}]`;
            out.push(...checkCondition(way?.if, scope, false, `${w} › if`));
            if (!stepIds.includes(way?.to)) out.push(`${w}: no step "${String(way?.to)}"`);
            out.push(...checkSet(way?.set, q.vars ?? {}, map, `${w} › set`));
          });
      }
      out.push(...checkStepEffects(s, where));
      if (s.marker !== undefined && !STEP_MARKER_STYLES.includes(s.marker))
        out.push(`${where}: marker is one of ${STEP_MARKER_STYLES.join(', ')}`);
      if (s.chart && !(typeof s.chart.radius === 'number' && s.chart.radius > 0))
        out.push(`${where} › chart: needs a radius`);
      const later = (next: string | undefined, from: string) => {
        if (next === undefined || next === QUEST_DONE) return;
        // Only forward, so a quest always ends and its progress is one step number.
        if (stepIds.indexOf(next) <= i) out.push(`${from}: next "${next}" is not a later step`);
      };
      later(s.next, where);
      if (s.choose !== undefined) {
        // One option is a button to go on ("Continue"); a choice proper has two or more.
        if (!Array.isArray(s.choose) || s.choose.length < 1)
          out.push(`${where}: a choice needs an option or more`);
        else {
          const opts = s.choose.map((o) => o.id);
          s.choose.forEach((o, k) => {
            if (typeof o.id !== 'string' || opts.indexOf(o.id) !== k)
              out.push(`${where}: bad or repeated option "${String(o.id)}"`);
            out.push(...checkReward(o.reward, scope, `${where} › ${o.id}`));
            if (o.if !== undefined)
              out.push(...checkCondition(o.if, scope, false, `${where} › ${o.id} › if`));
            later(o.next, `${where} › ${o.id}`);
          });
        }
      }
    });
    // Every step reached from the first, by its goal, its options or its ways back.
    for (let grew = true; grew;) {
      grew = false;
      for (const s of q.steps) {
        if (!reached.has(s.id)) continue;
        const to = [
          ...(s.goal !== undefined || !Array.isArray(s.choose) ? [nextOf(q, s)] : []),
          ...(Array.isArray(s.choose) ? s.choose.map((o) => nextOf(q, s, o)) : []),
          ...(Array.isArray(s.unless) ? s.unless.map((w) => w?.to) : []),
        ];
        for (const id of to)
          if (typeof id === 'string' && !reached.has(id)) {
            reached.add(id);
            grew = true;
          }
      }
    }
    for (const id of stepIds) if (!reached.has(id)) out.push(`${at} › ${id}: no step leads here`);
  }
  return out;
}

/** Problems with a step's `set` (decision 0151): known vars, and values that fit them. */
function checkSet(set: unknown, vars: Record<string, VarKind>, map: MapDef, at: string): string[] {
  if (set === undefined) return [];
  if (typeof set !== 'object' || set === null || Array.isArray(set)) return [`${at}: var → value`];
  const out: string[] = [];
  for (const [name, value] of Object.entries(set)) {
    const kind = vars[name];
    if (!kind) {
      out.push(`${at}: no var "${name}" in the quest's vars`);
      continue;
    }
    if (isVarRef(value)) {
      if (vars[value.slice(1)] !== kind) out.push(`${at}.${name}: no ${kind} var "${value}"`);
    } else if (kind === 'port') {
      if (value !== 'course' && value !== 'docked' && !resolvePort(map, value))
        out.push(`${at}.${name}: course, docked, home or a port`);
    } else if (value !== 'aboard' && !isGood(value)) out.push(`${at}.${name}: aboard or a good`);
  }
  return out;
}

/** Problems with a lesson step's coach mark (decision 0151). */
function checkCoach(
  coach: StepCoach | undefined,
  vars: Record<string, VarKind>,
  map: MapDef,
  at: string,
): string[] {
  if (coach === undefined) return [];
  if (typeof coach !== 'object' || coach === null) return [`${at}: not a coach mark`];
  const out: string[] = [];
  for (const [key, value] of Object.entries(coach)) {
    if ((SCREENS as readonly string[]).includes(key)) {
      if (!COACH_TARGETS.includes(value as CoachTarget))
        out.push(`${at}.${key}: one of ${COACH_TARGETS.join(', ')}`);
    } else if (key === 'action') {
      if (!COACH_ACTIONS.includes(value as (typeof COACH_ACTIONS)[number]))
        out.push(`${at}.action: one of ${COACH_ACTIONS.join(', ')}`);
    } else if (key === 'port') {
      const v = String(value);
      const ref = v.startsWith('buyer:') ? v.slice(6) : v;
      const ok =
        v === 'nearest' ||
        (v.startsWith('buyer:') ? vars[ref.slice(1)] === 'good' && isVarRef(ref) : false) ||
        (isVarRef(v) ? vars[v.slice(1)] === 'port' : !!resolvePort(map, v));
      if (!ok) out.push(`${at}.port: a port, home, a port $var, nearest or buyer:$var`);
    } else if (key === 'good') {
      const v = String(value);
      const ok = v.startsWith('makes:')
        ? vars[v.slice(7)] === 'port' && isVarRef(v.slice(6))
        : isVarRef(v)
          ? vars[v.slice(1)] === 'good'
          : isGood(v);
      if (!ok) out.push(`${at}.good: a good, a good $var or makes:$var`);
    } else out.push(`${at}: no "${key}"`);
  }
  return out;
}

/**
 * Problems with what waits on a quest (decision 0130), as readable lines: island props and sea
 * marks tagged `after:` or `before:` a quest, and ports whose trade changes after one, must name
 * a quest there is (`quests`, or `others` such as the tutorial).
 */
export function checkQuestHooks(
  map: MapDef,
  designs: readonly IslandDesign[],
  quests: readonly QuestDef[],
  others: string[] = [],
): string[] {
  const known = new Set([...quests.map((q) => q.id), ...others]);
  const out: string[] = [];
  const named = (ids: string[], where: string) => {
    for (const id of ids) if (!known.has(id)) out.push(`${where}: no quest "${id}"`);
  };
  for (const design of designs)
    design.props.forEach((prop, i) => {
      const where = `island ${design.id} › prop ${i} (${prop.type})`;
      named(questTagIds(prop), where);
      // A moored boat is solid, and the collision does not follow quests.
      if (prop.type === 'moored-boat' && questTagIds(prop).length)
        out.push(`${where}: a moored boat cannot wait on a quest (use a sea mark)`);
    });
  (map.marks ?? []).forEach((mark, i) =>
    named(questTagIds(mark), `map › mark ${i} (${mark.type})`),
  );
  for (const port of map.ports)
    named(Object.keys(port.afterQuest ?? {}), `port ${port.id} › afterQuest`);
  return out;
}

/** What happened in the quests, for the interface. */
export type QuestEvent =
  /** An `offer` quest whose start holds: waiting for the player's yes. */
  | { type: 'offered'; quest: string }
  | { type: 'started'; quest: string }
  | { type: 'step'; quest: string; step: string }
  | { type: 'choice'; quest: string; step: string }
  /** A `clean` step touched a reef or shore and starts over. */
  | { type: 'reset'; quest: string; step: string }
  /** Goods taken out of the hold for a step (`landed`, decision 0157). */
  | { type: 'landed'; quest: string; good: GoodId; qty: number }
  | { type: 'finished'; quest: string };

/** How often the conditions are checked, in seconds of play. */
export const QUEST_CHECK_SEC = 0.25;

export interface QuestBookOptions {
  /** Quests run elsewhere (the tutorial): done when this says so. */
  doneElsewhere?: (id: string) => boolean;
  /** Quests run elsewhere: whether they have reached a step. */
  atElsewhere?: (id: string, step: string) => boolean;
  /** Whether night counts now; the game passes "night, or night switched off". */
  nightOk?: () => boolean;
  /** What is open now, for `screen` (decision 0151); default the sea. */
  screen?: () => Screen;
}

/** What the last check saw, to tell what changed since. */
interface Seen {
  x: number;
  y: number;
  docked: string | null;
  cargo: GoodAmounts;
  damage: number;
}

/**
 * Runs the quests on the voyage. Never moves the boat, trades or picks for the player: it reads the
 * voyage, moves quests on and pays their rewards.
 */
export class QuestBook {
  readonly quests: readonly QuestDef[];
  private seen: Seen | null = null;
  /** Offered quests already announced, so `offered` is sent once each. */
  private announced = new Set<string>();
  private since = 0;
  private readonly doneElsewhere: (id: string) => boolean;
  private readonly atElsewhere: (id: string, step: string) => boolean;
  private readonly nightOk: () => boolean;
  private readonly screen: () => Screen;
  /** The helm since the last check (decision 0151). */
  private helm: Helm = { sails: [], steerSec: 0, movingSec: 0 };
  onEvent: (e: QuestEvent) => void = () => {};

  constructor(
    readonly world: World,
    quests: readonly QuestDef[] = QUESTS,
    options: QuestBookOptions = {},
  ) {
    this.quests = questsFor(world.map, quests);
    this.doneElsewhere = options.doneElsewhere ?? (() => false);
    this.atElsewhere = options.atElsewhere ?? (() => false);
    this.nightOk = options.nightOk ?? (() => daylightAt(this.world.time).night >= 0.5);
    this.screen = options.screen ?? (() => 'sea');
  }

  private get trade(): TradeState {
    return this.world.trade;
  }
  /** The map the quests run on. */
  get map(): MapDef {
    return this.world.map;
  }
  private get state(): QuestState {
    return this.trade.quests;
  }
  progress(id: string): QuestProgress | undefined {
    return this.state.byId[id];
  }
  isDone(id: string): boolean {
    return this.progress(id)?.step === QUEST_DONE || this.doneElsewhere(id);
  }
  /**
   * The par of a step's timed run (`timed`, also inside `all` / `any`) for the voyage's difficulty
   * level, in seconds; undefined for a step with no run. Its text shows it as `{par}`.
   */
  parSeconds(step: QuestStep | undefined): number | undefined {
    const find = (c: Condition | undefined): Condition | undefined => {
      if (!c) return undefined;
      if (c.is === 'timed') return c;
      if (c.is === 'all' || c.is === 'any') {
        for (const m of c.of as Condition[]) {
          const hit = find(m);
          if (hit) return hit;
        }
      }
      return undefined;
    };
    const timed = find(step?.goal);
    return timed ? parFor(timed.par, this.trade) : undefined;
  }
  /** Whether a quest has reached `step` (or a later one) or is done. */
  isAt(id: string, step: string): boolean {
    if (this.isDone(id)) return true;
    const quest = this.quests.find((q) => q.id === id);
    if (!quest) return this.atElsewhere(id, step);
    const at = quest.steps.findIndex((s) => s.id === this.progress(id)?.step);
    return at >= 0 && at >= quest.steps.findIndex((s) => s.id === step);
  }
  /** Started and not done, with the step it is on. */
  get active(): { quest: QuestDef; step: QuestStep }[] {
    const out: { quest: QuestDef; step: QuestStep }[] = [];
    for (const quest of this.quests) {
      const step = findStep(quest, this.progress(quest.id)?.step);
      if (step) out.push({ quest, step });
    }
    return out;
  }
  /** The tracked quest's step now, whose `compass`, `wind` and `sound` the sea shows (0139). */
  get trackedStep(): QuestStep | undefined {
    return this.active.find((a) => a.quest.id === this.tracked)?.step;
  }
  /** The lesson running now (decision 0151: the tutorial), with its step. */
  get lesson(): { quest: QuestDef; step: QuestStep } | undefined {
    return this.active.find((a) => a.quest.lesson);
  }
  /** Whether a running quest holds the storms back (`storms: false`). */
  get holdsStorms(): boolean {
    return this.active.some((a) => a.quest.storms === false);
  }
  /** Whether a quest has started and is not done. */
  isRunning(id: string): boolean {
    return this.active.some((a) => a.quest.id === id);
  }
  /** The point a step's compass marks on this map, if any (a map place resolved). */
  compassOf(step: QuestStep | undefined): QuestPoint | null {
    return step?.compass === undefined ? null : pointOf(this.world.map, step.compass);
  }
  /** A quest's var (decision 0151), if set. */
  varOf(questId: string, name: string): string | undefined {
    return this.progress(questId)?.vars?.[name];
  }
  /** A port reference of a quest (a port id, `home` or a `$var`) on this map, or null. */
  portOf(questId: string, ref: unknown): string | null {
    return resolvePort(this.world.map, deref(ref, this.progress(questId)?.vars));
  }
  /** The options of a quest's current step offered now (each option's `if`, decision 0151). */
  options(questId: string): QuestOption[] {
    const quest = this.quests.find((q) => q.id === questId);
    const step = quest && findStep(quest, this.progress(questId)?.step);
    const ctx = quest && this.context(quest);
    return (step?.choose ?? []).filter((o) => !o.if || (ctx && testCondition(o.if, ctx)));
  }
  get offered(): QuestDef[] {
    return this.waiting.filter((q) => !this.isIgnored(q.id));
  }
  /** Offers the captain said "don't offer again" to, whose start still holds (decision 0141). */
  get ignoredOffers(): QuestDef[] {
    return this.waiting.filter((q) => this.isIgnored(q.id));
  }
  private get waiting(): QuestDef[] {
    return this.quests.filter(
      (q) => q.offer && !this.progress(q.id) && testCondition(q.start, this.context()),
    );
  }
  isIgnored(id: string): boolean {
    return this.state.ignored?.includes(id) ?? false;
  }
  /** "Don't offer again": the offer leaves the cards and the badges, the journal keeps it. */
  ignore(id: string): boolean {
    if (!this.offered.some((q) => q.id === id)) return false;
    this.state.ignored = [...(this.state.ignored ?? []), id];
    return true;
  }
  /** Take an ignored offer up again: it is offered as before, at its port. */
  unignore(id: string): boolean {
    if (!this.isIgnored(id)) return false;
    this.state.ignored = this.state.ignored!.filter((q) => q !== id);
    if (!this.state.ignored.length) delete this.state.ignored;
    return true;
  }
  /** The player's yes to an offered quest. */
  accept(id: string): QuestEvent[] {
    const quest = this.offered.find((q) => q.id === id);
    if (!quest) return [];
    const events: QuestEvent[] = [{ type: 'started', quest: id }];
    this.enter(quest, quest.steps[0]!, events);
    this.afterChange(events);
    return [...events, ...this.check()];
  }
  get tracked(): string | undefined {
    return this.state.tracked;
  }
  /** Show this quest in the journal and at sea. A running lesson keeps the sea (decision 0151). */
  track(id: string): boolean {
    if (!this.active.some((a) => a.quest.id === id)) return false;
    if (this.lesson && this.lesson.quest.id !== id) return false;
    this.state.tracked = id;
    return true;
  }

  /**
   * The game asks for a quest that starts `asked` (decision 0151: Start tutorial, the menu's
   * Tutorial): it starts from its first step, again if it ran before, and is tracked.
   */
  ask(id: string): QuestEvent[] {
    const quest = this.quests.find((q) => q.id === id);
    if (!quest || !isAsked(quest)) return [];
    delete this.state.byId[id];
    const events: QuestEvent[] = [{ type: 'started', quest: id }];
    this.enter(quest, quest.steps[0]!, events);
    this.state.tracked = id;
    this.afterChange(events);
    return [...events, ...this.check()];
  }

  /**
   * Puts a quest that has no progress at one of its steps, paying nothing: for progress kept
   * elsewhere before (the tutorial's own storage before decision 0151). Returns whether it did.
   */
  restore(id: string, stepId: string, vars: Record<string, string> = {}): boolean {
    const quest = this.quests.find((q) => q.id === id);
    const step = quest && findStep(quest, stepId);
    if (!quest || !step || this.progress(id)) return false;
    const counts = new Array<number>(slotLayout(step.goal).size).fill(0);
    const kept = readVars(quest, this.world.map, vars);
    this.state.byId[id] = { step: stepId, counts, chose: {}, ...(kept ? { vars: kept } : {}) };
    this.afterChange([]);
    return true;
  }

  /** The captain stops a running quest (Skip on the tutorial): it counts as done, unpaid. */
  drop(id: string): boolean {
    const p = this.progress(id);
    if (!p || p.step === QUEST_DONE) return false;
    this.state.byId[id] = { step: QUEST_DONE, counts: [], chose: p.chose };
    this.afterChange([]);
    return true;
  }

  private context(quest?: QuestDef): ConditionContext {
    const course = this.world.destination?.portId;
    return {
      trade: this.trade,
      map: this.world.map,
      isDone: (id) => this.isDone(id),
      chose: (id, option) => Object.values(this.progress(id)?.chose ?? {}).includes(option),
      isAt: (id, step) => this.isAt(id, step),
      vars: quest ? this.progress(quest.id)?.vars : undefined,
      course: course && resolvePort(this.world.map, course) ? course : null,
      screen: this.screen(),
    };
  }

  /**
   * Called every simulation step, with the helm when the game has it (decision 0151); checks a few
   * times a second.
   */
  update(dt: number, controls?: { sailStep: number; steer: number }): QuestEvent[] {
    if (controls) {
      const { helm } = this;
      if (helm.sails.at(-1) !== controls.sailStep) helm.sails.push(controls.sailStep);
      if (Math.abs(controls.steer) > 0.15) helm.steerSec += dt;
      if (this.world.boat.speedKn > 0.7) helm.movingSec += dt;
    }
    this.since += dt;
    if (this.since < QUEST_CHECK_SEC) return [];
    const elapsed = this.since;
    this.since = 0;
    return this.check(elapsed);
  }

  /** Move the steps' numbers on, then start quests and move them on until nothing changes. */
  check(dt = 0): QuestEvent[] {
    const events: QuestEvent[] = [];
    this.updateSteps(dt, events);
    // A quest takes one way back per check (decision 0151), so two that point at each other
    // cannot spin.
    const wentBack = new Set<string>();
    // Each pass can only start a quest or move one forward (or back, once), so this ends.
    for (let changed = true; changed;) {
      changed = false;
      for (const quest of this.quests) {
        const p = this.progress(quest.id);
        if (!p) {
          if (!testCondition(quest.start, this.context(quest))) {
            this.announced.delete(quest.id);
            continue;
          }
          if (quest.offer) {
            if (!this.announced.has(quest.id) && !this.isIgnored(quest.id))
              events.push({ type: 'offered', quest: quest.id });
            this.announced.add(quest.id);
            continue;
          }
          events.push({ type: 'started', quest: quest.id });
          this.enter(quest, quest.steps[0]!, events);
          changed = true;
          continue;
        }
        const step = findStep(quest, p.step);
        if (!step) continue;
        const ctx = this.context(quest);
        if (step.goal && testCondition(step.goal, ctx, p.counts)) {
          this.finishStep(quest, step, undefined, events);
          changed = true;
          continue;
        }
        if (wentBack.has(quest.id)) continue;
        const way = step.unless?.find((w) => testCondition(w.if, ctx));
        const to = way && findStep(quest, way.to);
        if (!way || !to) continue;
        wentBack.add(quest.id);
        this.applySet(quest, way.set);
        this.enter(quest, to, events);
        changed = true;
      }
    }
    this.afterChange(events);
    return events;
  }

  /** Fills a quest's vars from a `set` (decision 0151), with what the voyage holds now. */
  private applySet(quest: QuestDef, set: Record<string, string> | undefined) {
    const p = this.progress(quest.id);
    if (!set || !p) return;
    const vars = { ...(p.vars ?? {}) };
    for (const [name, source] of Object.entries(set)) {
      let value: string | null | undefined;
      if (source === 'course') value = this.context().course;
      else if (source === 'docked') value = this.trade.dockedAt;
      else if (source === 'aboard') value = GOODS.find((g) => this.trade.captain.cargo[g] > 0);
      else value = deref(source, p.vars) as string | undefined;
      if (quest.vars?.[name] === 'port') value = resolvePort(this.world.map, value);
      if (value) vars[name] = value;
      else delete vars[name];
    }
    p.vars = vars;
    if (!Object.keys(vars).length) delete p.vars;
  }

  /** The player picks `option` on the quest's current choice step. */
  choose(questId: string, optionId: string): QuestEvent[] {
    const quest = this.quests.find((q) => q.id === questId);
    const p = this.progress(questId);
    const step = quest && p && findStep(quest, p.step);
    const option = this.options(questId).find((o) => o.id === optionId);
    if (!quest || !p || !step || !option) return [];
    p.chose[step.id] = option.id;
    const events: QuestEvent[] = [];
    this.finishStep(quest, step, option, events);
    this.afterChange(events);
    // A quest waiting on this one may start now.
    return [...events, ...this.check()];
  }

  // --- Play-testing from the quest builder (decision 0142) ---------------------------------------

  /**
   * Starts a quest at one of its steps on a fresh voyage, for play-testing: the quests its start
   * names are finished first (their rewards paid, the options they need picked), then the quest's
   * earlier steps on the way to `stepId` pay their rewards. Other start conditions (gold, a town
   * level) are not made true: the quest is simply entered.
   */
  testStart(questId: string, stepId: string): QuestEvent[] {
    const quest = this.quests.find((q) => q.id === questId);
    if (!quest || !findStep(quest, stepId)) return [];
    const trail = new Set([questId]);
    this.reachCondition(quest.start, trail);
    const route = routeTo(quest, stepId) ?? [];
    const chose: Record<string, string> = {};
    for (const { step, option } of route) {
      this.pay(step.reward);
      this.pay(option?.reward);
      if (option) chose[step.id] = option.id;
    }
    this.state.byId[questId] = { step: stepId, counts: [], chose };
    const events: QuestEvent[] = [{ type: 'started', quest: questId }];
    this.enter(quest, findStep(quest, stepId)!, events);
    this.state.tracked = questId;
    this.seen = null;
    this.afterChange(events);
    return events;
  }

  /** Play-testing: the tracked quest's step counts as done (a choice takes its first option). */
  skipStep(): QuestEvent[] {
    const at = this.active.find((a) => a.quest.id === this.tracked);
    if (!at) return [];
    const option = at.step.choose?.[0];
    if (option) this.progress(at.quest.id)!.chose[at.step.id] = option.id;
    const events: QuestEvent[] = [];
    this.finishStep(at.quest, at.step, option, events);
    this.afterChange(events);
    return [...events, ...this.check()];
  }

  /** Play-testing: the tracked quest's step starts over (its numbers back to nothing). */
  restartStep(): QuestEvent[] {
    const at = this.active.find((a) => a.quest.id === this.tracked);
    if (!at) return [];
    const events: QuestEvent[] = [];
    this.enter(at.quest, at.step, events);
    this.seen = null;
    this.afterChange(events);
    return events;
  }

  /** Makes the quest conditions in `c` true by finishing or moving on the quests they name. */
  private reachCondition(c: Condition | undefined, trail: Set<string>) {
    if (!c) return;
    if (c.is === 'all') for (const m of c.of as Condition[]) this.reachCondition(m, trail);
    if (c.is === 'any') this.reachCondition((c.of as Condition[])[0], trail);
    const quest = this.quests.find((q) => q.id === c.quest);
    if (!quest || trail.has(quest.id) || this.isDone(quest.id)) return;
    if (c.is === 'quest-done') this.testFinish(quest, trail);
    if (c.is === 'chose') this.testFinish(quest, trail, c.option as string);
    if (c.is === 'quest-at' && findStep(quest, c.step as string)) {
      trail.add(quest.id);
      this.reachCondition(quest.start, trail);
      const chose: Record<string, string> = {};
      for (const { step, option } of routeTo(quest, c.step as string) ?? []) {
        this.pay(step.reward);
        this.pay(option?.reward);
        if (option) chose[step.id] = option.id;
      }
      const counts = new Array<number>(slotLayout(findStep(quest, c.step as string)!.goal).size);
      this.state.byId[quest.id] = { step: c.step as string, counts: counts.fill(0), chose };
    }
  }

  /** Finishes a quest at once, paying all its rewards, through `option` when one is named. */
  private testFinish(quest: QuestDef, trail: Set<string>, option?: string) {
    trail.add(quest.id);
    this.reachCondition(quest.start, trail);
    const chose: Record<string, string> = {};
    for (const at of routeTo(quest, QUEST_DONE, option) ?? []) {
      this.pay(at.step.reward);
      this.pay(at.option?.reward);
      if (at.option) chose[at.step.id] = at.option.id;
    }
    this.state.byId[quest.id] = { step: QUEST_DONE, counts: [], chose };
    this.pay(quest.reward);
    syncMarketLevels(this.trade, this.world.map);
  }

  private afterChange(events: QuestEvent[]) {
    this.state.hold = questHold(this.state, this.quests);
    if (!this.state.hold) delete this.state.hold;
    const active = this.active.map((a) => a.quest.id);
    // A running lesson is always the one tracked (decision 0151).
    const lesson = this.lesson?.quest.id;
    if (lesson) this.state.tracked = lesson;
    // A started quest is tracked when nothing is; a finished one hands over to the next.
    else if (!this.state.tracked || !active.includes(this.state.tracked)) {
      const started = events.find((e) => e.type === 'started' && active.includes(e.quest));
      const next = started?.quest ?? active[0];
      if (next) this.state.tracked = next;
      else delete this.state.tracked;
    }
    for (const e of events) this.onEvent(e);
  }

  private enter(quest: QuestDef, step: QuestStep, events: QuestEvent[]) {
    const was = this.progress(quest.id);
    const counts = new Array<number>(slotLayout(step.goal).size).fill(0);
    this.state.byId[quest.id] = {
      step: step.id,
      counts,
      chose: was?.chose ?? {},
      ...(was?.vars ? { vars: was.vars } : {}),
    };
    // A step about a place this map lacks (the prologue's wreck) is passed by (decision 0151).
    if (missesPlace(step, this.world.map)) {
      this.finishStep(quest, step, undefined, events);
      return;
    }
    events.push({
      type: step.choose && !step.goal ? 'choice' : 'step',
      quest: quest.id,
      step: step.id,
    });
  }

  private pay(r: QuestReward | undefined) {
    payReward(this.trade, this.world.map, r, () => syncMarketLevels(this.trade, this.world.map));
  }

  private finishStep(
    quest: QuestDef,
    step: QuestStep,
    option: QuestOption | undefined,
    events: QuestEvent[],
  ) {
    this.pay(step.reward);
    this.pay(option?.reward);
    this.applySet(quest, step.set);
    const to = findStep(quest, nextOf(quest, step, option));
    if (to) {
      this.enter(quest, to, events);
      return;
    }
    const p = this.progress(quest.id)!;
    this.state.byId[quest.id] = {
      step: QUEST_DONE,
      counts: [],
      chose: p.chose,
      ...(p.vars ? { vars: p.vars } : {}),
    };
    this.pay(quest.reward);
    // A port that trades differently after this quest has its market follow at once (0130).
    if (this.world.map.ports.some((port) => port.afterQuest?.[quest.id]))
      syncMarketLevels(this.trade, this.world.map);
    events.push({ type: 'finished', quest: quest.id });
  }

  /** The conditions that keep numbers see what changed since the last check. */
  private updateSteps(dt: number, events: QuestEvent[]) {
    const { boat, trade } = this.world;
    const damage = trade.captain.hullDamage[trade.captain.activeShip] ?? 0;
    const seen = this.seen;
    this.seen = {
      x: boat.x,
      y: boat.y,
      docked: trade.dockedAt,
      cargo: { ...trade.captain.cargo },
      damage,
    };
    const helm = this.helm;
    this.helm = { sails: helm.sails.slice(-1), steerSec: 0, movingSec: 0 };
    // The first check after loading only takes note: nothing happened "since" yet.
    if (!seen) return;
    // A new knock, or the hull still grinding on a reef or a shore (decision 0139).
    const hit = damage > seen.damage || boat.sinceBump < 0.5;
    const nightOk = this.nightOk();
    for (const { quest, step } of this.active) {
      if (!step.goal) continue;
      const p = this.progress(quest.id)!;
      if (step.clean && hit) {
        if (p.counts.some((n) => n > 0))
          events.push({ type: 'reset', quest: quest.id, step: step.id });
        p.counts = p.counts.map(() => 0);
      } else
        updateGoal(
          step.goal,
          {
            ...this.context(quest),
            helm,
            dt,
            boat: { x: boat.x, y: boat.y, speedKn: boat.speedKn },
            from: seen,
            wasDocked: seen.docked,
            cargoBefore: seen.cargo,
            nightOk,
            freeSpace: freeSpace(trade),
            itemSpace: (item) => quest.items?.[item]?.space ?? 1,
            land: (good, qty) => {
              trade.captain.cargo[good] -= qty;
              events.push({ type: 'landed', quest: quest.id, good, qty });
            },
          },
          p.counts,
        );
      // Quest cargo just loaded takes its room before the next quest loads any.
      this.state.hold = questHold(this.state, this.quests);
    }
  }
}

/**
 * The steps from a quest's first step to `to` (a step id or `done`), with the option picked on each
 * choice; through `need` when it is named. Undefined when no route leads there.
 */
export function routeTo(
  quest: QuestDef,
  to: string,
  need?: string,
): { step: QuestStep; option?: QuestOption }[] | undefined {
  const walk = (
    step: QuestStep | undefined,
    seen: Set<string>,
    met: boolean,
  ): { step: QuestStep; option?: QuestOption }[] | undefined => {
    if (!step) return to === QUEST_DONE && met ? [] : undefined;
    if (step.id === to) return met ? [] : undefined;
    if (seen.has(step.id)) return undefined;
    const next = new Set(seen).add(step.id);
    for (const option of step.choose ?? [undefined]) {
      const rest = walk(
        findStep(quest, nextOf(quest, step, option)),
        next,
        met || option?.id === need,
      );
      if (rest) return [option ? { step, option } : { step }, ...rest];
    }
    return undefined;
  };
  return walk(quest.steps[0], new Set(), !need);
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/**
 * Saved quest progress checked against the quest files: a quest or step no longer there, or bad
 * numbers, drop that quest's progress (it starts again when its condition holds).
 */
export function readQuests(
  raw: unknown,
  map: MapDef,
  quests: readonly QuestDef[] = QUESTS,
): QuestState {
  const out: QuestState = { byId: {} };
  if (typeof raw !== 'object' || raw === null) return out;
  const { byId, tracked, ignored } = raw as {
    byId?: unknown;
    tracked?: unknown;
    ignored?: unknown;
  };
  if (typeof byId !== 'object' || byId === null) return out;
  const fitting = questsFor(map, quests);
  for (const quest of fitting) {
    const p = (byId as Record<string, unknown>)[quest.id] as Partial<QuestProgress> | undefined;
    if (!p || typeof p !== 'object') continue;
    const step = findStep(quest, p.step);
    if (!step && p.step !== QUEST_DONE) continue;
    const counts = Array.isArray(p.counts) ? p.counts : [];
    if (counts.length !== slotLayout(step?.goal).size || !counts.every(isCount)) continue;
    const chose: Record<string, string> = {};
    let ok = typeof p.chose === 'object' && p.chose !== null;
    for (const [s, o] of Object.entries(p.chose ?? {})) {
      if (findStep(quest, s)?.choose?.some((x) => x.id === o)) chose[s] = o;
      else ok = false;
    }
    if (!ok) continue;
    out.byId[quest.id] = { step: p.step as string, counts: [...counts], chose };
    // Vars that no longer fit (a port gone from the map) are dropped: the steps find them again.
    const vars = readVars(quest, map, p.vars);
    if (vars) out.byId[quest.id]!.vars = vars;
  }
  if (typeof tracked === 'string' && out.byId[tracked] && out.byId[tracked].step !== QUEST_DONE)
    out.tracked = tracked;
  if (Array.isArray(ignored)) {
    const offers = ignored.filter(
      (id, i) =>
        ignored.indexOf(id) === i && fitting.some((q) => q.id === id && q.offer && !out.byId[id]),
    ) as string[];
    if (offers.length) out.ignored = offers;
  }
  const hold = questHold(out, fitting);
  if (hold) out.hold = hold;
  return out;
}

/** A quest's saved vars that still fit it (decision 0151), or undefined for none. */
export function readVars(
  quest: QuestDef,
  map: MapDef,
  raw: unknown,
): Record<string, string> | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const out: Record<string, string> = {};
  for (const [name, kind] of Object.entries(quest.vars ?? {})) {
    const v = (raw as Record<string, unknown>)[name];
    if (kind === 'port' ? typeof v === 'string' && map.ports.some((p) => p.id === v) : isGood(v))
      out[name] = v as string;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Whether any quest has progress (the save code writes its quest section only then). */
export const hasQuestProgress = (state: QuestState | undefined) =>
  Object.keys(state?.byId ?? {}).length > 0;

/**
 * 16-bit FNV-1a of the quest, step and option ids and how many numbers each step keeps (never 0):
 * the save code's quest layout.
 */
export function questFingerprint(quests: readonly QuestDef[]): number {
  const ids = quests.flatMap((q) => [
    q.id,
    ...q.steps.flatMap((s) => [
      s.id,
      String(slotLayout(s.goal).size),
      ...(s.choose ?? []).map((o) => o.id),
    ]),
    ...Object.keys(q.vars ?? {}).map((name) => `$${name}`),
  ]);
  let h = 0x811c9dc5;
  for (const ch of ids.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h ^ (h >>> 16)) & 0xffff || 1;
}
