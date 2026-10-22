import { BOAT_CLASSES, StorybookBoat } from './storybookBoat';
import type { ShipModelEntry } from './shipModels';
import { STOCK_UPGRADES } from './types';

/**
 * Indiaman model. Still the original storybook construction (decision 0016); its refined,
 * upgrade-aware redesign replaces this entry in this file only (decision 0077).
 */
export const createIndiaman: ShipModelEntry = {
  refined: false,
  create: (options) =>
    new StorybookBoat(
      BOAT_CLASSES.indiaman!,
      options.upgrades ?? STOCK_UPGRADES,
      options.rigging ?? true,
    ),
};
