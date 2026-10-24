import { isDifficulty } from './difficulty';
import { GOODS, isGood, type GoodAmounts, type GoodId } from './goods';
import { landmarkSpot } from './landmarks';
import type { MapDef } from './map';
import { SHIP_CLASSES } from './ship';
import {
  buildingById,
  giveHomeIsland,
  hasBuilding,
  homeSpots,
  offerHomeSpot,
  resolveSpot,
} from './home';
import { foundSite } from './founding';
import { MAX_SETTLEMENT_LEVEL, settlementLevel } from './settlement';
import { homePort, isDiscovered, standingAt } from './shipyards';
import type { TradeState } from './trade';

/*
 * The quest engine's code library (decision 0125), like ship parts: the kinds of condition a quest
 * file can use as a start or a step goal, and the kinds of reward it can pay. A quest made from
 * these kinds is a file; a new kind is code once, here, with its check.
 *
 * Some conditions keep numbers while their step runs (goods handed over, markers reached, a run's
 * clock): their `slots`. The numbers are saved with the voyage, so a step goes on where it was.
 */

/** A condition in a quest file: `{ "is": "<kind>", …params }`. */
export interface Condition {
  is: string;
  [param: string]: unknown;
}

/** What a quest, a step or a choice pays. */
export interface QuestReward {
  gold?: number;
  /** Port → orders' worth of standing with its shipwright (decision 0048). */
  standing?: Record<string, number>;
  /** Ports put on the chart. */
  discover?: string[];
  /** Ports that go up one town level at once (decision 0120's "step up"). */
  levelUp?: string[];
  /**
   * Empty islands founded (decision 0155): ports marked `site` in the map open at their start
   * level and go on the chart.
   */
  found?: string[];
  /**
   * An island becomes the captain's: `true` for the map's home island (the prologue's reward,
   * decision 0126), or the id of another island with build spots (decision 0128).
   */
  homeIsland?: boolean | string;
  /**
   * Arc spots offered: the captain picks one building of the pair there (0126). `spot-2` is on
   * the home island, `<island>:spot-2` on another one (0128).
   */
  homeSpot?: string[];
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
}

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
  /** Hold space free for quest cargo. */
  freeSpace: number;
  /** Hold spaces one piece of a quest item takes. */
  itemSpace(item: string): number;
  /** The helm since the last check (empty when the game passed no controls). */
  helm?: Helm;
  /** Take goods out of the hold for the quest (`landed`, decision 0155); the game says so. */
  land?(good: GoodId, qty: number): void;
}

/** What a parameter holds, for the checks and the quest builder; a trailing `?` makes it optional. */
export type Param =
  | 'port'
  | 'place'
  | 'good'
  | 'ship'
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
  | 'condition'
  | 'conditions'
  | 'screen';
export type ParamSpec = Param | `${Param}?`;

interface ConditionKind {
  params: Record<string, ParamSpec>;
  /** Numbers kept while the step runs; only in a step's goal. */
  slots?: number;
  /** Move the numbers on, at every check while the step runs. */
  update?(c: Condition, ctx: StepContext, s: number[]): void;
  /** `s`: its own numbers; `goal`: the step's whole goal, for `all`, `any` and `not`. */
  test(c: Condition, ctx: ConditionContext, s: number[], goal: Condition): boolean;
}

/** `port` may be `"home"`, the map's home port. */
export function resolvePort(map: MapDef, id: unknown): string | null {
  if (id === 'home') return homePort(map).id;
  return typeof id === 'string' && map.ports.some((p) => p.id === id) ? id : null;
}

const num = (v: unknown, fallback = 0) => (typeof v === 'number' ? v : fallback);
const port = (c: Condition, ctx: ConditionContext, key = 'port') =>
  resolvePort(ctx.map, deref(c[key], ctx.vars));
/** A `good` parameter (or a `$var` holding one); null when unset or not a good. */
const goodOf = (c: Condition, ctx: ConditionContext): GoodId | null => {
  const g = deref(c.good, ctx.vars);
  return isGood(g) ? g : null;
};
/** A `reach` condition's points on this map (a map place it lacks is left out). */
const pointsOf = (c: Condition, map: MapDef): (QuestPoint | null)[] =>
  ((c.points as unknown[]) ?? []).map((p) => pointOf(map, p));

