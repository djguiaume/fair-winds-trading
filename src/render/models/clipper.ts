import { HULL_DIMENSIONS, CLIPPER_HULL } from '../../sim/hullShape';
import { RefinedBoat } from './refinedBoat';
import type { ShipModelEntry } from './shipModels';
import type { BoatModelOptions } from './types';
import { clipperDetails } from './clipperDetails';

/** Knife entry and long parallel run into a small raked transom. The clipper's
 * sections are independent of the schooner's forward shoulder and swept counter. */

/** Retain the game's three-mast fore-and-aft swift rig (0035), not a square-rig conversion. */
export class RefinedClipper extends RefinedBoat {
  constructor(options: BoatModelOptions = {}) {
    super(
      {
        name: 'Clipper',
        boatDetails: clipperDetails,
        length: HULL_DIMENSIONS.clipper!.length,
        beam: HULL_DIMENSIONS.clipper!.beam,
        depth: 1.15,
        hullShape: CLIPPER_HULL,
        hull: '#3b3d48',
        band: '#d8b04a',
        mastZ: 0.2,
        mastHeight: 8.8,
        boom: 2.45,
        gaff: 2.05,
        foremast: { z: 2.8, height: 7.6, boom: 2.2, gaff: 1.8 },
        mizzen: { z: -2.6, height: 7.8, boom: 2.15, gaff: 1.8 },
        stockJibs: 3,
        maxJibs: 3,
        cargoExtra: 2,
        hatchZ: 4,
        cargoZ: 1.5,
        cargoX: 0.42,
      },
      options,
    );
  }
}

export const createClipper: ShipModelEntry = {
  refined: true,
  create: (options) => new RefinedClipper(options),
};
