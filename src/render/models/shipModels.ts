import { SHIP_FILES, type ShipFile } from '../../data/ships';
import { RefinedBoat, type RefinedRig } from './refinedBoat';
import { SHIP_PARTS } from './shipParts';
import type { BoatModel, BoatModelFactory, BoatModelOptions } from './types';

/** One entry per ship class (decision 0077), now built from its ship file (decision 0109). */
export interface ShipModelEntry {
  create(options: BoatModelOptions): BoatModel;
  /** True once the class has its own refined, upgrade-aware model; false while it still
   * borrows the original storybook construction. Shown on models.html?view=compare. */
  refined: boolean;
}

/** The shared builder's rig for a ship file: its hull, its `model` numbers and named parts. */
export function rigOf(file: ShipFile): RefinedRig {
  const { hullColor, bandColor, parts = [], ...model } = file.model;
  const { length, beam, depth, outline, rings } = file.hull;
  let rig: RefinedRig = {
    name: file.name,
    length,
    beam,
    depth,
    hullShape: { outline, rings },
    hull: hullColor,
    band: bandColor,
    ...model,
  };
  for (const id of parts) {
    const part = SHIP_PARTS[id];
    if (!part) throw new Error(`Unknown ship part "${id}" in src/data/ships/${file.id}.json`);
    rig = { ...rig, ...part };
  }
  return rig;
}

/** A ship class's model, built from its file. */
export function shipModel(id: string, options: BoatModelOptions = {}): RefinedBoat {
  const file = SHIP_FILES.find((f) => f.id === id) ?? SHIP_FILES.find((f) => f.id === 'sloop')!;
  return new RefinedBoat(rigOf(file), options);
}

/** Every ship file gets the refined builder: adding a file adds its model. */
export const SHIP_MODELS: Record<string, ShipModelEntry> = Object.fromEntries(
  SHIP_FILES.map((f) => [f.id, { refined: true, create: (options) => shipModel(f.id, options) }]),
);

export const isRefinedShip = (id: string) => SHIP_MODELS[id]?.refined ?? false;

/** Unknown ids fall back to the starter sloop, as before. */
export const createShipModel: BoatModelFactory = (shipClassId, options = {}) =>
  shipModel(shipClassId, options);