/** Distance from `p` to the segment a→b: a marker passed between two checks still counts. */
function passDistance(a: QuestPoint, b: QuestPoint, p: QuestPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const k = len > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
  return Math.hypot(a.x + k * dx - p.x, a.y + k * dy - p.y);
}

/**
 * Markers (`reach`): points to pass within `within` units, in any order or in order. With `maxKn`
 * and `holdSec`, the boat must stay inside, slower than `maxKn`, for `holdSec` seconds. With
 * `atNight`, only while night counts. Slots: the markers reached (a bit each, or how many in
 * order), and hundredths of a second held at the current one.
 */
function updateReach(c: Condition, ctx: StepContext, s: number[]) {
  const points = pointsOf(c, ctx.map);
  const within = num(c.within);
  const inOrder = c.order === 'in-order';
  if (c.atNight && !ctx.nightOk) {
    s[1] = 0;
    return;
  }
  const holding = c.holdSec !== undefined;
  let held = false;
  // In order, one marker a check: a pass that sweeps the next two backwards counts only one.
  const next = s[0]!;
  points.forEach((p, i) => {
    const reached = inOrder ? i < next : (s[0]! & (1 << i)) !== 0;
    if (!p || reached || (inOrder && i !== next)) return;
    if (!holding) {
      if (passDistance(ctx.from, ctx.boat, p) <= within)
        s[0] = inOrder ? s[0]! + 1 : s[0]! | (1 << i);
      return;
    }
    const inside = Math.hypot(ctx.boat.x - p.x, ctx.boat.y - p.y) <= within;
    if (!inside || ctx.boat.speedKn > num(c.maxKn, Infinity)) return;
    held = true;
    s[1] = s[1]! + Math.round(ctx.dt * 100);
    if (s[1]! >= num(c.holdSec) * 100) {
      s[0] = inOrder ? s[0]! + 1 : s[0]! | (1 << i);
      s[1] = 0;
    }
  });
  if (!held) s[1] = 0;
}

const reachDone = (c: Condition, s: number[]) => {
  const n = (c.points as unknown[]).length;
  return c.order === 'in-order' ? s[0]! >= n : s[0] === 2 ** n - 1;
};

/** Inside a spot at sea, slow enough. */
function inSpot(spot: QuestSpot, ctx: StepContext): boolean {
  return (
    Math.hypot(ctx.boat.x - spot.x, ctx.boat.y - spot.y) <= spot.within &&
    ctx.boat.speedKn <= (spot.maxKn ?? Infinity)
  );
}

const holdOf = (spot: QuestSpot) => Math.round(num(spot.holdSec) * 100);

/** A run's par, seconds, for the voyage's difficulty level. */
export function parFor(par: unknown, trade: TradeState): number {
  if (typeof par === 'number') return par;
  const levels = par as Record<string, number>;
  return levels[trade.difficulty] ?? Math.max(...Object.values(levels));
}

/** Run states in the first slot of `timed`. */
const RUN_READY = 0;
const RUN_GOING = 1;
const RUN_MADE = 2;

/**
 * A timed run (`timed`): the clock starts when the boat leaves `from`, passes `via` in order and
 * stops alongside `to` (default `from`). Over par, the run is off: dock at `from` and go again, as
 * often as you like. Slots: the run's state, hundredths of a second on the clock, `via` passed.
 */
function updateTimed(c: Condition, ctx: StepContext, s: number[]) {
  if (s[0] === RUN_MADE) return;
  const from = port(c, ctx, 'from');
  const to = port(c, ctx, 'to') ?? from;
  const docked = ctx.trade.dockedAt;
  if (s[0] === RUN_READY) {
    if (ctx.wasDocked === from && docked !== from) {
      s[0] = RUN_GOING;
      s[1] = 0;
      s[2] = 0;
    }
    return;
  }
  s[1] = s[1]! + Math.round(ctx.dt * 100);
  const via = (c.via as QuestPoint[] | undefined) ?? [];
  const next = via[s[2]!];
  if (next && passDistance(ctx.from, ctx.boat, next) <= num(c.within, 15)) s[2] = s[2]! + 1;
  if (s[1]! > parFor(c.par, ctx.trade) * 100) {
    s[0] = RUN_READY;
    s[1] = 0;
    s[2] = 0;
  } else if (docked === to && s[2]! >= via.length) s[0] = RUN_MADE;
}

