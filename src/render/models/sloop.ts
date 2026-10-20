import { RefinedBoat } from './refinedBoat';
import type { BoatModelOptions } from './types';

/** Starter proportions and palette from decision 0051. */
export class RefinedSloop extends RefinedBoat {
  constructor(options: BoatModelOptions = {}) {
    super(
      {
        name: 'Sloop',
        length: 5,
        beam: 1.9,
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
