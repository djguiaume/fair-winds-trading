import { TUNING } from '../data/tuning';
import { secondsAtHour } from './daylight';
import { DEG, wrapAngle } from './math';
import type { MapCheck } from './mapChecks';
import type { MapDef } from './map';

/** A new voyage is "fresh" for its first minute (`main.ts`): the opening hour must fit inside it. */
const FRESH_SECONDS = 60;
/** Land must show this close, and this far to each side of her bow (art bible §13, issue #533). */
const LAND_WITHIN = 600;
const LAND_HALF_VIEW = 45 * DEG;

/** What is wrong with the first voyage's opening (`prologue.opening`): hour, view, land and Skerry. */
export function openingProblems(map: MapDef): string[] {
  const prologue = map.prologue;
  if (!prologue?.opening) return [];
  const { hour, view } = prologue.opening;
  const { start } = prologue;
  const problems: string[] = [];
  const seconds = secondsAtHour(hour);
  if (!(seconds >= 0 && seconds < FRESH_SECONDS))
    problems.push(`hour ${hour} is not inside a fresh voyage's first minute (7 to 8.7)`);
  if (!(view in TUNING.camera.chase.framings)) problems.push(`no follow-cam framing "${view}"`);
  const bow = start.headingDeg * DEG;
  const ahead = (x: number, y: number) =>
    Math.hypot(x - start.x, y - start.y) <= LAND_WITHIN &&
    Math.abs(wrapAngle(Math.atan2(x - start.x, y - start.y) - bow)) <= LAND_HALF_VIEW;
  const land = [
    ...map.islands.map((i) => ({ x: i.x, y: i.y })),
    ...(map.terrain ?? []).flatMap((t) => t.outline.map(([x, y]) => ({ x: x!, y: y! }))),
  ];
  if (!land.some((p) => ahead(p.x, p.y))) problems.push('no land within 600 units ahead');
  const home = map.islands.find((i) => i.id === map.homeIsland);
  const sight = TUNING.weather.sight.far * TUNING.camera.chase.sightDistance;
  if (home && Math.hypot(home.x - start.x, home.y - start.y) - home.radius < sight)
    problems.push(`${home.name ?? home.id} is in sight of the start`);
  return problems;
}

/** The map check for `openingProblems` (`quickChecks`). */
export function openingCheck(map: MapDef): MapCheck {
  const problems = openingProblems(map);
  return {
    id: 'opening',
    ok: problems.length === 0,
    severity: 'error',
    message: problems.length
      ? `first voyage's opening: ${problems.join('; ')}`
      : "the first voyage's opening is a morning with land ahead",
  };
}
