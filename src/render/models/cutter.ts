import { RefinedBoat } from './refinedBoat';
import type { BoatModelOptions } from './types';

/** Longer swift-line hull, taller aft-set mast, red palette and two/three independent jibs. */
export class RefinedCutter extends RefinedBoat {
  constructor(options: BoatModelOptions = {}) {
    super(
      {
        name: 'Cutter',
        length: 6.2,
        beam: 2.1,
        depth: 1,
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
