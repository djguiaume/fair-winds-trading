import { SHIP_FILES } from '../data/ships';

/** Hull sections shared by rendering and harbour proximity. No rendering dependencies. */
export interface HullShape {
  outline: ReadonlyArray<readonly [number, number]>;
  rings: ReadonlyArray<{ t: number; beam: number; length: number }>;
}

export const HULL_SCALE = 2.2;
export const HULL_BEAM_SCALE = 1.05;
/** Hull size per ship class in reference units, from `src/data/ships/<id>.json` › `hull`. */
export const HULL_DIMENSIONS: Record<string, { length: number; beam: number }> = Object.fromEntries(
  SHIP_FILES.map(({ id, hull }) => [id, { length: hull.length, beam: hull.beam }]),
);

/** Authored hull sections per ship class, from the same files (decision 0109). */
export const HULL_SHAPES: Record<string, HullShape> = Object.fromEntries(
  SHIP_FILES.map(({ id, hull }) => [id, { outline: hull.outline, rings: hull.rings }]),
);

/** The starter's sections: the default for a model without its own. */
export const SLOOP_HULL: HullShape = HULL_SHAPES.sloop!;
