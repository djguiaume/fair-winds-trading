import {
  type QuestOption,
  type QuestStep,
  type QuestDef,
  QUEST_DONE,
  type QuestProgress,
  type QuestState,
  type QuestEvent,
} from './questTypes';
import { QUESTS, findStep, questsFor } from './questFlow';
import { type StepWind } from './stepEffects';
import { daylightAt } from './daylight';
import { type GoodAmounts, isGood } from './goods';
import { type MapDef, type SeaMarkDef } from './map';
import {
  type Condition,
  type ConditionContext,
  type Helm,
  type QuestPoint,
  type Screen,
  deref,
  pointOf,
  itemsAboard,
  parFor,
  resolvePort,
  slotLayout,
  testCondition,
  goalNews,
  type StepNews,
  RUN_GOING,
  RACE_GOING,
  RACE_HORN,
} from './questLibrary';
import { REGATTA, type RaceCourse, courseOf, raceMarks } from './regatta';
import { deckFree, type TradeState } from './trade';
import type { World } from './world';
import { standingOrderGold } from './contracts';

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
 * What the quest book knows (decision 0125): the voyage's quests, where each one is and what it
 * offers, read without changing anything. `questBookSteps.ts` moves them on, `quests.ts` acts.
 */
export abstract class QuestBookBase {
  readonly quests: readonly QuestDef[];
  protected seen: Seen | null = null;
  /** Offered quests already announced, so `offered` is sent once each. */
  protected announced = new Set<string>();
  protected since = 0;
  /** A check made again after a step began (decision 0213). */
  protected again = false;
  protected readonly doneElsewhere: (id: string) => boolean;
  protected readonly atElsewhere: (id: string, step: string) => boolean;
  protected readonly nightOk: () => boolean;
  protected readonly screen: () => Screen;
  /** The helm since the last check (decision 0151). */
  protected helm: Helm = { sails: [], steerSec: 0, movingSec: 0 };
  /** Which side the wind was on, upwind, for counting tacks (decision 0164); 0 not yet known. */
  protected windSide = 0;
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

  protected get trade(): TradeState {
    return this.world.trade;
  }

  /** The map the quests run on. */
  get map(): MapDef {
    return this.world.map;
  }

  protected get state(): QuestState {
    return this.trade.quests;
  }

  progress(id: string): QuestProgress | undefined {
    return this.state.byId[id];
  }

