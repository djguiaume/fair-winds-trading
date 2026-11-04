import * as THREE from 'three';
import { TUNING } from '../data/tuning';
import type { Rng } from '../sim/rng';
import {
  type DolphinsDef,
  type Pose,
  type Span,
  type WhaleDef,
  livesIn,
  porpoise,
  shownCount,
  whalePose,
} from '../sim/seaLife';
import { vertexColorMaterial } from './models/geometry';
import { lifeModel } from './lifeModels';

/** What the swimmers need of the world each frame (sim units; `heightAt` takes scene x, z). */
export interface SwimScene {
  dt: number;
  time: number;
  boat: { x: number; y: number; heading: number; speedKn: number };
  /** The sea a sim point lies in. */
  seaAt(x: number, y: number): string;
  /** Distance from a sim point to the nearest shore. */
  shoreAt(x: number, y: number): number;
  heightAt(x: number, z: number): number;
  /** The quality level's share, 0 when sea life is off. */
  share: number;
}

/** Seconds to wait before looking again when the waters are wrong for a visit. */
const RETRY_SEC = 6;
/** How fast a pod's middle catches up with where it wants to swim (share a second). */
const POD_FOLLOW = 1.2;
/** Below this the boat is too slow for dolphins to ride with her: they circle her instead. */
const RIDE_KN = 2;
/** The whale surfaces within this arc round the bow, radians. */
const WHALE_ARC = 2.4;
/** Where the whale's blow comes out, in its model's units (nose to -z). */
const BLOWHOLE = new THREE.Vector3(0, 0.9, -2.4);
/** A dolphin's place in its pod, sim units: ahead and to the side of the pod's middle. */
const POD_SLOTS: readonly [number, number][] = [
  [0, 0],
  [3.5, 1.8],
  [-2.5, -1.6],
  [1.5, -3],
  [-4, 2.4],
  [5, -1],
];

const between = (rng: Rng, [lo, hi]: Span) => lo + rng() * (hi - lo);
const tmpPosition = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const tmpMatrix = new THREE.Matrix4();

/** A pose in the water: sim x, y, a heading, then the lift and pitch of `pose`. */
function poseMatrix(x: number, y: number, heading: number, pose: Pose, size: number, sea: number) {
  tmpPosition.set(x, sea + pose.lift, -y);
  tmpEuler.set(pose.pitch, -heading, 0);
  tmpQuaternion.setFromEuler(tmpEuler);
  tmpScale.setScalar(size);
  return tmpMatrix.compose(tmpPosition, tmpQuaternion, tmpScale);
}

/**
 * A pod of dolphins (issue #476) now and then: in their waters they come to the boat, ride
 * abeam of her (or circle her when she is slow), leaping in turn, and leave after a while. Under
 * water they are not drawn.
 */
export class Dolphins {
  readonly mesh: THREE.InstancedMesh;
  private wait: number;
  private stay = 0;
  private size = 0;
  private side = 1;
  private abeam = 12;
  private circle = 0;
  private x = 0;
  private y = 0;
  private heading = 0;
  private readonly phases: number[];
  private readonly pose: Pose = { lift: 0, pitch: 0 };

  constructor(
    private readonly def: DolphinsDef,
    private readonly rng: Rng,
  ) {
    this.mesh = new THREE.InstancedMesh(
      lifeModel(def.model),
      vertexColorMaterial(),
      POD_SLOTS.length,
    );
    this.mesh.name = 'dolphins';
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.phases = POD_SLOTS.map(() => rng());
    this.wait = between(rng, def.every) * 0.5;
  }

