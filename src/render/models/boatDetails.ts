import type * as THREE from 'three';
import type { ShipUpgrades } from './types';

/** Boat-local dimensions: +Z is the bow; beam/depth include the storybook style scale. */
export interface BoatDetailContext {
  length: number;
  beam: number;
  depth: number;
  deckAt: (z: number) => number;
  hull: string;
  band: string;
  upgrades: ShipUpgrades;
}

export type BoatDetails = (context: BoatDetailContext) => THREE.BufferGeometry[];

/** Deliberate deck stowage in boat-local coordinates, before the display scale. */
export interface CargoSlot {
  x: number;
  z: number;
  layer?: number;
  barrel?: boolean;
}

export type BoatCargo = (context: BoatDetailContext) => CargoSlot[];
