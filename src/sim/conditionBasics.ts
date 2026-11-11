import { isGood, type GoodAmounts, type GoodId } from './goods';
import { landmarkSpot } from './landmarks';
import type { MapDef } from './map';
import type { PointOfSail } from './ship';
import { homePort } from './shipyards';
import type { TradeState } from './trade';

/*
 * What every quest condition shares (decision 0125): the condition and its context, the places it
 * names, its parameters, and the small readers the condition families use (`questLibrary.ts`).
 */

/** A condition in a quest file: `{ "is": "<kind>", …params }`. */
export interface Condition {
  is: string;
  [param: string]: unknown;
}

/** A point at sea, in map units. */
export interface QuestPoint {
  x: number;
  y: number;
}

/**
 * A spot at sea (decision 0131): a landing or a mooring with no harbour. A boat is there once it
 * has stayed inside `within` units, under `maxKn`, for `holdSec` seconds; it stays there, like a
 * boat alongside a port, until it leaves or speeds up.
 */
export interface QuestSpot extends QuestPoint {
  within: number;
  maxKn?: number;
  holdSec?: number;
}

/**
 * Places a quest names by word because each map puts them somewhere else (decision 0151): `wreck`
 * is the wreck of the map's prologue (decision 0127). A `reach` point or a step's `compass` may be
 * one of these words; a step whose place is not on the map is passed by.
 */
export const MAP_PLACES: Record<string, (map: MapDef) => QuestPoint | null> = {
  wreck: (map) => (map.prologue ? landmarkSpot(map, map.prologue.wreck) : null),
};

/** A point, or a map place by its word (null when the map has no such place). */
export function pointOf(map: MapDef, p: unknown): QuestPoint | null {
  if (typeof p === 'string') return MAP_PLACES[p]?.(map) ?? null;
  return typeof p === 'object' && p !== null ? (p as QuestPoint) : null;
}

/**
 * A quest's own words for a port or a good chosen in play (decision 0151): `"$origin"` names the
 * quest's var `origin` (its `vars`), else the value is itself. An unset var is undefined.
 */
export function deref(v: unknown, vars: Readonly<Record<string, string>> | undefined): unknown {
  return typeof v === 'string' && v.startsWith('$') ? vars?.[v.slice(1)] : v;
}

/** Whether a value names one of the quest's vars (`$name`). */
export const isVarRef = (v: unknown): v is string => typeof v === 'string' && v.startsWith('$');

/** Whether a `place` parameter is a spot at sea (else it is a port id). */
export const isSpot = (v: unknown): v is QuestSpot =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** What a condition reads. */
export interface ConditionContext {
  trade: TradeState;
  map: MapDef;
  /** Whether a quest is done (the tutorial: finished or skipped). */
  isDone(questId: string): boolean;
  /** Whether a quest's choice picked `option`. */
  chose(questId: string, option: string): boolean;
  /** Whether a quest has reached `step` (or a later one) or is done. */
  isAt(questId: string, step: string): boolean;
  /** The checked quest's vars (decision 0151): `$name` in a parameter reads them. */
  vars?: Readonly<Record<string, string>>;
  /** The port of the course set on the chart, if any. */
  course?: string | null;
  /** What is open: the sea, the chart or the market (the harbour screen). */
  screen?: Screen;
  /** The regatta series won so far (decision 0217). */
  won?: readonly string[];
}

/** The surfaces the captain can have open, for `screen` and lesson coach marks. */
export const SCREENS = ['sea', 'chart', 'market'] as const;
export type Screen = (typeof SCREENS)[number];

/**
 * The helm since the last check (decision 0151), for `sails-practised`: the sail settings in the
 * order they were set, and the seconds spent steering and making way.
 */
export interface Helm {
  sails: number[];
  steerSec: number;
  movingSec: number;
  /** Seconds on each point of sail (`point-of-sail`, decision 0164). */
  pointSec?: Partial<Record<PointOfSail, number>>;
  /** Tacks made: the bow turned across the wind (`tacked`, decision 0164). */
  tacks?: number;
}

/** The points of sail a `point-of-sail` condition can ask for, from the wind's eye to dead astern. */
export const POINTS_OF_SAIL: readonly PointOfSail[] = [
  'in-irons',
  'close-hauled',
  'beam-reach',
  'broad-reach',
  'running',
];

