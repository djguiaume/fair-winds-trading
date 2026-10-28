import type { MapDef } from './map';
import type { QuestDef } from './quests';
import { checkRaceStormSpots } from './raceStorms';
import { REGATTA, checkRaceDef, courseOf, longestPar } from './regatta';

/**
 * Problems with a race (decision 0217): its `race` block, offered, never a main quest, a lesson or
 * a standing order, and one step whose goal is `raced`.
 */
export function checkRace(
  q: QuestDef,
  map: MapDef,
  people: ReadonlyMap<string, unknown>,
  at: string,
): string[] {
  const out = checkRaceDef(q.race, `${at} › race`);
  if (!q.offer) out.push(`${at}: a race is offered (offer: true)`);
  if (q.main || q.lesson || q.repeat)
    out.push(`${at}: a race is not a main quest, a lesson or a standing order`);
  if (q.steps?.length !== 1 || q.steps[0]!.goal?.is !== 'raced')
    out.push(`${at}: a race has one step, its goal "raced"`);
  else {
    // Two big ships side by side, and the marks' boats, fit on each line (Guillaume's play-test).
    const goal = q.steps[0]!.goal as { start?: unknown; finish?: unknown };
    for (const key of ['start', 'finish'] as const) {
      const g = goal[key] as { x: number; y: number }[] | undefined;
      if (!Array.isArray(g) || g.length !== 2 || !g[0] || !g[1]) continue;
      const len = Math.hypot(g[1].x - g[0].x, g[1].y - g[0].y);
      if (len < REGATTA.minLine)
        out.push(`${at}: its ${key} line is ${Math.round(len)} long, under ${REGATTA.minLine}`);
    }
  }
  const course = courseOf(q.steps?.[0]?.goal);
  if (q.race?.storms && course && !out.length)
    out.push(
      ...checkRaceStormSpots(
        q.race.storms,
        course,
        map.boundsRadius,
        longestPar(q.race),
        `${at} › race.storms`,
      ),
    );
  if (q.reward !== undefined)
    out.push(`${at}: a race pays by its medals (race.gold), not a reward`);
  if (q.starter !== undefined && !people.has(q.starter))
    out.push(`${at}: no person "${q.starter}"`);
  return out;
}