/**
 * The sails drill (`sails-practised`, decision 0151): sails lowered all the way and raised again, a
 * touch of steering and a little way on. Slots: lowered, raised (0 or 1), hundredths of a second
 * steering, hundredths of a second making way.
 */
function updateSailsPractised(_c: Condition, ctx: StepContext, s: number[]) {
  const helm = ctx.helm;
  if (!helm) return;
  for (const sail of helm.sails) {
    if (sail === 0) s[0] = 1;
    else if (s[0]) s[1] = 1;
  }
  s[2] = s[2]! + Math.round(helm.steerSec * 100);
  s[3] = s[3]! + Math.round(helm.movingSec * 100);
}

/** The goods bought alongside a port since the last check: good → how many more aboard. */
function boughtSince(ctx: StepContext, good: GoodId | null): number {
  let n = 0;
  for (const g of good ? [good] : GOODS)
    n += Math.max(0, ctx.trade.captain.cargo[g] - ctx.cargoBefore[g]);
  return n;
}

export const CONDITIONS: Record<string, ConditionKind> = {
  always: { params: {}, test: () => true },
  all: {
    params: { of: 'conditions' },
    test: (c, ctx, s, goal) => (c.of as Condition[]).every((m) => testCondition(m, ctx, s, goal)),
  },
  any: {
    params: { of: 'conditions' },
    test: (c, ctx, s, goal) => (c.of as Condition[]).some((m) => testCondition(m, ctx, s, goal)),
  },
  not: {
    params: { of: 'condition' },
    test: (c, ctx, s, goal) => !testCondition(c.of as Condition, ctx, s, goal),
  },
  'quest-done': { params: { quest: 'quest' }, test: (c, ctx) => ctx.isDone(c.quest as string) },
  'quest-at': {
    params: { quest: 'quest', step: 'step' },
    test: (c, ctx) => ctx.isAt(c.quest as string, c.step as string),
  },
  chose: {
    params: { quest: 'quest', option: 'option' },
    test: (c, ctx) => ctx.chose(c.quest as string, c.option as string),
  },
  /** Never holds by itself: the game starts the quest when asked for it (the tutorial, 0151). */
  asked: { params: {}, test: () => false },
  /** Alongside `port`, or any port when it names none. */
  docked: {
    params: { port: 'port?' },
    test: (c, ctx) => {
      const at = ctx.trade.dockedAt;
      return c.port === undefined ? at !== null : at !== null && at === port(c, ctx);
    },
  },
  /** A course set on the chart to `port`, or to any port when it names none. */
  course: {
    params: { port: 'port?' },
    test: (c, ctx) => {
      const to = ctx.course ?? null;
      return c.port === undefined ? to !== null : to !== null && to === port(c, ctx);
    },
  },
  /** The chart or the market is open (or the sea, with nothing over it). */
  screen: { params: { screen: 'screen' }, test: (c, ctx) => (ctx.screen ?? 'sea') === c.screen },
  discovered: {
    params: { port: 'port' },
    test: (c, ctx) => isDiscovered(ctx.trade, port(c, ctx) ?? ''),
  },
  'town-level': {
    params: { port: 'port', atLeast: 'count' },
    test: (c, ctx) => settlementLevel(ctx.trade, port(c, ctx) ?? '') >= num(c.atLeast),
  },
  standing: {
    params: { port: 'port', atLeast: 'count' },
    test: (c, ctx) => standingAt(ctx.trade, port(c, ctx) ?? '') >= num(c.atLeast),
  },
  'orders-done': {
    params: { atLeast: 'count' },
    test: (c, ctx) => ctx.trade.contracts.completed >= num(c.atLeast),
  },
  gold: {
    params: { atLeast: 'count' },
    test: (c, ctx) => ctx.trade.captain.gold >= num(c.atLeast),
  },
  /** At least `qty` (default 1) of a good aboard; with no `good`, of goods of any kind. */
  'has-cargo': {
    params: { good: 'good?', qty: 'count?' },
    test: (c, ctx) => {
      const qty = num(c.qty, 1);
      if (c.good === undefined)
        return GOODS.reduce((n, g) => n + ctx.trade.captain.cargo[g], 0) >= qty;
      const good = goodOf(c, ctx);
      return good !== null && ctx.trade.captain.cargo[good] >= qty;
    },
  },
  /**
   * A building stands on one of the captain's islands, or on `island` (decisions 0126, 0128): a
   * port can follow the choice.
   */
  built: {
    params: { building: 'building', island: 'island?' },
    test: (c, ctx) =>
      hasBuilding(ctx.trade.home, c.building as string, c.island as string | undefined),
  },
  /** Moored at the pier of the home island, or of `island` (one of hers with build spots). */
  moored: {
    params: { island: 'island?' },
    test: (c, ctx) => {
      const docked = ctx.trade.home.docked;
      return !!docked && docked === ((c.island as string | undefined) ?? ctx.map.homeIsland);
    },
  },
  'owns-ship': {
    params: { ship: 'ship' },
    test: (c, ctx) => ctx.trade.captain.ships[c.ship as string] !== undefined,
  },
  /**
   * Goods handed over alongside `port`, sold or for an order, since the step began; buying the
   * same good back there counts off again. Slot: how many.
   */
  delivered: {
    params: { port: 'port', good: 'good', qty: 'count' },
    slots: 1,
    update(c, ctx, s) {
      const at = port(c, ctx);
      const good = goodOf(c, ctx);
      if (!at || !good || ctx.trade.dockedAt !== at) return;
      const handed = ctx.cargoBefore[good] - ctx.trade.captain.cargo[good];
      s[0] = Math.min(num(c.qty), Math.max(0, s[0]! + handed));
    },
    test: (c, _ctx, s) => s[0]! >= num(c.qty),
  },
  /**
   * Goods bought alongside `port` since the step began (with no `good`, of any kind); a good taken
   * aboard there any other way counts too. Slot: how many.
   */
  bought: {
    params: { port: 'port', good: 'good?', qty: 'count' },
    slots: 1,
    update(c, ctx, s) {
      const at = port(c, ctx);
      if (!at || ctx.trade.dockedAt !== at) return;
      if (c.good !== undefined && !goodOf(c, ctx)) return;
      s[0] = Math.min(num(c.qty), s[0]! + boughtSince(ctx, goodOf(c, ctx)));
    },
    test: (c, _ctx, s) => s[0]! >= num(c.qty),
  },
  /**
   * Goods landed for the quest at `place` (decision 0155): alongside a port, or held slowly at a
   * spot at sea, they come out of the hold by themselves, as many as she has aboard up to `qty`,
   * so a short load lands what it can and the rest comes later. Nothing is paid; founding goods
   * for an empty island land this way. Slots: how many landed, hundredths of a second held.
   */
  landed: {
    params: { place: 'place', good: 'good', qty: 'count' },
    slots: 2,
    update(c, ctx, s) {
      const good = goodOf(c, ctx);
      const place = c.place;
      let at: boolean;
      if (isSpot(place)) {
        // Held up to the spot's time, then kept there while the boat stays: "alongside".
        s[1] = inSpot(place, ctx) ? Math.min(s[1]! + Math.round(ctx.dt * 100), holdOf(place)) : 0;
        at = inSpot(place, ctx) && s[1]! >= holdOf(place);
      } else at = ctx.trade.dockedAt !== null && ctx.trade.dockedAt === port(c, ctx, 'place');
      if (!at || !good || !ctx.land) return;
      const n = Math.min(num(c.qty) - s[0]!, ctx.trade.captain.cargo[good]);
      if (n <= 0) return;
      ctx.land(good, n);
      s[0] = s[0]! + n;
    },
    test: (c, _ctx, s) => s[0]! >= num(c.qty),
  },
  /** The sails drill: lower, raise, steer and get under way (the first lesson). */
  'sails-practised': {
    params: {},
    slots: 4,
    update: updateSailsPractised,
    test: (_c, _ctx, s) => !!s[0] && !!s[1] && s[2]! >= 30 && s[3]! >= 100,
  },
  /**
   * Quest cargo (`carried`): pieces of the quest's `item`, loaded at `from` as far as the hold has
   * room, unloaded at `to`. Each is a port (alongside) or a spot at sea (decision 0131: held
   * slowly there). It takes hold space and cannot be sold. Slots: pieces aboard, pieces delivered,
   * hundredths of a second held at a spot.
   */
  carried: {
    params: { item: 'item', qty: 'count', from: 'place', to: 'place' },
    slots: 3,
    update(c, ctx, s) {
      const spot = [c.from, c.to].find((p) => isSpot(p) && inSpot(p, ctx)) as QuestSpot | undefined;
      // Held up to the spot's time, then kept there while the boat stays: "alongside".
      s[2] = spot ? Math.min(s[2]! + Math.round(ctx.dt * 100), holdOf(spot)) : 0;
      const at = (key: 'from' | 'to') =>
        isSpot(c[key])
          ? c[key] === spot && s[2]! >= holdOf(spot)
          : ctx.trade.dockedAt === port(c, ctx, key);
      if (at('from')) {
        const space = ctx.itemSpace(c.item as string);
        // Space 0: a passenger, who takes no room in the hold.
        const room = space > 0 ? Math.floor(ctx.freeSpace / space) : Infinity;
        s[0] = s[0]! + Math.max(0, Math.min(num(c.qty) - s[0]! - s[1]!, room));
      }
      if (at('to')) {
        s[1] = s[1]! + s[0]!;
        s[0] = 0;
      }
    },
    test: (c, _ctx, s) => s[1]! >= num(c.qty),
  },
  reach: {
    params: {
      points: 'points',
      within: 'number',
      order: 'order?',
      maxKn: 'number?',
      holdSec: 'number?',
      atNight: 'flag?',
    },
    slots: 2,
    update: updateReach,
    test: (c, _ctx, s) => reachDone(c, s),
  },
  timed: {
    params: { from: 'port', to: 'port?', via: 'points?', within: 'number?', par: 'par' },
    slots: 3,
    update: updateTimed,
    test: (_c, _ctx, s) => s[0] === RUN_MADE,
  },
};

