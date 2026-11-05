import * as THREE from 'three';
import { PALETTE } from '../data/props';
import { TUNING } from '../data/tuning';
import type { Rng } from '../sim/rng';
import { type ShoalsDef, livesIn, shownCount } from '../sim/seaLife';
import { shoalModel, swirlingMaterial } from './lifeModels';
import type { SwimScene } from './seaSwimmers';

interface Shoal {
  x: number;
  y: number;
  heading: number;
  size: number;
  /** 0 to 1 as it gathers; the shoal grows in instead of popping. */
  grown: number;
  placed: boolean;
}

/** Places tried per frame for the shoals still looking for water, so none costs a hitch. */
const TRIES_PER_FRAME = 2;
/** Seconds a new shoal takes to gather. */
const GATHER_SEC = 2.5;
/** Just over the sea under the shoal's middle: the waves' crests cover it as if it swam below. */
const OVER_SEA = 0.12;

const tmpPosition = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const tmpMatrix = new THREE.Matrix4();

/**
 * Fish shoals (issue #476): dark, see-through clusters of fish just under the surface in their
 * waters near the boat, one instanced mesh. A shoal left far behind is placed again ahead of
 * her somewhere in `range`, so a few shoals are always about where fish live.
 */
export class FishShoals {
  readonly mesh: THREE.InstancedMesh;
  private readonly shoals: Shoal[];

  constructor(
    private readonly def: ShoalsDef,
    private readonly rng: Rng,
  ) {
    // The checks make sure the colour is one palette name (`seaLifeProblems`).
    const color = String(PALETTE.colors[def.color]);
    const material = swirlingMaterial(color, def.opacity, def.swirl);
    this.mesh = new THREE.InstancedMesh(shoalModel(def.model), material, def.count);
    this.mesh.name = 'fish-shoals';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.shoals = Array.from({ length: def.count }, () => ({
      x: 0,
      y: 0,
      heading: 0,
      size: 1,
      grown: 0,
      placed: false,
    }));
    const phases = new Float32Array(def.count).map(() => rng() * Math.PI * 2);
    this.mesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  }

  update(scene: SwimScene) {
    const { def } = this;
    const { boat, dt } = scene;
    const shown = shownCount(def.count, scene.share);
    const drift = def.driftKn * TUNING.seamanship.boat.knotToUnits * dt;
    let tries = TRIES_PER_FRAME;
    let drawn = 0;
    for (let k = 0; k < shown; k++) {
      const shoal = this.shoals[k]!;
      if (shoal.placed && Math.hypot(shoal.x - boat.x, shoal.y - boat.y) > def.range[1] * 1.3)
        shoal.placed = false;
      if (!shoal.placed && tries-- > 0) this.place(shoal, scene);
      if (!shoal.placed) continue;
      shoal.heading += Math.sin(scene.time * 0.13 + k) * 0.15 * dt;
      shoal.x += Math.sin(shoal.heading) * drift;
      shoal.y += Math.cos(shoal.heading) * drift;
      shoal.grown = Math.min(1, shoal.grown + dt / GATHER_SEC);
      tmpPosition.set(shoal.x, scene.heightAt(shoal.x, -shoal.y) + OVER_SEA, -shoal.y);
      tmpQuaternion.setFromAxisAngle(UP, -shoal.heading);
      tmpScale.setScalar(shoal.size * shoal.grown);
      this.mesh.setMatrixAt(drawn++, tmpMatrix.compose(tmpPosition, tmpQuaternion, tmpScale));
    }
    for (let k = shown; k < this.shoals.length; k++) this.shoals[k]!.placed = false;
    this.mesh.count = drawn;
    this.mesh.visible = drawn > 0;
    this.mesh.instanceMatrix.needsUpdate = drawn > 0;
  }

  /** One try at a spot in `range`, ahead of the boat more often than not, in the shoals' waters. */
  private place(shoal: Shoal, scene: SwimScene) {
    const { def, rng } = this;
    const { boat } = scene;
    const bearing = boat.heading + (rng() - 0.5) * Math.PI * 1.6;
    const far = def.range[0] + rng() * (def.range[1] - def.range[0]);
    const x = boat.x + Math.sin(bearing) * far;
    const y = boat.y + Math.cos(bearing) * far;
    if (!livesIn(def, scene.seaAt(x, y), scene.shoreAt(x, y))) return;
    Object.assign(shoal, {
      x,
      y,
      heading: rng() * Math.PI * 2,
      size: def.size[0] + rng() * (def.size[1] - def.size[0]),
      grown: 0,
      placed: true,
    });
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}
