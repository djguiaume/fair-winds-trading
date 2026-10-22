import { RefinedBoat, type HullShape } from './refinedBoat';
import type { ShipModelEntry } from './shipModels';
import type { BoatModelOptions } from './types';

/** Bluff round bow, narrow pinched stern and the fluyt's pear-shaped sections: the topsides
 * tumble home to a narrow deck over a wide, flat-floored hold. */
const FLUYT_HULL: HullShape = {
  outline: [
    [0, 0.5],
    [0.26, 0.45],
    [0.42, 0.32],
    [0.5, 0.12],
    [0.5, -0.1],
    [0.44, -0.3],
    [0.32, -0.44],
    [0.2, -0.5],
    [-0.2, -0.5],
    [-0.32, -0.44],
    [-0.44, -0.3],
    [-0.5, -0.1],
    [-0.5, 0.12],
    [-0.42, 0.32],
    [-0.26, 0.45],
  ],
  rings: [
    { t: 0, beam: 1, length: 1 },
    { t: 0.28, beam: 1.16, length: 0.99 },
    { t: 0.62, beam: 1.08, length: 0.93 },
    { t: 1, beam: 0.56, length: 0.8 },
  ],
};

/** Square-rigged fore and main, gaff mizzen on the stern castle, warm hauler palette. */
export class RefinedFluyt extends RefinedBoat {
  constructor(options: BoatModelOptions = {}) {
    super(
      {
        name: 'Fluyt',
        length: 11.5,
        beam: 3.5,
        depth: 1.8,
        hullShape: FLUYT_HULL,
        hull: '#6e4520',
        band: '#b5652a',
        squareMasts: [
          { name: 'Fore', z: 3.2, height: 8.6, courses: 3 },
          { name: 'Main', z: 0, height: 9.6, courses: 3 },
        ],
        mastZ: -3.3,
        mastHeight: 6.8,
        mainName: 'Mizzen',
        mainTopsail: false,
        boom: 1.9,
        gaff: 1.5,
        castle: { length: 3.7, height: 0.8 },
        stockJibs: 1,
        cargoExtra: 3,
        hatchZ: -1,
        cargoZ: 2.3,
        cargoX: 0.55,
      },
      options,
    );
  }
}

export const createFluyt: ShipModelEntry = {
  refined: true,
  create: (options) => new RefinedFluyt(options),
};