/**
 * Each condition kind in a few words, for the quest builder's kind picker (decision 0142). The
 * builder's fields come from `params` above, so a new kind shows there once it has its line here.
 */
export const CONDITION_ABOUT: Record<string, string> = {
  always: 'at once',
  all: 'all of several conditions',
  any: 'any one of several conditions',
  not: 'a condition does not hold',
  'quest-done': 'a quest is finished',
  'quest-at': 'a quest has reached a step',
  chose: 'an option was picked in a quest',
  asked: 'the game asks for it (the tutorial)',
  docked: 'alongside a port',
  course: 'a course set on the chart',
  screen: 'the chart or the market is open',
  discovered: 'a port is on the chart',
  'town-level': 'a town has grown to a level',
  standing: 'standing with a shipwright',
  'orders-done': 'orders completed',
  gold: 'gold in hand',
  'has-cargo': 'goods in the hold',
  built: 'a building stands on an island',
  moored: 'moored at an island’s pier',
  'owns-ship': 'owns a ship',
  delivered: 'hand over goods at a port',
  landed: 'land goods from the hold at a port or a spot (founding goods)',
  bought: 'buy goods at a port',
  'sails-practised': 'lower and raise the sails, steer, get under way',
  carried: 'carry quest cargo from one place to another',
  reach: 'sail to places at sea',
  timed: 'a run against the clock',
};

