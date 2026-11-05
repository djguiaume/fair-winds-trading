import { ISLAND_DESIGNS } from '../../data/islands';
import { GAME_MAP } from '../../data/maps';
import type { MapDef } from '../../sim/map';
import { clearAt } from '../../sim/mapChecks';
import { hasQuestLand, standingMap } from '../../sim/questLand';
import { checkQuestHooks, checkQuests, questsFor } from '../../sim/quests';
import { type QuestDoc, checkText } from './docText';
import { stepPlaces } from './docPlaces';
import { questsBefore } from './docStory';

/* Every problem the quest builder lists, also run by `npm run check` (decisions 0142, 0153). */

/** Points at sea that `clear` says are on land or reefs. */
export function checkPlaces(
  doc: QuestDoc,
  map: MapDef,
  clear: (x: number, y: number, sea: MapDef) => boolean,
): string[] {
  const out: string[] = [];
  for (const q of doc.quests) {
    // Land that rises or clears after a quest (decision 0166): a quest's places are looked at
    // with the quests it waits on done (0170: Snowberry's landing lies where the pack was).
    const before = questsBefore(q, doc.quests);
    const sea = before.size && hasQuestLand(map) ? standingMap(map, before) : map;
    for (const s of q.steps)
      for (const p of stepPlaces(s, map))
        if (p.kind !== 'chart' && !clear(p.x, p.y, sea))
          out.push(
            `quest ${q.id} › ${s.id}: ${p.kind} at (${Math.round(p.x)}, ${Math.round(p.y)}) is not in clear water`,
          );
  }
  return out;
}
/**
 * Every problem the quest builder lists (its Checks panel), also run by `npm run check`
 * (decision 0153): quest files, hooks on island files, text and places.
 */
export function questProblems(doc: QuestDoc, map: MapDef): string[] {
  try {
    // Quests for a Phase 4 sea this map lacks are left to the game sea's checks (decision 0155);
    // a quest naming a port no sea has is still checked here, so a misspelt port shows.
    const runsHere = new Set(questsFor(map, doc.quests).map((q) => q.id));
    const runsGrown = new Set(questsFor(GAME_MAP, doc.quests).map((q) => q.id));
    const here = doc.quests.filter((q) => runsHere.has(q.id) || !runsGrown.has(q.id));
    return [
      ...checkQuests(here, map),
      ...checkQuestHooks(map, Object.values(ISLAND_DESIGNS), doc.quests),
      ...checkText(doc),
      ...checkPlaces({ ...doc, quests: here }, map, (x, y, sea) => clearAt(sea, x, y, 0)),
    ];
  } catch (e) {
    return [`the checks stopped: ${String(e)}`];
  }
}
