import { createBoat } from './boat';
import { DEG } from './math';
import { secondsAtHour } from './daylight';
import type { World } from './world';

/**
 * A voyage that takes the tutorial begins at the prologue's spot at sea (decision 0127), when the
 * map has one, lying still with the sails down so the first lesson is raising them (decision 0139).
 * Returns whether the boat moved.
 */
export function startAtPrologue(world: World): boolean {
  const start = world.map.prologue?.start;
  if (!start) return false;
  world.boat = createBoat(start.x, start.y, start.headingDeg * DEG);
  world.boat.sailStep = 0;
  world.destination = null;
  world.trade.dockedAt = null;
  const opening = world.map.prologue?.opening;
  if (opening) world.time = secondsAtHour(opening.hour);
  return true;
}