  update(scene: SwimScene) {
    const { def } = this;
    if (this.stay > 0) this.stay -= scene.dt;
    else if ((this.wait -= scene.dt) <= 0) this.arrive(scene);
    this.mesh.visible = this.stay > 0 && scene.share > 0;
    if (!this.mesh.visible) return;
    this.swim(scene);
    const n = Math.max(1, shownCount(this.size, scene.share));
    const ax = Math.sin(this.heading);
    const ay = Math.cos(this.heading);
    let drawn = 0;
    for (let k = 0; k < n; k++) {
      const pose = porpoise(scene.time, this.phases[k]!, def, this.pose);
      if (pose.lift <= -2.5) continue;
      const [ahead, across] = POD_SLOTS[k]!;
      const x = this.x + ax * ahead + ay * across;
      const y = this.y + ay * ahead - ax * across;
      const sea = scene.heightAt(x, -y);
      this.mesh.setMatrixAt(drawn++, poseMatrix(x, y, this.heading, pose, def.size, sea));
    }
    this.mesh.count = drawn;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** A pod comes on the next frame if the boat is in its waters (`npm run shots`). */
  comeNow() {
    this.stay = 0;
    this.wait = 0;
  }

  /** A pod comes when the boat is in its waters; else it looks again a little later. */
  private arrive(scene: SwimScene) {
    const { boat } = scene;
    const { def, rng } = this;
    if (
      scene.share <= 0 ||
      !livesIn(def, scene.seaAt(boat.x, boat.y), scene.shoreAt(boat.x, boat.y))
    ) {
      this.wait = RETRY_SEC;
      return;
    }
    this.stay = between(rng, def.staySec);
    this.wait = between(rng, def.every);
    this.size = Math.round(between(rng, def.pod));
    this.side = rng() < 0.5 ? -1 : 1;
    this.abeam = between(rng, def.side);
    this.circle = boat.heading + this.side * Math.PI * 0.5;
    this.x = boat.x + Math.sin(this.circle) * this.abeam;
    this.y = boat.y + Math.cos(this.circle) * this.abeam;
    this.heading = boat.heading;
  }

  /** Abeam of her and as fast, or round her at their own pace when she is slow. */
  private swim(scene: SwimScene) {
    const { boat, dt } = scene;
    const units = TUNING.seamanship.boat.knotToUnits;
    let toX: number;
    let toY: number;
    if (boat.speedKn >= RIDE_KN) {
      this.circle = boat.heading + this.side * Math.PI * 0.5;
      const ahead = 4 + 3 * Math.sin(scene.time * 0.21);
      toX = boat.x + Math.sin(this.circle) * this.abeam + Math.sin(boat.heading) * ahead;
      toY = boat.y + Math.cos(this.circle) * this.abeam + Math.cos(boat.heading) * ahead;
      this.heading = boat.heading;
    } else {
      this.circle += (this.side * this.def.cruiseKn * units * dt) / this.abeam;
      toX = boat.x + Math.sin(this.circle) * this.abeam;
      toY = boat.y + Math.cos(this.circle) * this.abeam;
      this.heading = this.circle + this.side * Math.PI * 0.5;
    }
    const k = Math.min(1, POD_FOLLOW * dt);
    this.x += (toX - this.x) * k;
    this.y += (toY - this.y) * k;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}

/**
 * A whale far off (issue #476): now and then, in deep enough water, she surfaces somewhere
 * `fromBoat` away, blows, rolls along the top and dives with her flukes up.
 */
export class Whale {
  readonly root = new THREE.Group();
  private readonly body: THREE.Mesh;
  private readonly spout: THREE.Mesh;
  private readonly material = vertexColorMaterial();
  private wait: number;
  /** Seconds into the surfacing; < 0 when none. */
  private age = -1;
  /** The next surfacing comes up dead ahead, at the nearest it may (`npm run shots`). */
  private ahead = false;
  private x = 0;
  private y = 0;
  private heading = 0;
  private readonly pose = { lift: 0, pitch: 0, spout: 0 };
  private readonly blow = new THREE.Vector3();

  constructor(
    private readonly def: WhaleDef,
    private readonly rng: Rng,
  ) {
    this.root.name = 'whale';
    this.body = new THREE.Mesh(lifeModel(def.model), this.material);
    this.spout = new THREE.Mesh(lifeModel(def.spout), this.material);
    this.root.add(this.body, this.spout);
    this.root.visible = false;
    this.wait = between(rng, def.every) * 0.5;
  }

  update(scene: SwimScene) {
    const { def } = this;
    if (this.age >= 0) this.age += scene.dt;
    if (this.age > def.surfaceSec) this.age = -1;
    if (this.age < 0 && (this.wait -= scene.dt) <= 0) this.surface(scene);
    this.root.visible = this.age >= 0 && scene.share > 0;
    if (!this.root.visible) return;
    const units = TUNING.seamanship.boat.knotToUnits;
    this.x += Math.sin(this.heading) * def.swimKn * units * scene.dt;
    this.y += Math.cos(this.heading) * def.swimKn * units * scene.dt;
    const pose = whalePose(this.age / def.surfaceSec, this.pose);
    const sea = scene.heightAt(this.x, -this.y) * 0.5;
    const placed = poseMatrix(this.x, this.y, this.heading, pose, def.size, sea);
    placed.decompose(this.body.position, this.body.quaternion, this.body.scale);
    this.spout.visible = pose.spout > 0.02;
    if (this.spout.visible) {
      this.blow.copy(BLOWHOLE).applyMatrix4(placed);
      this.spout.position.set(this.blow.x, sea, this.blow.z);
      this.spout.scale.setScalar(def.size * pose.spout);
    }
  }

  /** She surfaces on the next frame, dead ahead of the boat, if those waters are hers. */
  surfaceNow() {
    this.age = -1;
    this.wait = 0;
    this.ahead = true;
  }

  /** Somewhere off the boat, if those waters are hers; else she waits a little and looks again. */
  private surface(scene: SwimScene) {
    const { boat } = scene;
    const { def, rng } = this;
    // Ahead or abeam, where the camera looks, never astern under the HUD.
    const bearing = boat.heading + (this.ahead ? 0 : (rng() - 0.5) * WHALE_ARC);
    const far = this.ahead ? def.fromBoat[0] : between(rng, def.fromBoat);
    this.ahead = false;
    const x = boat.x + Math.sin(bearing) * far;
    const y = boat.y + Math.cos(bearing) * far;
    if (scene.share <= 0 || !livesIn(def, scene.seaAt(x, y), scene.shoreAt(x, y))) {
      this.wait = RETRY_SEC;
      return;
    }
    this.x = x;
    this.y = y;
    this.heading = rng() * Math.PI * 2;
    this.age = 0;
    this.wait = between(rng, def.every);
  }

  dispose() {
    this.body.geometry.dispose();
    this.spout.geometry.dispose();
    this.material.dispose();
  }
}
