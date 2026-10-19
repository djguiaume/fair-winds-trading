import type * as THREE from 'three';
import type { MapDef } from '../../sim/map';

/**
 * Swap point for art (see docs/art-pipeline.md): any boat or island look only has to satisfy
 * these interfaces. Phase 0 uses procedural placeholders; glTF models from the art-style work
 * can replace them without touching the simulation or the rest of the renderer.
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
  update(pose: BoatPose): void;
  dispose(): void;
}

export type BoatModelFactory = (shipClassId: string) => BoatModel;

export interface IslandBuildOptions {
  shadows: boolean;
}

/** Builds every island of a map as one object (ideally one merged mesh = one draw call). */
export type IslandsBuilder = (map: MapDef, options: IslandBuildOptions) => THREE.Object3D;
