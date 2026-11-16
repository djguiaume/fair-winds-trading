import type { QuestBook } from '../sim/quests';
import type { World } from '../sim/world';
import type { StepEffects, StepWind } from '../sim/stepEffects';
import { questGoal } from './questPlaces';
import { questCourse } from './seaChart';

type Harbours = Record<string, { x: number; y: number }>;

/**
 * Where to head when no course is set (decision 0139): the tracked quest's place, at sea only; a
 * running lesson is the tracked quest (decision 0151), so the wreck while a lesson is about it.
 */
export function seaGoal(quests: QuestBook, world: World, harbours: Harbours) {
  if (world.trade.dockedAt) return null;
  return questGoal(quests, world.map, harbours);
}

/**
 * A course set for the quest's place follows it to the step's next place, and ends with the quest
 * or when another quest is tracked away to nowhere (decision 0212).
 */
export function followQuestCourse(quests: QuestBook, world: World, harbours: Harbours) {
  if (world.destination?.kind !== 'quest') return;
  const goal = questGoal(quests, world.map, harbours);
  world.destination = goal ? questCourse(goal) : null;
}

/**
 * The tracked quest's step, whose `wind` and `sound` the sea plays (decision 0139): the same step
 * data for the tutorial (always tracked while it runs, decision 0151) and every quest.
 */
export function seaStep(
  quests: QuestBook,
): { key: string; step: StepEffects; wind: StepWind | undefined } | null {
  const step = quests.trackedStep;
  // A quest's own breeze holds over its steps that have none (decision 0164).
  return step ? { key: `${quests.tracked}:${step.id}`, step, wind: quests.trackedWind } : null;
}
