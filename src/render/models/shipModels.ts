import { createClipper } from './clipper';
import { createCutter } from './cutter';
import { createFluyt } from './fluyt';
import { createHoy } from './hoy';
import { createIndiaman } from './indiaman';
import { createSchooner } from './schooner';
import { createSloop } from './sloop';
import type { BoatModel, BoatModelFactory, BoatModelOptions } from './types';

/** One entry per ship class, each defined in its own file (decision 0077). */
export interface ShipModelEntry {
  create(options: BoatModelOptions): BoatModel;
  /** True once the class has its own refined, upgrade-aware model; false while it still
   * borrows the original storybook construction. Shown on models.html?view=compare. */
  refined: boolean;
}

/**
 * Each ship is redesigned in its own file (sloop.ts, hoy.ts, …) that exports one entry, so
 * per-ship work never edits this table or another ship's file. Shared construction lives in
 * refinedBoat.ts (gaff rigs, jibs, cargo, upgrades).
 */
export const SHIP_MODELS: Record<string, ShipModelEntry> = {
  sloop: createSloop,
  cutter: createCutter,
  schooner: createSchooner,
  clipper: createClipper,
  hoy: createHoy,
  fluyt: createFluyt,
  indiaman: createIndiaman,
};

export const isRefinedShip = (id: string) => SHIP_MODELS[id]?.refined ?? false;

/** Unknown ids fall back to the starter sloop, as before. */
export const createShipModel: BoatModelFactory = (shipClassId, options = {}) =>
  (SHIP_MODELS[shipClassId] ?? SHIP_MODELS.sloop!).create(options);