/**
 * Where each condition with slots keeps its numbers in a goal, and how many there are. Cached:
 * quest files do not change while the game runs.
 */
const layouts = new WeakMap<Condition, { at: Map<Condition, number>; size: number }>();
export function slotLayout(goal: Condition | undefined): {
  at: Map<Condition, number>;
  size: number;
} {
  if (!goal) return { at: new Map(), size: 0 };
  const cached = layouts.get(goal);
  if (cached) return cached;
  const at = new Map<Condition, number>();
  let size = 0;
  const walk = (c: Condition) => {
    const kind = CONDITIONS[c.is];
    if (!kind) return;
    if (kind.slots) {
      at.set(c, size);
      size += kind.slots;
    }
    if (c.is === 'all' || c.is === 'any') (c.of as Condition[]).forEach(walk);
    if (c.is === 'not') walk(c.of as Condition);
  };
  walk(goal);
  const layout = { at, size };
  layouts.set(goal, layout);
  return layout;
}

/** The numbers of `c` within its step's numbers. */
function slotsOf(c: Condition, s: number[], goal: Condition): number[] {
  const at = slotLayout(goal).at.get(c) ?? 0;
  return s.slice(at, at + CONDITIONS[c.is]!.slots!);
}

/** Whether `c` holds; `s` are its step's numbers (none for a start condition). */
export function testCondition(
  c: Condition,
  ctx: ConditionContext,
  s: number[] = [],
  goal = c,
): boolean {
  const kind = CONDITIONS[c.is];
  if (!kind) return false;
  return kind.test(c, ctx, kind.slots ? slotsOf(c, s, goal) : s, goal);
}

