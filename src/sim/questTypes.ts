import { type StepEffects, type StepWind } from './stepEffects';
import { type GoodId } from './goods';
import { type SeaMarkDef } from './map';
import { type Condition, type QuestPoint, type VarKind } from './questLibrary';
import { type QuestReward } from './questRewards';
import { type MedalRank, type RaceDef } from './regatta';
import { type RaceRecord } from './raceRecords';

/* The quest file format (decision 0113) and the progress a voyage keeps (decision 0125). */

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
  /**
   * Chart areas (fog of war, decision 0156) lifted as soon as the step begins: a pilot's chart
   * handed over, before the voyage it is for.
   */
  charts?: string[];
  /** A later step's id, or `done`; default the following step (after the last: done). */
  next?: string;
  /** Touching a reef or a shore (hull damage) starts the step over, at no other cost. */
  clean?: boolean;
  /**
   * A lesson's teaching-only step (decision 0160): passed by when the lesson runs without its coach
   * (the tutorial skipped), so only the story steps are played.
   */
  teach?: boolean;
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
  /**
   * Someone else speaks the done card instead of the giver (decision 0158): the settler who
   * founded the outpost thanks the captain on it.
   */
  doneSpeaker?: string;
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
   * A steady breeze held over every step that has no `wind` of its own while the quest is tracked
   * (decision 0164); the sea's own wind comes back once it is not.
   */
  wind?: StepWind;
  /**
   * The quest's own sea marks (decision 0164: the lessons' buoys), at sea and on the chart only
   * while the quest runs: not before it starts, not after it ends.
   */
  marks?: SeaMarkDef[];
  /**
   * A standing order (decision 0214): a person whose arc is done asks again and again. Each step is
   * one ask, taken in turn (the first round asks the first step, the next round the second, and
   * round again); a round ends with its step, and the next ask comes once the captain has docked
   * `economy.orders.standingDockings` times at other ports. Always offered, at the quest's `port`,
   * one ask at a time per port. Its step thanks with `<text>.<step>.thanks`.
   */
  repeat?: boolean;
  /**
   * Ports and goods picked in play (decision 0151), name → `port` or `good`: steps fill them
   * (`set`) and read them as `$name` in their conditions, coach marks and text (`{name}`).
   */
  vars?: Record<string, VarKind>;
  /**
   * A race of the Saltmere Regatta (decision 0217): its series, the gold its medals pay the first
   * time and its pars. Its one step's goal is `raced`; it is offered, tracked while it runs, and
   * once finished it can be sailed again (`raceAgain`), keeping the best time and medal.
   */
  race?: RaceDef;
  /** Who speaks at a race's line before the horn (`<text>.race.start`, decision 0217). */
  starter?: string;
  steps: QuestStep[];
}

/** How a step's places at sea are drawn (decision 0130). */
export const STEP_MARKER_STYLES = ['ring', 'gulls'] as const;
export type StepMarkerStyle = (typeof STEP_MARKER_STYLES)[number];

/** The `next` that finishes a quest. */
export const QUEST_DONE = 'done';

/** One started quest: its step (or `done`), the step's numbers, the options picked. */
/** A race's record rides on its progress (decisions 0217, 0226). */
export interface QuestProgress extends RaceRecord {
  step: string;
  /** The numbers the step's conditions keep (goods handed over, markers, a run's clock). */
  counts: number[];
  /** Choice step id → option id. */
  chose: Record<string, string>;
  /** The quest's vars set so far (decision 0151). */
  vars?: Record<string, string>;
  /** A standing order's rounds delivered (decision 0214). */
  rounds?: number;
  /** A standing order between rounds: dockings at other ports before it asks again (0214). */
  wait?: number;
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
  /**
   * Lessons running without their coach (decision 0160: the tutorial skipped, its story still
   * played): no bubble, and their `teach` steps are passed by. JSON save only, not FW2.
   */
  uncoached?: string[];
  /** Regatta series won (decision 0217), worked out from the races' medals on load. */
  won?: string[];
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
  /**
   * A timed run (decision 0213) got under way, ran over its par (back to the start) or was made;
   * `sec` the run's time so far, `par` its par, seconds.
   */
  | {
      type: 'run';
      quest: string;
      step: string;
      state: 'started' | 'late' | 'made';
      sec: number;
      par: number;
      from: string;
      to: string;
    }
  /** A step done paid gold (decision 0213): its own, its option's, and the quest's at the end. */
  | { type: 'paid'; quest: string; step: string; gold: number }
  /** The boat was taken to a step's `moveTo` (decision 0164). */
  | { type: 'moved'; quest: string; step: string }
  /** A reward's volcano erupts (decision 0178): the view plays it, nothing else changes. */
  | { type: 'erupt'; quest: string; island: string }
  /** A race's horn (decision 0217): the sequence is over and the clock runs. */
  | { type: 'horn'; quest: string }
  /**
   * A race finished (decision 0217): its time, the medal won, the best medal before, whether the
   * time is a new best, the gold for medals won the first time, and series won by it.
   */
  | {
      type: 'raced';
      quest: string;
      sec: number;
      medal: MedalRank;
      had: number;
      best: boolean;
      /** The race's first finish: no best before it. */
      first: boolean;
      gold: number;
      won: string[];
      /** The rival's time, seconds, if she finished first. */
      rival?: number;
    }
  /** A race given up (decision 0217): docked mid-race, or the captain retired. */
  | { type: 'retired'; quest: string }
  | { type: 'finished'; quest: string };
