import { RefinedBoat, type HullShape } from './refinedBoat';
import type { ShipModelEntry } from './shipModels';
import type { BoatModelOptions } from './types';

/** Knife entry and long parallel run into a small raked transom. The clipper's
 * sections are independent of the schooner's forward shoulder and swept counter. */
const CLIPPER_HULL: HullShape = {
  outline: [
    [0, 0.5],
    [0.08, 0.42],
    [0.25, 0.29],
    [0.43, 0.12],
    [0.5, -0.08],
    [0.45, -0.3],
    [0.28, -0.5],
    [-0.28, -0.5],
    [-0.45, -0.3],
    [-0.5, -0.08],
    [-0.43, 0.12],
    [-0.25, 0.29],
    [-0.08, 0.42],
  ],
  rings: [
    { t: 0, beam: 1, length: 1 },
    { t: 0.25, beam: 0.94, length: 0.99 },
    { t: 0.65, beam: 0.56, length: 0.88 },
    { t: 1, beam: 0.07, length: 0.76 },
  ],
};

/** Retain the game's three-mast fore-and-aft swift rig (0035), not a square-rig conversion. */
export class RefinedClipper extends RefinedBoat {
  constructor(options: BoatModelOptions = {}) {
    super(
      {
        name: 'Clipper',
        length: 9.8,
        beam: 2.4,
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