/** What a condition with slots sees at each check while its step runs. */
export interface StepContext extends ConditionContext {
  /** Seconds of play since the last check. */
  dt: number;
  /** The boat now and at the last check (for markers passed between two checks). */
  boat: { x: number; y: number; speedKn: number };
  from: QuestPoint;
  /** The port alongside at the last check. */
  wasDocked: string | null;
  /** The hold at the last check. */
  cargoBefore: GoodAmounts;
  /** Whether night counts now: night, or any time when night is switched off. */
  nightOk: boolean;
  /** Deck room free for quest cargo (decision 0213). */
  freeSpace: number;
  /** Hold spaces one piece of a quest item takes. */
  itemSpace(item: string): number;
  /** The helm since the last check (empty when the game passed no controls). */
  helm?: Helm;
  /** Take goods out of the hold for the quest (`landed`, decision 0157); the game says so. */
  land?(good: GoodId, qty: number): void;
}

/** What a parameter holds, for the checks and the quest builder; a trailing `?` makes it optional. */
export type Param =
  | 'port'
  | 'place'
  | 'good'
  | 'ship'
  | 'series'
  | 'building'
  | 'island'
  | 'quest'
  | 'step'
  | 'option'
  | 'item'
  | 'count'
  | 'number'
  | 'flag'
  | 'points'
  | 'order'
  | 'par'
  | 'gate'
  | 'condition'
  | 'conditions'
  | 'screen'
  | 'sailing';
export type ParamSpec = Param | `${Param}?`;
/** A kind of condition: its parameters, its numbers (slots) and how it reads the voyage. */
export interface ConditionKind {
  params: Record<string, ParamSpec>;
  /** Numbers kept while the step runs; only in a step's goal. */
  slots?: number;
  /** Move the numbers on, at every check while the step runs. */
  update?(c: Condition, ctx: StepContext, s: number[]): void;
  /** `s`: its own numbers; `goal`: the step's whole goal, for `all`, `any` and `not`. */
  test(c: Condition, ctx: ConditionContext, s: number[], goal: Condition): boolean;
  /**
   * What the captain should hear where the boat is now (decision 0213): quest cargo loaded or
   * left on the quay, goods handed over so far. Null when this place says nothing for the step.
   */
  news?(c: Condition, ctx: StepContext, s: number[]): StepNews | null;
}

/**
 * The kinds of dock news (decision 0213), each a line of text (`quest.news.<kind>`):
 * `loaded` quest cargo aboard, all of it (`loadedOne` a single piece, `loadedPassenger` a person);
 * `loadedShort` some aboard, the rest left for want of room; `noRoom` none aboard for want of room;
 * `nothingAboard` at the drop-off with nothing for it; `unloaded` some, not all, unloaded there;
 * `handHere` alongside a hand-over port with the goods aboard; `handedOver` some handed over;
 * `runReady` alongside the start of a timed run, `runAgain` at its end with the run not made.
 */
export const NEWS_KINDS = [
  'loaded',
  'loadedOne',
  'loadedPassenger',
  'loadedShort',
  'noRoom',
  'nothingAboard',
  'unloaded',
  'handHere',
  'handedOver',
  'runReady',
  'runAgain',
] as const;
export type NewsKind = (typeof NEWS_KINDS)[number];

/** A place in dock news: a port id, or `spot` for a spot at sea. */
export type NewsPlace = string;

/** Dock news for one step (decision 0213), in numbers: the interface words it. */
export interface StepNews {
  kind: NewsKind;
  /** Quest cargo (`carried`), or a good (`delivered`). */
  item?: string;
  good?: GoodId;
  /** Pieces aboard, or unloaded at this call. */
  n: number;
  /** Still to fetch or hand over. */
  left: number;
  /** Delivered so far, and of how many. */
  done: number;
  total: number;
  /** Hold space to free for one more piece. */
  space: number;
  /** Where the cargo goes, and where it comes from. */
  to?: NewsPlace;
  from?: NewsPlace;
  /** A timed run's par, seconds. */
  par?: number;
}

/** `port` may be `"home"`, the map's home port. */
export function resolvePort(map: MapDef, id: unknown): string | null {
  if (id === 'home') return homePort(map).id;
  return typeof id === 'string' && map.ports.some((p) => p.id === id) ? id : null;
}

/** A number parameter, or `fallback` when it is not one. */
export const numParam = (v: unknown, fallback = 0) => (typeof v === 'number' ? v : fallback);
/** A port parameter (`key`, a port id, `home` or a `$var`) on this map; null when none. */
export const portParam = (c: Condition, ctx: ConditionContext, key = 'port') =>
  resolvePort(ctx.map, deref(c[key], ctx.vars));
/** A `good` parameter (or a `$var` holding one); null when unset or not a good. */
export const goodParam = (c: Condition, ctx: ConditionContext): GoodId | null => {
  const g = deref(c.good, ctx.vars);
  return isGood(g) ? g : null;
};
