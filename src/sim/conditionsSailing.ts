import type { MapDef } from './map';
import type { PointOfSail } from './ship';
import type { TradeState } from './trade';
import { REGATTA, crossesForward, crossesGate, type Gate } from './regatta';
import {
  type Condition,
  type ConditionKind,
  type QuestPoint,
  type StepContext,
  numParam,
  pointOf,
  portParam,
} from './conditionBasics';

/*
 * Conditions about sailing (decisions 0151, 0164, 0213, 0217): the sails drill, points of sail,
 * tacks, places reached, timed runs and races. Each keeps numbers while its step runs.
 */

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
  const within = numParam(c.within);
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
    if (!inside || ctx.boat.speedKn > numParam(c.maxKn, Infinity)) return;
    held = true;
    s[1] = s[1]! + Math.round(ctx.dt * 100);
    if (s[1]! >= numParam(c.holdSec) * 100) {
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

/** A run's par, seconds, for the voyage's difficulty level. */
export function parFor(par: unknown, trade: TradeState): number {
  if (typeof par === 'number') return par;
  const levels = par as Record<string, number>;
  return levels[trade.difficulty] ?? Math.max(...Object.values(levels));
}

/** Run states in the first slot of `timed`. */
export const RUN_READY = 0;
export const RUN_GOING = 1;
export const RUN_MADE = 2;

/**
 * A timed run (`timed`): the clock starts when the boat leaves `from`, passes `via` in order and
 * stops alongside `to` (default `from`). Over par, the run is off: dock at `from` and go again, as
 * often as you like. Slots: the run's state, hundredths of a second on the clock, `via` passed.
 */
function updateTimed(c: Condition, ctx: StepContext, s: number[]) {
  if (s[0] === RUN_MADE) return;
  const from = portParam(c, ctx, 'from');
  const to = portParam(c, ctx, 'to') ?? from;
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
  if (next && passDistance(ctx.from, ctx.boat, next) <= numParam(c.within, 15)) s[2] = s[2]! + 1;
  if (s[1]! > parFor(c.par, ctx.trade) * 100) {
    s[0] = RUN_READY;
    s[1] = 0;
    s[2] = 0;
  } else if (docked === to && s[2]! >= via.length) s[0] = RUN_MADE;
}

/** Race states in the first slot of `raced` (decision 0217). */
export const RACE_HORN = 0;
export const RACE_GOING = 1;
export const RACE_FINISHED = 2;

/**
 * A race (`raced`, decision 0217): the horn sequence counts down while the sea is on screen, then
 * the clock runs from the horn. The boat crosses the start line toward the course (one over the
 * line at the horn comes back and crosses again), rounds the marks in order and crosses the
 * finish line. Nothing fails: the clock runs until she finishes. Slots: the race's state,
 * hundredths of a second (of the sequence, then on the clock), and the progress: 0 before the
 * start, then 1 + the marks rounded.
 */
function updateRaced(c: Condition, ctx: StepContext, s: number[]) {
  if (s[0] === RACE_FINISHED) return;
  const dt = Math.round(ctx.dt * 100);
  if (s[0] === RACE_HORN) {
    if ((ctx.screen ?? 'sea') !== 'sea') return;
    s[1] = s[1]! + dt;
    if (s[1]! >= REGATTA.countdownSec * 100) {
      s[0] = RACE_GOING;
      s[1] = 0;
    }
    return;
  }
  s[1] = s[1]! + dt;
  const marks = (c.marks as QuestPoint[]) ?? [];
  const start = c.start as Gate;
  const finish = c.finish as Gate;
  if (s[2] === 0) {
    const toward = marks[0] ?? {
      x: (finish[0].x + finish[1].x) / 2,
      y: (finish[0].y + finish[1].y) / 2,
    };
    if (crossesForward(start, ctx.from, ctx.boat, toward)) s[2] = 1;
    return;
  }
  const next = marks[s[2]! - 1];
  if (next) {
    if (passDistance(ctx.from, ctx.boat, next) <= numParam(c.within, REGATTA.within))
      s[2] = s[2]! + 1;
    return;
  }
  if (crossesGate(finish, ctx.from, ctx.boat)) s[0] = RACE_FINISHED;
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

export const SAILING_CONDITIONS: Record<string, ConditionKind> = {
  /** The sails drill: lower, raise, steer and get under way (the first lesson). */
  'sails-practised': {
    params: {},
    slots: 4,
    update: updateSailsPractised,
    test: (_c, _ctx, s) => !!s[0] && !!s[1] && s[2]! >= 30 && s[3]! >= 100,
  },
  /** Seconds on a point of sail (decision 0164: the sailing lessons). Slot: hundredths held. */
  'point-of-sail': {
    params: { point: 'sailing', holdSec: 'number' },
    slots: 1,
    update(c, ctx, s) {
      s[0] = s[0]! + Math.round((ctx.helm?.pointSec?.[c.point as PointOfSail] ?? 0) * 100);
    },
    test: (c, _ctx, s) => s[0]! >= numParam(c.holdSec) * 100,
  },
  /** Tacks made while the step runs (decision 0164). Slot: tacks. */
  tacked: {
    params: { count: 'count' },
    slots: 1,
    update(_c, ctx, s) {
      s[0] = s[0]! + (ctx.helm?.tacks ?? 0);
    },
    test: (c, _ctx, s) => s[0]! >= numParam(c.count),
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
  raced: {
    params: { start: 'gate', marks: 'points', finish: 'gate', within: 'number?' },
    slots: 3,
    update: updateRaced,
    test: (_c, _ctx, s) => s[0] === RACE_FINISHED,
  },
  timed: {
    params: { from: 'port', to: 'port?', via: 'points?', within: 'number?', par: 'par' },
    slots: 3,
    update: updateTimed,
    test: (_c, _ctx, s) => s[0] === RUN_MADE,
    news(c, ctx, s) {
      if (s[0] !== RUN_READY || !ctx.trade.dockedAt) return null;
      const from = portParam(c, ctx, 'from')!;
      const to = portParam(c, ctx, 'to') ?? from;
      const kind =
        ctx.trade.dockedAt === from ? 'runReady' : ctx.trade.dockedAt === to ? 'runAgain' : null;
      if (!kind) return null;
      const par = parFor(c.par, ctx.trade);
      return { kind, n: 0, left: 0, done: 0, total: 0, space: 0, from, to, par };
    },
  },
};
