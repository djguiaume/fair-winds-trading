import type * as THREE from 'three';
import type { MapDef } from '../../sim/map';
import type { TownLevel } from './towns';

/**
 * Swap point for art (see docs/art-pipeline.md): any boat or island look only has to satisfy
 * these interfaces. The game uses code-built models in the chosen art style (decision 0016); glTF
 * models could replace them without touching the simulation or the rest of the renderer.
 */

/** Everything a boat model needs to animate itself, computed from the simulation each frame. */
export interface BoatPose {
  /** Sail area 0 (furled) .. 1 (full). */
  sail: number;
  /** Boom swing in radians around the mast; negative = to port (left), positive = starboard. */
  boomAngle: number;
  /** 0 = sails full of wind, 1 = flapping (pointing into the wind). */
  luff: number;
  /** Roll in radians, positive = mast leaning to port. */
  heel: number;
  /** Direction the wind blows toward, relative to the bow (radians, for flags/pennants). */
  windRelative: number;
  time: number;
}

export interface BoatModel {
  /** Root object: bow points to -Z, origin at the waterline center, 1 unit ≈ 1 m. */
  readonly root: THREE.Object3D;
  /** Waterline footprint in scene units, for hull-attached wake effects. */
  readonly wakeHull: { length: number; beam: number };
  update(pose: BoatPose): void;
  /** Optional: where the boat's night lantern hangs (decision 0068); it heels with the mast. */
  readonly lantern?: THREE.Object3D;
  /** Optional: drop fine details (rigging lines) at the low quality setting. */
  setLowDetail?(low: boolean): void;
  dispose(): void;
}

/** Level 1 (stock) to 3 on each upgrade track of decision 0011. */
export type UpgradeLevel = 1 | 2 | 3;

/** The three upgrade tracks; every level is visible on the model. */
export interface ShipUpgrades {
  /** 1 patched canvas, 2 new canvas and an extra jib, 3 racing sails with a stripe and topsail. */
  sails: UpgradeLevel;
  /** More crates and barrels on deck as the hold grows. */
  hold: UpgradeLevel;
  /** 1 bare wood, 2 painted class-colour band, 3 copper-sheathed bottom. */
  hull: UpgradeLevel;
}

export const STOCK_UPGRADES: ShipUpgrades = { sails: 1, hold: 1, hull: 1 };

export interface BoatModelOptions {
  upgrades?: ShipUpgrades;
  /** Thin rigging lines (default true); can also be toggled later with setLowDetail. */
  rigging?: boolean;
}

export type BoatModelFactory = (shipClassId: string, options?: BoatModelOptions) => BoatModel;

export interface IslandBuildOptions {
  shadows: boolean;
  /** Settlement level per port id (decision 0060); a port left out keeps the map's fixed look. */
  levels?: Record<string, TownLevel>;
}

/** Builds every island of a map as one object (ideally one merged mesh = one draw call). */
export type IslandsBuilder = (map: MapDef, options: IslandBuildOptions) => THREE.Object3D;