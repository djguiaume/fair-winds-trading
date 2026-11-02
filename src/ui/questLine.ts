import type { QuestDef } from '../sim/quests';

/**
 * A lesson's main line (decision 0151): from its first step, each step's goal (or, with none, its
 * first option) to the next. Steps off it are only reached by ways back and are not numbered.
 */
export function mainLine(quest: QuestDef): string[] {
  const out: string[] = [];
  let step = quest.steps[0];
  while (step && !out.includes(step.id)) {
    out.push(step.id);
    const next =
      (step.goal ? step.next : (step.choose?.[0]?.next ?? step.next)) ??
      quest.steps[quest.steps.indexOf(step) + 1]?.id;
    step = quest.steps.find((s) => s.id === next);
  }
  return out;
}

/** A step's number on the main line; a step off it counts as the step that leads there. */
export function lineNumber(quest: QuestDef, id: string): number {
  const line = mainLine(quest);
  return (
    line.indexOf(id) + 1 ||
    line.findIndex((l) => quest.steps.find((s) => s.id === l)?.unless?.some((w) => w.to === id)) + 1
  );
}
