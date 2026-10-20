import { RefinedBoat, type HullShape } from './refinedBoat';
import type { BoatModelOptions } from './types';

/** Fine entry, aft-set maximum beam and broad flat working transom, unlike the round sloop.
 * The firmer lower shoulder runs into a narrow V bottom. Same topology and draw cost.
 */
const CUTTER_HULL: HullShape = {
  outline: [
    [0, 0.5],
    [0.14, 0.4],
    [0.32, 0.23],
    [0.47, 0],
    [0.5, -0.18],
    [0.45, -0.36],
    [0.38, -0.5],
    [-0.38, -0.5],
    [-0.45, -0.36],
    [-0.5, -0.18],
    [-0.47, 0],
    [-0.32, 0.23],
    [-0.14, 0.4],
  ],
  rings: [
    { t: 0, beam: 1, length: 1 },
    { t: 0.25, beam: 0.96, length: 0.99 },
    { t: 0.65, beam: 0.7, length: 0.9 },
    { t: 1, beam: 0.06, length: 0.74 },
  ],
};

/** Longer swift-line hull, taller aft-set mast, red palette and two/three independent jibs. */
export class RefinedCutter extends RefinedBoat {
  constructor(options: BoatModelOptions = {}) {
    super(
      {
        name: 'Cutter',
        length: 6.2,
        beam: 2.1,
        depth: 1,
        hullShape: CUTTER_HULL,
        mastZ: 0.2,
        mastHeight: 6.4,
        band: '#c0533a',
        hull: '#8a4f24',
        stockJibs: 2,
        cargoExtra: 1,
        boom: 3.1,
        gaff: 2.4,
      },
      options,
    );
  }
}
