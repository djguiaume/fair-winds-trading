import { daylightAt } from './daylight';
import type { GoodAmounts } from './goods';
import type { MapDef } from './map';
import {
  type CheckScope,
  type Condition,
  type ConditionContext,
  type QuestPoint,
  type QuestReward,
  checkCondition,
  checkReward,
  itemsAboard,
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
 * decision 0113. The tutorial (`start: "offered"`) keeps its own runner (`tutorial.ts`); every
 * other quest starts when its `start` condition holds and runs here, several at once, with its
 * progress saved in the voyage (`trade.quests`). Conditions and rewards are the code library in
 * `questLibrary.ts`. How to write one: docs/content/README.md.
 */

/** A choice step's option: its reward, and optionally the step it leads to. */
export interface QuestOption {
  id: string;
  reward?: QuestReward;
  next?: string;
}

export interface QuestStep {
  /** Stored in saves: never rename a shipped step. */
  id: string;
  /** The step is done when this holds. */
  goal?: Condition;
  /** Or: the player picks one of these. */
  choose?: QuestOption[];
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
  /** A point the compass shows the direction of (a foghorn, a wreck), for the interface. */
  compass?: QuestPoint;
  /** The giver's face on this step's card: `neutral`, `pleased` or `worried` (decision 0124). */
  mood?: string;
  /** A named look of the giver for this step (`characters.json` › `looks`, e.g. `soaked`). */
  look?: string;
}

export interface QuestDef {
  /** Stored in saves: never rename a shipped quest. */
  id: string;
  /** English name, for editors and lists. */
  name: string;
  /** Starts when this holds (checked while it has not started). */
  start: Condition;
  /** Prefix of the text keys: `<text>.<step>.title` and `.copy`. */
  text: string;
  /** Paid when the quest is done. */
  reward?: QuestReward;
  /** Quest cargo (`carried`): item id → hold spaces one piece takes (0: a passenger). Cannot be sold. */
  items?: Record<string, { space: number }>;
  /** The person giving it (`characters.json`, later), for the interface. */
  giver?: string;
  /** Where its card shows, for the interface. */
  port?: string;
  /**
   * The player says yes first: once `start` holds, the quest is offered (its card shows "I'll bring
   * it" / "Not now") and begins on `accept`. "Not now" needs nothing: it stays offered.
   */
  offer?: boolean;
  steps: QuestStep[];
}

/** The `next` that finishes a quest. */
export const QUEST_DONE = 'done';

/** One started quest: its step (or `done`), the step's numbers, the options picked. */
export interface QuestProgress {
  step: string;
  /** The numbers the step's conditions keep (goods handed over, markers, a run's clock). */
  counts: number[];
  /** Choice step id → option id. */
  chose: Record<string, string>;
}

export interface QuestState {
  byId: Record<string, QuestProgress>;
  /** The quest the journal and the sea show; one at a time. */
  tracked?: string;
  /** Hold spaces the quest cargo aboard takes (worked out from `byId` on load). */
  hold?: number;
}

/** Every quest file but the tutorial's, in file name order. */
export const QUESTS: readonly QuestDef[] = Object.entries(
  import.meta.glob<{ start: unknown }>('../data/quests/*.json', { eager: true, import: 'default' }),
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, file]) => file)
  .filter((file) => file.start !== 'offered') as unknown as QuestDef[];