  isDone(id: string): boolean {
    const p = this.progress(id);
    // A race finished once is done, sailed again or not (decision 0217).
    return p?.step === QUEST_DONE || p?.best !== undefined || this.doneElsewhere(id);
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

  /** The tracked step's breeze: its own `wind`, else its quest's (decision 0164). */
  get trackedWind(): StepWind | undefined {
    const a = this.active.find((a) => a.quest.id === this.tracked);
    return a && (a.step.wind ?? a.quest.wind);
  }

  /** The sea marks of the quests running now (decision 0164). */
  get runningMarks(): SeaMarkDef[] {
    return this.active.flatMap((a) => {
      const course = a.quest.race && courseOf(a.step.goal);
      return [...(a.quest.marks ?? []), ...(course ? raceMarks(course) : [])];
    });
  }

  /**
   * The race under way (decision 0217), for the clock at sea: the sequence's seconds left, the
   * clock, the marks rounded, the course.
   */
  race():
    | {
        quest: QuestDef;
        state: 'sequence' | 'racing' | 'finished';
        left: number;
        sec: number;
        started: boolean;
        rounded: number;
        course: RaceCourse;
      }
    | undefined {
    for (const { quest, step } of this.active) {
      const course = quest.race && courseOf(step.goal);
      if (!course) continue;
      const [state, t, done] = this.progress(quest.id)!.counts;
      return {
        quest,
        state: state === RACE_HORN ? 'sequence' : state === RACE_GOING ? 'racing' : 'finished',
        left: state === RACE_HORN ? Math.max(0, REGATTA.countdownSec - (t ?? 0) / 100) : 0,
        sec: state === RACE_HORN ? 0 : (t ?? 0) / 100,
        started: (done ?? 0) > 0,
        rounded: Math.max(0, (done ?? 0) - 1),
        course,
      };
    }
    return undefined;
  }

  /** The races finished at least once, for Rook's book and "Race again" (decision 0217). */
  get raced(): QuestDef[] {
    return this.quests.filter((q) => q.race && this.progress(q.id)?.best !== undefined);
  }

  /** Regatta series won (decision 0217). */
  get won(): string[] {
    return this.state.won ?? [];
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

  protected get waiting(): QuestDef[] {
    const ready = this.quests.filter(
      (q) => q.offer && this.mayStart(q) && testCondition(q.start, this.context()),
    );
    return ready.filter((q) => !q.repeat || this.asksAt(q, ready));
  }

  /** No progress yet, or a standing order between rounds whose wait is over (decision 0214). */
  protected mayStart(quest: QuestDef): boolean {
    const p = this.progress(quest.id);
    return !p || (!!quest.repeat && p.step === QUEST_DONE && !p.wait);
  }

  /**
   * Whether this standing order is the one its port asks now (decision 0214): one ask at a time per
   * port, none while one runs there; of those ready, the one asked fewest times, then file order.
   * An ask the captain said "don't offer again" to leaves the port to the next.
   */
  protected asksAt(quest: QuestDef, ready: readonly QuestDef[]): boolean {
    const port = resolvePort(this.world.map, quest.port);
    const here = (q: QuestDef) => q.repeat && resolvePort(this.world.map, q.port) === port;
    if (this.active.some((a) => here(a.quest))) return false;
    const rounds = (q: QuestDef) => this.progress(q.id)?.rounds ?? 0;
    const first = ready
      .filter((q) => here(q) && !this.isIgnored(q.id))
      .reduce<QuestDef | undefined>((a, q) => (!a || rounds(q) < rounds(a) ? q : a), undefined);
    return !first || first.id === quest.id || this.isIgnored(quest.id);
  }

  /**
   * What a step paid like a help order pays now (`order`, decision 0214): the goods it lands at
   * its port, on the voyage's level. Undefined for any other step.
   */
  orderGold(step: QuestStep | undefined): number | undefined {
    const g = step?.goal;
    if (!step?.reward?.order || g?.is !== 'landed' || !isGood(g.good)) return undefined;
    const port = resolvePort(this.world.map, g.place);
    if (!port || typeof g.qty !== 'number') return undefined;
    return standingOrderGold(this.world.map, this.trade, port, g.good, g.qty);
  }

  isIgnored(id: string): boolean {
    return this.state.ignored?.includes(id) ?? false;
  }

  get tracked(): string | undefined {
    return this.state.tracked;
  }

  /** Whether a lesson speaks in its coach bubble (decision 0160): not after `coachOff`. */
  isCoached(id: string): boolean {
    return !this.state.uncoached?.includes(id);
  }

  /** A step this quest passes by now: a teaching step of a lesson without its coach (0160). */
  protected passesBy(quest: QuestDef, step: QuestStep): boolean {
    return !!step.teach && !this.isCoached(quest.id);
  }

  protected context(quest?: QuestDef): ConditionContext {
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
      won: this.state.won,
    };
  }

  /** Quest cargo aboard (decision 0213): what fills the hold besides goods, for the hold lists. */
  cargo(): { quest: string; item: string; n: number; space: number }[] {
    const out: { quest: string; item: string; n: number; space: number }[] = [];
    for (const { quest, step } of this.active)
      for (const [item, n] of itemsAboard(step.goal, this.progress(quest.id)!.counts))
        if (n > 0)
          out.push({ quest: quest.id, item, n, space: n * (quest.items?.[item]?.space ?? 1) });
    return out;
  }

  /** Timed runs under way (decision 0213): for the clock at sea. */
  runs(): { quest: string; step: string; sec: number; par: number; to: string }[] {
    const out: { quest: string; step: string; sec: number; par: number; to: string }[] = [];
    for (const { quest, step } of this.active) {
      const counts = this.progress(quest.id)!.counts;
      for (const [c, at] of slotLayout(step.goal).at) {
        if (c.is !== 'timed' || counts[at] !== RUN_GOING) continue;
        const vars = this.progress(quest.id)?.vars;
        const map = this.world.map;
        const from = resolvePort(map, deref(c.from, vars)) ?? '';
        out.push({
          quest: quest.id,
          step: step.id,
          sec: (counts[at + 1] ?? 0) / 100,
          par: parFor(c.par, this.trade),
          to: resolvePort(map, deref(c.to, vars)) ?? from,
        });
      }
    }
    return out;
  }

  /**
   * What the started quests say where the boat is now (decision 0213): quest cargo loaded or left
   * on the quay, cargo unloaded, goods handed over so far. Read after a check; changes nothing.
   */
  news(): (StepNews & { quest: string; step: string })[] {
    const { boat, trade } = this.world;
    const out: (StepNews & { quest: string; step: string })[] = [];
    for (const { quest, step } of this.active) {
      if (!step.goal) continue;
      const p = this.progress(quest.id)!;
      const ctx = {
        ...this.context(quest),
        dt: 0,
        boat: { x: boat.x, y: boat.y, speedKn: boat.speedKn },
        from: boat,
        wasDocked: trade.dockedAt,
        cargoBefore: trade.captain.cargo,
        nightOk: true,
        freeSpace: deckFree(trade),
        itemSpace: (item: string) => quest.items?.[item]?.space ?? 1,
      };
      for (const news of goalNews(step.goal, ctx, p.counts))
        out.push({ ...news, quest: quest.id, step: step.id });
    }
    return out;
  }
}