/** Move a step's numbers on (in place). */
export function updateGoal(goal: Condition, ctx: StepContext, s: number[]): void {
  for (const [c, at] of slotLayout(goal).at) {
    const kind = CONDITIONS[c.is]!;
    const mine = s.slice(at, at + kind.slots!);
    kind.update?.(c, ctx, mine);
    mine.forEach((v, i) => (s[at + i] = v));
  }
}

/** The quest cargo aboard in a goal: item → pieces. */
export function itemsAboard(
  goal: Condition | undefined,
  s: readonly number[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const [c, at] of slotLayout(goal).at)
    if (c.is === 'carried')
      out.set(c.item as string, (out.get(c.item as string) ?? 0) + (s[at] ?? 0));
  return out;
}

/** Every port id a condition names (except `home`), for "does this quest fit the map". */
export function portsIn(c: Condition | undefined): string[] {
  if (!c) return [];
  const kind = CONDITIONS[c.is];
  if (!kind) return [];
  const out: string[] = [];
  for (const [name, spec] of Object.entries(kind.params)) {
    const type = spec.replace('?', '');
    const v = c[name];
    if (
      (type === 'port' || type === 'place') &&
      typeof v === 'string' &&
      v !== 'home' &&
      !isVarRef(v)
    )
      out.push(v);
    if (type === 'condition') out.push(...portsIn(v as Condition));
    if (type === 'conditions' && Array.isArray(v))
      out.push(...v.flatMap((m) => portsIn(m as Condition)));
  }
  return out;
}

export function rewardPorts(r: QuestReward | undefined): string[] {
  return [
    ...Object.keys(r?.standing ?? {}),
    ...(r?.discover ?? []),
    ...(r?.levelUp ?? []),
    ...(r?.found ?? []),
  ].filter((p) => p !== 'home' && !isVarRef(p));
}

/** What the checks need to know beyond the condition. */
export interface CheckScope {
  map: MapDef;
  /** Quest id → its choice options' ids. */
  quests: Map<string, string[]>;
  /** Quest id → its step ids, where known. */
  steps: Map<string, string[]>;
  /** The checked quest's items. */
  items: string[];
  /** The checked quest's vars (decision 0151): name → what it holds. */
  vars?: Record<string, VarKind>;
}

/** What a quest var holds (decision 0151). */
export const VAR_KINDS = ['port', 'good'] as const;
export type VarKind = (typeof VAR_KINDS)[number];

const isCount = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isNumber = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isPoint = (p: unknown) =>
  typeof p === 'object' &&
  p !== null &&
  Number.isFinite((p as QuestPoint).x) &&
  Number.isFinite((p as QuestPoint).y);