const stepIndex = (def: QuestDef, id: string) => def.steps.findIndex((s) => s.id === id);
const findStep = (def: QuestDef, id: string | undefined) => def.steps.find((s) => s.id === id);

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
    ...[def.port].filter((p): p is string => typeof p === 'string' && p !== 'home'),
    ...def.steps.flatMap((s) => [
      ...portsIn(s.goal),
      ...rewardPorts(s.reward),
      ...(s.choose ?? []).flatMap((o) => rewardPorts(o.reward)),
      ...[s.port, s.chart?.port].filter((p): p is string => typeof p === 'string' && p !== 'home'),
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
    const scope: CheckScope = { map, quests: all, steps, items: Object.keys(q.items ?? {}) };
    if (ids.has(q.id)) out.push(`${at}: id used twice`);
    ids.add(q.id);
    if (typeof q.name !== 'string' || typeof q.text !== 'string')
      out.push(`${at}: needs name and text`);
    for (const [item, def] of Object.entries(q.items ?? {}))
      if (!Number.isInteger(def?.space) || def.space < 0)
        out.push(`${at} › items.${item}: space needs a whole number (0 for a passenger)`);
    if (q.port !== undefined && !resolvePort(map, q.port)) out.push(`${at}: no port "${q.port}"`);
    if (q.offer !== undefined && typeof q.offer !== 'boolean')
      out.push(`${at}: offer is true or false`);
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
      if ((s.goal === undefined) === (s.choose === undefined))
        out.push(`${where}: needs a goal or a choice, not both`);
      if (s.goal !== undefined) out.push(...checkCondition(s.goal, scope, true, `${where} › goal`));
      out.push(...checkReward(s.reward, scope, `${where} › reward`));
      for (const p of [s.port, s.chart?.port])
        if (p !== undefined && !resolvePort(map, p)) out.push(`${where}: no port "${p}"`);
      if (s.compass && !(Number.isFinite(s.compass.x) && Number.isFinite(s.compass.y)))
        out.push(`${where} › compass: needs { "x", "y" }`);
      if (s.chart && !(typeof s.chart.radius === 'number' && s.chart.radius > 0))
        out.push(`${where} › chart: needs a radius`);
      const later = (next: string | undefined, from: string) => {
        if (next === undefined || next === QUEST_DONE) return;
        // Only forward, so a quest always ends and its progress is one step number.
        if (stepIds.indexOf(next) <= i) out.push(`${from}: next "${next}" is not a later step`);
      };
      later(s.next, where);
      if (s.choose !== undefined) {
        if (!Array.isArray(s.choose) || s.choose.length < 2)
          out.push(`${where}: a choice needs two options or more`);
        else {
          const opts = s.choose.map((o) => o.id);
          s.choose.forEach((o, k) => {
            if (typeof o.id !== 'string' || opts.indexOf(o.id) !== k)
              out.push(`${where}: bad or repeated option "${String(o.id)}"`);
            out.push(...checkReward(o.reward, scope, `${where} › ${o.id}`));
            later(o.next, `${where} › ${o.id}`);
          });
        }
      }
      if (reached.has(s.id)) {
        if (Array.isArray(s.choose)) for (const o of s.choose) reached.add(nextOf(q, s, o));
        else reached.add(nextOf(q, s));
      }
    });
    for (const id of stepIds) if (!reached.has(id)) out.push(`${at} › ${id}: no step leads here`);
  }
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
  onEvent: (e: QuestEvent) => void = () => {};

  constructor(
    private readonly world: World,
    quests: readonly QuestDef[] = QUESTS,
    options: QuestBookOptions = {},
  ) {
    this.quests = questsFor(world.map, quests);
    this.doneElsewhere = options.doneElsewhere ?? (() => false);
    this.atElsewhere = options.atElsewhere ?? (() => false);
    this.nightOk = options.nightOk ?? (() => daylightAt(this.world.time).night >= 0.5);
  }

  private get trade(): TradeState {
    return this.world.trade;
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
  /** Quests offered and not yet accepted (their start holds). */
  get offered(): QuestDef[] {
    return this.quests.filter(
      (q) => q.offer && !this.progress(q.id) && testCondition(q.start, this.context()),
    );
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
  /** Show this quest in the journal and at sea. */
  track(id: string): boolean {
    if (!this.active.some((a) => a.quest.id === id)) return false;
    this.state.tracked = id;
    return true;
  }

  private context(): ConditionContext {
    return {
      trade: this.trade,
      map: this.world.map,
      isDone: (id) => this.isDone(id),
      chose: (id, option) => Object.values(this.progress(id)?.chose ?? {}).includes(option),
      isAt: (id, step) => this.isAt(id, step),
    };
  }

  /** Called every simulation step; checks a few times a second. */
  update(dt: number): QuestEvent[] {
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
    // Each pass can only start a quest or move one forward, so this ends.
    for (let changed = true; changed;) {
      changed = false;
      for (const quest of this.quests) {
        const p = this.progress(quest.id);
        if (!p) {
          if (!testCondition(quest.start, this.context())) {
            this.announced.delete(quest.id);
            continue;
          }
          if (quest.offer) {
            if (!this.announced.has(quest.id)) events.push({ type: 'offered', quest: quest.id });
            this.announced.add(quest.id);
            continue;
          }
          events.push({ type: 'started', quest: quest.id });
          this.enter(quest, quest.steps[0]!, events);
          changed = true;
          continue;
        }
        const step = findStep(quest, p.step);
        if (!step?.goal || !testCondition(step.goal, this.context(), p.counts)) continue;
        this.finishStep(quest, step, undefined, events);
        changed = true;
      }
    }
    this.afterChange(events);
    return events;
  }

  /** The player picks `option` on the quest's current choice step. */
  choose(questId: string, optionId: string): QuestEvent[] {
    const quest = this.quests.find((q) => q.id === questId);
    const p = this.progress(questId);
    const step = quest && p && findStep(quest, p.step);
    const option = step?.choose?.find((o) => o.id === optionId);
    if (!quest || !p || !step || !option) return [];
    p.chose[step.id] = option.id;
    const events: QuestEvent[] = [];
    this.finishStep(quest, step, option, events);
    this.afterChange(events);
    // A quest waiting on this one may start now.
    return [...events, ...this.check()];
  }

  private afterChange(events: QuestEvent[]) {
    this.state.hold = questHold(this.state, this.quests);
    if (!this.state.hold) delete this.state.hold;
    const active = this.active.map((a) => a.quest.id);
    // A started quest is tracked when nothing is; a finished one hands over to the next.
    if (!this.state.tracked || !active.includes(this.state.tracked)) {
      const started = events.find((e) => e.type === 'started' && active.includes(e.quest));
      const next = started?.quest ?? active[0];
      if (next) this.state.tracked = next;
      else delete this.state.tracked;
    }
    for (const e of events) this.onEvent(e);
  }

  private enter(quest: QuestDef, step: QuestStep, events: QuestEvent[]) {
    const chose = this.progress(quest.id)?.chose ?? {};
    const counts = new Array<number>(slotLayout(step.goal).size).fill(0);
    this.state.byId[quest.id] = { step: step.id, counts, chose };
    events.push({ type: step.choose ? 'choice' : 'step', quest: quest.id, step: step.id });
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
    const to = findStep(quest, nextOf(quest, step, option));
    if (to) {
      this.enter(quest, to, events);
      return;
    }
    const p = this.progress(quest.id)!;
    this.state.byId[quest.id] = { step: QUEST_DONE, counts: [], chose: p.chose };
    this.pay(quest.reward);
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
    // The first check after loading only takes note: nothing happened "since" yet.
    if (!seen) return;
    const hit = damage > seen.damage;
    const nightOk = this.nightOk();
    for (const { quest, step } of this.active) {
      if (!step.goal) continue;
      const p = this.progress(quest.id)!;
      if (step.clean && hit) {
        p.counts = p.counts.map(() => 0);
        events.push({ type: 'reset', quest: quest.id, step: step.id });
      } else
        updateGoal(
          step.goal,
          {
            ...this.context(),
            dt,
            boat: { x: boat.x, y: boat.y, speedKn: boat.speedKn },
            from: seen,
            wasDocked: seen.docked,
            cargoBefore: seen.cargo,
            nightOk,
            freeSpace: freeSpace(trade),
            itemSpace: (item) => quest.items?.[item]?.space ?? 1,
          },
          p.counts,
        );
      // Quest cargo just loaded takes its room before the next quest loads any.
      this.state.hold = questHold(this.state, this.quests);
    }
  }
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
  const { byId, tracked } = raw as { byId?: unknown; tracked?: unknown };
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
  }
  if (typeof tracked === 'string' && out.byId[tracked] && out.byId[tracked].step !== QUEST_DONE)
    out.tracked = tracked;
  const hold = questHold(out, fitting);
  if (hold) out.hold = hold;
  return out;
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
  ]);
  let h = 0x811c9dc5;
  for (const ch of ids.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h ^ (h >>> 16)) & 0xffff || 1;
}
