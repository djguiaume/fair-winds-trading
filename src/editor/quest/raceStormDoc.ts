import type { RaceStormDef } from '../../sim/raceStorms';
import type { QuestDef } from '../../sim/quests';
import { round1 } from './doc';

/**
 * The edits to a race's own storms (decision 0225), shared by the builder's chart and
 * `npm run race -- <id> --storm`. Indices are 0-based. A value left out keeps the shipped default
 * (`weather.raceStorms`), so the file lists only what a storm changes.
 */
export type RaceStormShape = Partial<Omit<RaceStormDef, 'x' | 'y'>>;

const SHAPE_KEYS = ['radius', 'strength', 'driftDeg', 'driftSpeed'] as const;

/** Sets the given values of a storm; a value of `null` goes back to the default (or no drift). */
function shapeStorm(storm: RaceStormDef, shape: { [K in keyof RaceStormShape]: number | null }) {
  for (const key of SHAPE_KEYS) {
    const v = shape[key];
    if (v === null) delete storm[key];
    else if (v !== undefined) storm[key] = round1(v);
  }
}

/** Adds a storm at `at`; its index, or -1 for a quest that is no race. */
export function addRaceStorm(
  quest: QuestDef,
  at: { x: number; y: number },
  shape: RaceStormShape = {},
) {
  if (!quest.race) return -1;
  const storm: RaceStormDef = { x: round1(at.x), y: round1(at.y) };
  shapeStorm(storm, shape);
  const storms = (quest.race.storms ??= []);
  storms.push(storm);
  return storms.length - 1;
}

/** Moves storm `i`; false when there is none. */
export function moveRaceStorm(quest: QuestDef, i: number, at: { x: number; y: number }): boolean {
  const storm = quest.race?.storms?.[i];
  if (!storm) return false;
  storm.x = round1(at.x);
  storm.y = round1(at.y);
  return true;
}

/** Changes storm `i`'s size, strength or drift (`null` = back to the default); false when none. */
export function shapeRaceStorm(
  quest: QuestDef,
  i: number,
  shape: { [K in keyof RaceStormShape]: number | null },
): boolean {
  const storm = quest.race?.storms?.[i];
  if (!storm) return false;
  shapeStorm(storm, shape);
  return true;
}

/** Removes storm `i`; the last one takes the `storms` list with it. */
export function removeRaceStorm(quest: QuestDef, i: number): boolean {
  const storms = quest.race?.storms;
  if (!storms?.[i]) return false;
  storms.splice(i, 1);
  if (!storms.length) delete quest.race!.storms;
  return true;
}
