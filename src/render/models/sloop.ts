import { HULL_DIMENSIONS } from '../../sim/hullShape';
import { RefinedBoat } from './refinedBoat';
import type { ShipModelEntry } from './shipModels';
import type { BoatModelOptions } from './types';

/** Starter proportions and palette from decision 0051. */
export class RefinedSloop extends RefinedBoat {
  constructor(options: BoatModelOptions = {}) {
    super(
      {
        name: 'Sloop',
        length: HULL_DIMENSIONS.sloop!.length,
        beam: HULL_DIMENSIONS.sloop!.beam,
        depth: 0.9,
        mastZ: 0.5,
        mastHeight: 5.2,
        band: '#2f6f9f',
        hull: '#9a5a2a',
        stockJibs: 1,
        cargoExtra: 0,
        boom: 2.7,
        gaff: 2,
      },
      options,
    );
  }
}

export const createSloop: ShipModelEntry = {
  refined: true,
  create: (options) => new RefinedSloop(options),
};
