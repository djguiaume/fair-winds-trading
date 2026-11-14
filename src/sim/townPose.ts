import { islandPoint } from './islandLayout';
import type { IslandDef } from './map';
import { bearingTo } from './math';
import { MAX_SETTLEMENT_LEVEL } from './settlement';
import { type Point, type TownPlan, waterAt } from './townPlan';
import { villageCentre } from './townVillageChecks';

/**
 * Where a boat lies to see a town from the follow camera (issues #528, #544): out at sea in
 * front of the village's centre, `review.followOffshore` world units past the shore (further when
 * that would dock), bow on to the centre (`town-rules.json`).
 * `npm run island -- audit` prints it as `npm run shots` options for the review sheets.
 */
export interface FollowPose {
  /** The boat's place on the sea (world units). */
  at: Point;
  /** Compass heading in degrees, toward the village's centre. */
  heading: number;
  /** Settle time before the shot (ms). */
  wait: number;
  /** The port grown to the top level, as the plan reads the town ("calda:4"); none for no port. */
  town?: string;
}

/** File units walked per step out to the shore. */
const STEP = 0.01;

export function followPose(
  plan: TownPlan,
  island: IslandDef,
  port?: string,
  /** Whether the boat lies clear of the harbour there (or it docks before the shot). */
  clear: (x: number, y: number) => boolean = () => true,
): FollowPose {
  const { followOffshore: offshore, followWait: wait } = plan.rules.review;
  const centre = villageCentre(plan);
  // Out through the harbour (the side a player arrives from), else straight out from the middle.
  const from = plan.harbour ?? centre;
  const len = Math.hypot(...from) || 1;
  const out: Point = Math.hypot(...from) ? [from[0] / len, from[1] / len] : [0, 1];
  let p: Point = centre;
  for (let k = 0; k < 400 && waterAt(plan, p[0], p[1]).depth >= 0; k++)
    p = [p[0] + out[0] * STEP, p[1] + out[1] * STEP];
  const boatAt = (past: number) =>
    islandPoint(
      island,
      p[0] + (out[0] * past) / island.radius,
      p[1] + (out[1] * past) / island.radius,
    );
  let past = offshore;
  while (past < offshore * 8 && !clear(boatAt(past).x, boatAt(past).y)) past += offshore / 4;
  const boat = boatAt(past);
  const town = islandPoint(island, centre[0], centre[1]);
  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    at: [round(boat.x), round(boat.y)],
    heading: Math.round((bearingTo(boat, town) * 180) / Math.PI),
    wait,
    ...(port && { town: `${port}:${MAX_SETTLEMENT_LEVEL}` }),
  };
}

/** The pose as `npm run shots` options. */
export const followShot = (pose: FollowPose) =>
  `--at ${pose.at[0]},${pose.at[1]} --heading ${pose.heading} --chase --wait ${pose.wait}` +
  (pose.town ? ` --town ${pose.town}` : '');
