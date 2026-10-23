import { isDifficulty } from './difficulty';
import { isGood, type GoodAmounts, type GoodId } from './goods';
import type { MapDef } from './map';
import { SHIP_CLASSES } from './ship';
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
}

/** A point at sea, in map units. */
export interface QuestPoint {
  x: number;
  y: number;
}

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
}

/** What a parameter holds, for the checks; a trailing `?` makes it optional. */
type Param =
  | 'port'
  | 'good'
  | 'ship'
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
  | 'conditions';
type ParamSpec = Param | `${Param}?`;

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
const port = (c: Condition, ctx: ConditionContext, key = 'port') => resolvePort(ctx.map, c[key]);

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
  const points = c.points as QuestPoint[];
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
    if (reached || (inOrder && i !== next)) return;
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
  const n = (c.points as QuestPoint[]).length;
  return c.order === 'in-order' ? s[0]! >= n : s[0] === 2 ** n - 1;
};

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
  docked: { params: { port: 'port' }, test: (c, ctx) => ctx.trade.dockedAt === port(c, ctx) },
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
  'has-cargo': {
    params: { good: 'good', qty: 'count' },
    test: (c, ctx) => ctx.trade.captain.cargo[c.good as GoodId] >= num(c.qty),
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
      if (ctx.trade.dockedAt !== port(c, ctx)) return;
      const good = c.good as GoodId;
      const handed = ctx.cargoBefore[good] - ctx.trade.captain.cargo[good];
      s[0] = Math.min(num(c.qty), Math.max(0, s[0]! + handed));
    },
    test: (c, _ctx, s) => s[0]! >= num(c.qty),
  },
  /**
   * Quest cargo (`carried`): pieces of the quest's `item`, loaded alongside `from` as far as the
   * hold has room, unloaded alongside `to`. It takes hold space and cannot be sold. Slots: pieces
   * aboard, pieces delivered.
   */
  carried: {
    params: { item: 'item', qty: 'count', from: 'port', to: 'port' },
    slots: 2,
    update(c, ctx, s) {
      const docked = ctx.trade.dockedAt;
      if (docked === port(c, ctx, 'from')) {
        const space = ctx.itemSpace(c.item as string);
        // Space 0: a passenger, who takes no room in the hold.
        const room = space > 0 ? Math.floor(ctx.freeSpace / space) : Infinity;
        s[0] = s[0]! + Math.max(0, Math.min(num(c.qty) - s[0]! - s[1]!, room));
      }
      if (docked === port(c, ctx, 'to')) {
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
    if (type === 'port' && typeof v === 'string' && v !== 'home') out.push(v);
    if (type === 'condition') out.push(...portsIn(v as Condition));
    if (type === 'conditions' && Array.isArray(v))
      out.push(...v.flatMap((m) => portsIn(m as Condition)));
  }
  return out;
}

export function rewardPorts(r: QuestReward | undefined): string[] {
  return [...Object.keys(r?.standing ?? {}), ...(r?.discover ?? []), ...(r?.levelUp ?? [])].filter(
    (p) => p !== 'home',
  );
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
}

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
  if (type === 'port' && !resolvePort(scope.map, v)) bad(`no port "${String(v)}"`);
  if (type === 'good' && !isGood(v)) bad(`no good "${String(v)}"`);
  if (type === 'ship' && !(typeof v === 'string' && SHIP_CLASSES[v])) bad(`no ship "${String(v)}"`);
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
  if (type === 'points') {
    if (!Array.isArray(v) || v.length === 0 || !v.every(isPoint))
      bad('needs a list of { "x", "y" }');
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

/** Problems with a reward. A `building` (decision 0120) waits for `buildings.json`. */
export function checkReward(r: unknown, scope: CheckScope, at: string): string[] {
  if (r === undefined) return [];
  if (typeof r !== 'object' || r === null || Array.isArray(r)) return [`${at}: not a reward`];
  const reward = r as Record<string, unknown>;
  const out: string[] = [];
  for (const key of Object.keys(reward))
    if (!['gold', 'standing', 'discover', 'levelUp'].includes(key))
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
  for (const key of ['discover', 'levelUp']) {
    const list = reward[key];
    if (list === undefined) continue;
    if (!Array.isArray(list)) out.push(`${at}.${key}: needs a list of ports`);
    else
      for (const p of list)
        if (!resolvePort(scope.map, p)) out.push(`${at}.${key}: no port "${String(p)}"`);
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
  for (const id of r.levelUp ?? []) {
    const town = trade.settlements.byPort[resolvePort(map, id) ?? ''];
    if (!town || town.level >= MAX_SETTLEMENT_LEVEL) continue;
    town.level += 1;
    town.growth = 0;
    up = true;
  }
  if (up) levelled();
}
