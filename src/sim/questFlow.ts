import {
  type QuestOption,
  type QuestStep,
  type QuestDef,
  QUEST_DONE,
  type QuestProgress,
  type QuestState,
} from './questTypes';
import { type MapDef } from './map';
import {
  type Condition,
  isVarRef,
  pointOf,
  itemsAboard,
  portsIn,
  questsIn,
  resolvePort,
} from './questLibrary';
import { rewardPorts } from './questRewards';

/* The quest files and how a quest goes from step to step (decision 0125). */

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
/** A quest's step by its id. */
export const findStep = (def: QuestDef, id: string | undefined) =>
  def.steps.find((s) => s.id === id);

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

/** The step a standing order asks next, or asks now (decision 0214): the steps in turn. */
export function roundStep(quest: QuestDef, p: QuestProgress | undefined): QuestStep {
  return quest.repeat ? quest.steps[(p?.rounds ?? 0) % quest.steps.length]! : quest.steps[0]!;
}

/** The step a standing order's last round asked (decision 0214), for its thanks. */
export function lastRoundStep(
  quest: QuestDef,
  p: QuestProgress | undefined,
): QuestStep | undefined {
  const n = p?.rounds ?? 0;
  return quest.repeat && n > 0 ? quest.steps[(n - 1) % quest.steps.length] : undefined;
}

/** Whether a quest is started by the game asking for it (the tutorial, decision 0151). */
export const isAsked = (quest: QuestDef) => quest.start?.is === 'asked';

/** A port reference outside a condition: a port id, `home` or a `$var` (not a map port id). */
const portRefs = (...refs: (string | undefined)[]) =>
  refs.filter((p): p is string => typeof p === 'string' && p !== 'home' && !isVarRef(p));

/** The step after `step` (its own `next`, or a picked option's). */
export function nextOf(def: QuestDef, step: QuestStep, option?: QuestOption): string {
  // A standing order's round is one step (decision 0214).
  if (def.repeat) return QUEST_DONE;
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
  let out = quests.filter((q) => questPorts(q).every((p) => resolvePort(map, p)));
  // A quest that starts after one this map can't run (the Phase 4 closing beat on the ring sea)
  // can't run either, however few ports it names.
  for (let n = out.length; ; n = out.length) {
    const ids = new Set(out.map((q) => q.id));
    out = out.filter((q) =>
      questsIn(q.start).every((id) => ids.has(id) || !quests.some((o) => o.id === id)),
    );
    if (out.length === n) return out;
  }
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