function checkParam(
  type: Param,
  v: unknown,
  c: Condition,
  scope: CheckScope,
  inGoal: boolean,
  where: string,
): string[] {
  const out: string[] = [];
  const bad = (what: string) => out.push(`${where}: ${what}`);
  if (isVarRef(v) && (type === 'port' || type === 'place' || type === 'good')) {
    const kind = scope.vars?.[v.slice(1)];
    const want = type === 'good' ? 'good' : 'port';
    if (kind !== want) bad(`no ${want} var "${v.slice(1)}" in the quest's vars`);
    return out;
  }
  if (type === 'port' && !resolvePort(scope.map, v)) bad(`no port "${String(v)}"`);
  if (type === 'place') {
    if (!isSpot(v)) {
      if (!resolvePort(scope.map, v)) bad(`no port "${String(v)}"`);
    } else {
      const spot = v as unknown as Record<string, unknown>;
      if (!isPoint(spot) || !(isNumber(spot.within) && (spot.within as number) > 0))
        bad('a spot at sea needs "x", "y" and "within"');
      for (const key of ['maxKn', 'holdSec'])
        if (spot[key] !== undefined && !isNumber(spot[key])) bad(`${key} needs a number`);
      for (const key of Object.keys(spot))
        if (!['x', 'y', 'within', 'maxKn', 'holdSec'].includes(key)) bad(`a spot has no "${key}"`);
    }
  }
  if (type === 'good' && !isGood(v)) bad(`no good "${String(v)}"`);
  if (type === 'ship' && !(typeof v === 'string' && SHIP_CLASSES[v])) bad(`no ship "${String(v)}"`);
  if (type === 'building' && !buildingById(v as string)) bad(`no building "${String(v)}"`);
  if (type === 'island' && !homeSpots(scope.map, v as string).length)
    bad(`no island with build spots "${String(v)}"`);
  if (type === 'quest' && !(typeof v === 'string' && scope.quests.has(v)))
    bad(`no quest "${String(v)}"`);
  if (type === 'step') {
    const steps = scope.steps.get(c.quest as string);
    if (typeof v !== 'string' || (steps && !steps.includes(v))) bad(`no step "${String(v)}"`);
  }
  if (type === 'option') {
    const options = scope.quests.get(c.quest as string);
    if (options && !options.includes(v as string)) bad(`no option "${String(v)}"`);
  }
  if (type === 'item' && !scope.items.includes(v as string))
    bad(`no item "${String(v)}" in the quest's items`);
  if (type === 'count' && !isCount(v)) bad('needs a whole number');
  if (type === 'number' && !isNumber(v)) bad('needs a number');
  if (type === 'flag' && typeof v !== 'boolean') bad('needs true or false');
  if (type === 'order' && v !== 'any' && v !== 'in-order') bad('needs "any" or "in-order"');
  if (type === 'screen' && !SCREENS.includes(v as Screen))
    bad(`needs one of ${SCREENS.join(', ')}`);
  if (type === 'points') {
    if (
      !Array.isArray(v) ||
      v.length === 0 ||
      !v.every((p) => isPoint(p) || (typeof p === 'string' && p in MAP_PLACES))
    )
      bad(`needs a list of { "x", "y" } or map places (${Object.keys(MAP_PLACES).join(', ')})`);
    else if (v.length > 30) bad('at most 30 points');
  }
  if (type === 'par') {
    const ok =
      (isNumber(v) && (v as number) > 0) ||
      (typeof v === 'object' &&
        v !== null &&
        Object.entries(v).length > 0 &&
        Object.entries(v).every(([k, n]) => isDifficulty(k) && isNumber(n) && (n as number) > 0));
    if (!ok) bad('needs seconds, or difficulty level → seconds');
  }
  if (type === 'condition') out.push(...checkCondition(v, scope, inGoal, where));
  if (type === 'conditions') {
    if (!Array.isArray(v) || v.length === 0) bad('needs a list of conditions');
    else v.forEach((m, i) => out.push(...checkCondition(m, scope, inGoal, `${where}[${i}]`)));
  }
  return out;
}

/** Problems with a condition, as readable lines; `inGoal` allows conditions with slots. */
export function checkCondition(
  c: unknown,
  scope: CheckScope,
  inGoal: boolean,
  at: string,
): string[] {
  if (typeof c !== 'object' || c === null || Array.isArray(c)) return [`${at}: not a condition`];
  const cond = c as Condition;
  const kind = CONDITIONS[cond.is];
  if (!kind) return [`${at}: unknown condition "${String(cond.is)}"`];
  const out: string[] = [];
  if (kind.slots && !inGoal) out.push(`${at}: "${cond.is}" only works in a step's goal`);
  if (cond.is === 'asked' && inGoal) out.push(`${at}: "asked" only works as a quest's start`);
  for (const key of Object.keys(cond))
    if (key !== 'is' && !(key in kind.params)) out.push(`${at}: "${cond.is}" has no "${key}"`);
  for (const [name, spec] of Object.entries(kind.params)) {
    const v = cond[name];
    if (spec.endsWith('?') && v === undefined) continue;
    out.push(
      ...checkParam(
        spec.replace('?', '') as Param,
        v,
        cond,
        scope,
        inGoal,
        `${at} › ${cond.is}.${name}`,
      ),
    );
  }
  if (
    cond.is === 'reach' &&
    (cond.maxKn !== undefined || cond.holdSec !== undefined) &&
    cond.holdSec === undefined
  )
    out.push(`${at} › reach: "maxKn" needs "holdSec"`);
  return out;
}

