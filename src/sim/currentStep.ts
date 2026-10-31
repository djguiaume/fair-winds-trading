import { TUNING } from '../data/tuning';
import { knotToUnits } from './boat';
import { knobs } from './difficulty';
import type { World, WorldEvent } from './world';

/**
 * Current (decision 0140): the water at the boat carries her over the ground, added to her motion
 * the way leeway is; the polars, heel and press stay "through the water". A moored boat (stopped
 * with her lines ashore) ignores it. Sailing into a current she has not met charts it.
 */
export function stepCurrent(world: World, dt: number): WorldEvent[] {
  const { boat } = world;
  const scale = world.currentsOn ? knobs(world.trade.difficulty).currents : 0;
  const water = world.currents.at(boat.x, boat.y, scale, world.water);
  const moored = boat.speedKn === 0 && boat.sailStep === 0 && !boat.drift.x && !boat.drift.y;
  if (moored || !water.id) return [];
  const k = knotToUnits() * dt;
  boat.x += water.east * k;
  boat.y += water.north * k;
  if (
    world.trade.progress.charted?.includes(water.id) ||
    Math.hypot(water.east, water.north) < TUNING.weather.currents.chartAtKn
  )
    return [];
  (world.trade.progress.charted ??= []).push(water.id);
  return [{ type: 'current-charted', id: water.id }];
}
