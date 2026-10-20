import { RefinedBoat, type HullShape } from './refinedBoat';
import type { BoatModelOptions } from './types';

/** Long fine entry, forward shoulder and swept, narrow counter stern. Independently
 * authored sections retain the swift schooner's slender shape, rather than stretching a cutter.
 */
const SCHOONER_HULL: HullShape = {
  outline: [
    [0, 0.5],
    [0.12, 0.41],
    [0.34, 0.25],
    [0.5, 0.06],
    [0.48, -0.17],
    [0.35, -0.36],
    [0.22, -0.5],
    [-0.22, -0.5],
    [-0.35, -0.36],
    [-0.48, -0.17],
    [-0.5, 0.06],
    [-0.34, 0.25],
    [-0.12, 0.41],
  ],
  rings: [
    { t: 0, beam: 1, length: 1 },
    { t: 0.25, beam: 0.97, length: 0.98 },
    { t: 0.65, beam: 0.65, length: 0.86 },
    { t: 1, beam: 0.09, length: 0.69 },
  ],
};

/** Two gaff sails, taller aft mainmast, green trim and two/three individually stayed jibs. */
export class RefinedSchooner extends RefinedBoat {
  constructor(options: BoatModelOptions = {}) {
    super(
      {
        name: 'Schooner',
        length: 8.2,
        beam: 2.3,
        depth: 1.1,
        hullShape: SCHOONER_HULL,
        mastZ: -1.4,
        mastHeight: 7.4,
        foremast: { z: 1.6, height: 6.4, boom: 2.45, gaff: 1.95 },
        band: '#2f8f7a',
        hull: '#7d4a22',
        stockJibs: 2,
        cargoExtra: 2,
        boom: 3.4,
        gaff: 2.55,
      },
      options,
    );
  }
}
