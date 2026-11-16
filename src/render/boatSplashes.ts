import type * as THREE from 'three';
import type { BoatState } from '../sim/boat';
import { bearingVector } from '../sim/math';
import { BoatSpray, type SprayInput } from './boatSpray';
import { ImpactDebris } from './impactDebris';
import type { QualityProfile } from './quality';

type Wave = (x: number, z: number) => number;

/**
 * What the player's hull throws up: a crash's splash and planks (decision 0208) and the spray of
 * her sailing (issue #554). Three instanced draws, each hidden while nothing of it is about.
 */
export class BoatSplashes {
  private readonly debris = new ImpactDebris();
  private readonly spray = new BoatSpray();
  private readonly input: SprayInput = {
    x: 0,
    z: 0,
    dx: 0,
    dz: 1,
    speedKn: 0,
    heel: 0,
    length: 1,
    beam: 1,
    sinceBump: Infinity,
  };

  /** The meshes to add to the scene. */
  get meshes(): THREE.Object3D[] {
    return [this.debris.planks, this.debris.splash, this.spray.mesh];
  }

  /** A crash or a reef strike: a splash at her bow and planks floating off. */
  impact(boat: BoatState, at: THREE.Vector3, hull: { length: number; beam: number }) {
    const dir = bearingVector(boat.heading);
    const reach = hull.length * 0.35;
    this.debris.spawn(at.x + dir.x * reach, at.z - dir.y * reach, dir.x, -dir.y, hull.beam);
  }

  /** Every frame: the boat at scene point `at`, heeled `heel` radians, on the sea `wave`. */
  update(
    dt: number,
    boat: BoatState,
    at: THREE.Vector3,
    hull: { length: number; beam: number },
    heel: number,
    wave: Wave,
  ) {
    const input = this.input;
    input.x = at.x;
    input.z = at.z;
    // Her heading on the scene's ground (as bearingVector, without a new object each frame).
    input.dx = Math.sin(boat.heading);
    input.dz = -Math.cos(boat.heading);
    input.speedKn = boat.speedKn;
    input.heel = heel;
    input.length = hull.length;
    input.beam = hull.beam;
    input.sinceBump = boat.sinceBump;
    this.spray.update(dt, input, wave);
    this.debris.update(dt, wave);
  }

  /** No spray on the plainest level (Ultra-low). */
  setQuality(profile: QualityProfile) {
    this.spray.enabled = !profile.plain;
    if (profile.plain) this.spray.reset();
  }

  /** A new ship: the air clears. */
  reset() {
    this.spray.reset();
  }

  dispose() {
    this.debris.dispose();
    this.spray.dispose();
  }
}
