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

/**
 * The steps a quest counts: its main line. A lesson counts only its hints, the steps that point
 * at something on the sea; a person's card between them is not one more (v1.11).
 */
export function countedLine(quest: QuestDef): string[] {
  const line = mainLine(quest);
  return quest.lesson
    ? line.filter((id) => quest.steps.find((s) => s.id === id)?.coach?.sea)
    : line;
}

/**
 * A step's number among the counted steps: the ones passed so far, itself included. A step off
 * the main line counts as the step that leads there.
 */
export function lineNumber(quest: QuestDef, id: string): number {
  const line = mainLine(quest);
  const at =
    line.indexOf(id) >= 0
      ? line.indexOf(id)
      : line.findIndex((l) =>
          quest.steps.find((s) => s.id === l)?.unless?.some((w) => w.to === id),
        );
  if (at < 0) return 0;
  const counted = countedLine(quest);
  return counted.filter((c) => line.indexOf(c) <= at).length;
}
