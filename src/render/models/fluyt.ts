import { HULL_DIMENSIONS, FLUYT_HULL } from '../../sim/hullShape';
import { RefinedBoat } from './refinedBoat';
import type { ShipModelEntry } from './shipModels';
import type { BoatModelOptions } from './types';
import { FLUYT_MIZZEN, fluytCargo, fluytDetails } from './fluytDetails';

/** Bluff round bow, narrow pinched stern and the fluyt's pear-shaped sections: the topsides
 * tumble home to a narrow deck over a wide, flat-floored hold. */

/** Square-rigged fore and main, gaff mizzen on the stern castle, warm hauler palette. */
export class RefinedFluyt extends RefinedBoat {
  constructor(options: BoatModelOptions = {}) {
    super(
      {
        name: 'Fluyt',
        length: HULL_DIMENSIONS.fluyt!.length,
        beam: HULL_DIMENSIONS.fluyt!.beam,
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
        boom: FLUYT_MIZZEN.aft,
        gaff: 1.5,
        castle: { length: 11.5 * 0.27, height: 0.8 },
        sternLayout: FLUYT_MIZZEN,
        replaceDeckDetails: true,
        boatDetails: fluytDetails,
        cargo: fluytCargo,
        stockJibs: 1,
        cargoExtra: 4,
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
