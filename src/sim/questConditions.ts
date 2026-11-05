import {
  type Condition,
  type ConditionContext,
  type ConditionKind,
  type StepContext,
  type StepNews,
  isVarRef,
} from './conditionBasics';
import { CARGO_CONDITIONS } from './conditionsCargo';
import { SAILING_CONDITIONS } from './conditionsSailing';
import { VOYAGE_CONDITIONS } from './conditionsVoyage';

/**
 * Every kind of condition (decision 0125): the ones that combine or name other quests here, the
 * families in `conditionsVoyage.ts`, `conditionsCargo.ts` and `conditionsSailing.ts`. The quest
 * builder lists them in this order.
 */
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
  ...VOYAGE_CONDITIONS,
  ...CARGO_CONDITIONS,
  ...SAILING_CONDITIONS,
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

/** A step's dock news where the boat is now (decision 0213), one per condition that has some. */
export function goalNews(goal: Condition, ctx: StepContext, s: readonly number[]): StepNews[] {
  const out: StepNews[] = [];
  for (const [c, at] of slotLayout(goal).at) {
    const kind = CONDITIONS[c.is]!;
    const news = kind.news?.(c, ctx, s.slice(at, at + kind.slots!));
    if (news) out.push(news);
  }
  return out;
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

/** The quests a condition names (`quest-done`, `quest-at`…), at any depth. */
export function questsIn(c: Condition | undefined): string[] {
  if (!c) return [];
  const kind = CONDITIONS[c.is];
  if (!kind) return [];
  const out: string[] = [];
  for (const [name, spec] of Object.entries(kind.params)) {
    const type = spec.replace('?', '');
    const v = c[name];
    if (type === 'quest' && typeof v === 'string') out.push(v);
    if (type === 'condition') out.push(...questsIn(v as Condition));
    if (type === 'conditions' && Array.isArray(v))
      out.push(...v.flatMap((m) => questsIn(m as Condition)));
  }
  return out;
}
