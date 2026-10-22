import { HULL_DIMENSIONS, CUTTER_HULL } from '../../sim/hullShape';
import { RefinedBoat } from './refinedBoat';
import type { ShipModelEntry } from './shipModels';
import type { BoatModelOptions } from './types';

/** Fine entry, aft-set maximum beam and broad flat working transom, unlike the round sloop.
 * The firmer lower shoulder runs into a narrow V bottom. Same topology and draw cost.
 */

/** Longer swift-line hull, taller aft-set mast, red palette and two/three independent jibs. */
export class RefinedCutter extends RefinedBoat {
  constructor(options: BoatModelOptions = {}) {
    super(
      {
        name: 'Cutter',
        length: HULL_DIMENSIONS.cutter!.length,
        beam: HULL_DIMENSIONS.cutter!.beam,
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

export const createCutter: ShipModelEntry = {
  refined: true,
  create: (options) => new RefinedCutter(options),
};