/**
 * Problems with a reward. The two-building choice of 0120 is made on the home island itself
 * (decision 0126): a reward offers the spot (`homeSpot`), the captain picks there.
 */
export function checkReward(r: unknown, scope: CheckScope, at: string): string[] {
  if (r === undefined) return [];
  if (typeof r !== 'object' || r === null || Array.isArray(r)) return [`${at}: not a reward`];
  const reward = r as Record<string, unknown>;
  const out: string[] = [];
  for (const key of Object.keys(reward))
    if (
      !['gold', 'standing', 'discover', 'levelUp', 'found', 'homeIsland', 'homeSpot'].includes(key)
    )
      out.push(`${at}: unknown reward "${key}"`);
  if (reward.gold !== undefined && !isCount(reward.gold))
    out.push(`${at}.gold: needs a whole number`);
  if (reward.standing !== undefined) {
    const s = reward.standing;
    if (typeof s !== 'object' || s === null || Array.isArray(s))
      out.push(`${at}.standing: port → number`);
    else
      for (const [p, n] of Object.entries(s)) {
        if (!resolvePort(scope.map, p)) out.push(`${at}.standing: no port "${p}"`);
        if (!isCount(n)) out.push(`${at}.standing.${p}: needs a whole number`);
      }
  }
  const isSite = (p: unknown) => scope.map.ports.some((port) => port.id === p && port.site);
  for (const key of ['discover', 'levelUp', 'found']) {
    const list = reward[key];
    if (list === undefined) continue;
    if (!Array.isArray(list)) out.push(`${at}.${key}: needs a list of ports`);
    else
      for (const p of list)
        if (!resolvePort(scope.map, p)) out.push(`${at}.${key}: no port "${String(p)}"`);
        // A site opens by being founded, never by a chart or a level (decision 0155).
        else if (key === 'found' && !isSite(p))
          out.push(`${at}.found: "${String(p)}" is no empty island (a port with "site": true)`);
        else if (key !== 'found' && isSite(p))
          out.push(`${at}.${key}: "${String(p)}" is an empty island: found it with "found"`);
  }
  const island = reward.homeIsland === true ? scope.map.homeIsland : reward.homeIsland;
  if (reward.homeIsland !== undefined && !homeSpots(scope.map, island as string).length)
    out.push(`${at}.homeIsland: needs true (the map's home island) or an island with build spots`);
  if (reward.homeSpot !== undefined) {
    if (!Array.isArray(reward.homeSpot)) out.push(`${at}.homeSpot: needs a list of spots`);
    else
      for (const ref of reward.homeSpot)
        if (!resolveSpot(scope.map, ref))
          out.push(`${at}.homeSpot: no arc spot "${String(ref)}" (spot-2 or <island>:spot-2)`);
  }
  return out;
}

/** Pay a reward into the voyage. A town put up a level calls `levelled` so its market follows. */
export function payReward(
  trade: TradeState,
  map: MapDef,
  r: QuestReward | undefined,
  levelled: () => void,
): void {
  if (!r) return;
  trade.captain.gold += r.gold ?? 0;
  for (const [id, n] of Object.entries(r.standing ?? {})) {
    const p = resolvePort(map, id);
    if (p) trade.progress.standing[p] = (trade.progress.standing[p] ?? 0) + n;
  }
  for (const id of r.discover ?? []) {
    const p = resolvePort(map, id);
    if (p && !trade.progress.discovered.includes(p)) trade.progress.discovered.push(p);
  }
  let up = false;
  for (const id of r.found ?? []) if (foundSite(trade, map, id)) up = true;
  for (const id of r.levelUp ?? []) {
    const town = trade.settlements.byPort[resolvePort(map, id) ?? ''];
    if (!town || town.level >= MAX_SETTLEMENT_LEVEL) continue;
    town.level += 1;
    town.growth = 0;
    up = true;
  }
  if (up) levelled();
  if (r.homeIsland)
    giveHomeIsland(trade, map, r.homeIsland === true ? map.homeIsland : r.homeIsland);
  for (const ref of r.homeSpot ?? []) {
    const at = resolveSpot(map, ref);
    if (at) offerHomeSpot(trade, map, at.spot, at.island);
  }
}
