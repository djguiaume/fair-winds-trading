import { BOAT_CLASSES, StorybookBoat } from './storybookBoat';
import type { ShipModelEntry } from './shipModels';
import { STOCK_UPGRADES } from './types';

/**
 * Hoy model. Still the original storybook construction (decision 0016); its refined,
 * upgrade-aware redesign replaces this entry in this file only (decision 0077).
 */
export const createHoy: ShipModelEntry = {
  refined: false,
  create: (options) =>
    new StorybookBoat(
      BOAT_CLASSES.hoy!,
      options.upgrades ?? STOCK_UPGRADES,
      options.rigging ?? true,
    ),
};
