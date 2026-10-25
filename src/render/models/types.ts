import type { FlagDef } from '../../sim/regatta';
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
  setNightLighting?(night: number): void;
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
  /** Visible damage (decision 0208): 0 sound, 1 scuffed, 2 patched sails and a broken rail,
   * 3 torn sails and a list. */
  damage?: 0 | 1 | 2 | 3;
  /** The masthead flag (decision 0217): a regatta pennant won, Kestrel's burgee; else the stock one. */
  flag?: FlagDef;
  /** A racing number painted on the mainsail (decision 0217): Kestrel's "K 7". */
  sailNumber?: string;
}

export type BoatModelFactory = (shipClassId: string, options?: BoatModelOptions) => BoatModel;

export interface IslandBuildOptions {
  shadows: boolean;
  /** Settlement level per port id (decision 0060); a port left out keeps the map's fixed look. */
  levels?: Record<string, TownLevel>;
}

/** Rendered land supports incremental settlement changes without replacing stable harbour anchors. */
/** A volcano's crater in the scene (decision 0178): its pool's centre and rim height, its radius. */
export interface Crater {
  island: string;
  x: number;
  y: number;
  z: number;
  r: number;
  /** The cone's flank, rise over run, where lava bombs come down. */
  slope: number;
  /** A steam vent prop (decision 0181): a small plume at `smoke.ventScale`, never erupts. */
  vent?: boolean;
}

export interface IslandModel extends THREE.Object3D {
  /** Every crater of the islands' files, where the smoke rises (decision 0178). */
  readonly craters: readonly Crater[];
  setSettlementLevels(levels: Record<string, TownLevel>): void;
  /** Redraw the captain's islands' buildings, island id → spot → building (0126, 0128). */
  setHomeBuildings(byIsland: Record<string, Record<string, string>>): void;
  /** Redraw the islands with props shown only before or after a quest (decision 0130). */
  setQuestsDone(done: ReadonlySet<string>): void;
  /** Hide the islands and shapes out of the sea for now, show the others (decision 0166). */
  setLandOut(out: ReadonlySet<string>): void;
  dispose(): void;
}

/** Builds locally culled island batches under one root object. */
export type IslandsBuilder = (map: MapDef, options: IslandBuildOptions) => IslandModel;
