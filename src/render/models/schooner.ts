import { HULL_DIMENSIONS, SCHOONER_HULL } from '../../sim/hullShape';
import { RefinedBoat } from './refinedBoat';
import type { ShipModelEntry } from './shipModels';
import type { BoatModelOptions } from './types';

/** Long fine entry, forward shoulder and swept, narrow counter stern. Independently
 * authored sections retain the swift schooner's slender shape, rather than stretching a cutter.
 */

/** Two gaff sails, taller aft mainmast, green trim and two/three individually stayed jibs. */
export class RefinedSchooner extends RefinedBoat {
  constructor(options: BoatModelOptions = {}) {
    super(
      {
        name: 'Schooner',
        length: HULL_DIMENSIONS.schooner!.length,
        beam: HULL_DIMENSIONS.schooner!.beam,
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

export const createSchooner: ShipModelEntry = {
  refined: true,
  create: (options) => new RefinedSchooner(options),
};
