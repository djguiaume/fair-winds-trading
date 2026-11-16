import * as THREE from 'three';
import { TUNING } from '../data/tuning';
import { DEG, clamp } from '../sim/math';

/** The sea's height at a scene point. */
type Wave = (x: number, z: number) => number;

/** Most bits of spray in the air at once (issue #554). */
export const SPRAY_CAPACITY = 64;

/** What the spray reads from the boat each frame; filled in place by the caller. */
export interface SprayInput {
  /** Her centre on the sea, scene units, and her heading as a unit vector (scene x, z). */
  x: number;
  z: number;
  dx: number;
  dz: number;
  speedKn: number;
  /** Her heel, radians (+ = mast to port), and her hull's waterline size. */
  heel: number;
  length: number;
  beam: number;
  /** Seconds since she last touched a quay or a shoal (`BoatState.sinceBump`). */
  sinceBump: number;
}

/**
 * The spray thrown off the player's boat (issue #554, decision 0326): a bow spray that grows with
 * her speed and with head seas, a splash to leeward when a gust heels her, a burst when she bumps.
 * Opaque low-poly bits in the sea-foam colour (the smoke rules), one instanced draw, hidden while
 * none fly; at most 64 at once, kept in fixed arrays so a frame allocates nothing. Numbers in
 * `waves.json › spray`.
 */
export class BoatSpray {
  readonly mesh: THREE.InstancedMesh;
  /** False on Ultra-low: nothing is thrown and the mesh stays hidden. */
  enabled = true;
  private readonly state = new Float32Array(SPRAY_CAPACITY * 8);
  private live = 0;
  private due = 0;
  /** Her heel last frame; NaN until there is one, so a first frame throws no splash. */
  private lastHeel = NaN;
  private lastBump = Infinity;
  private readonly matrix = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly euler = new THREE.Euler();
  private readonly pos = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();

  constructor(private readonly random = Math.random) {
    const material = new THREE.MeshLambertMaterial({
      color: TUNING.waves.spray.colour,
      flatShading: true,
    });
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      material,
      SPRAY_CAPACITY,
    );
    this.mesh.name = 'BoatSpray';
    this.mesh.count = 0;
    this.mesh.visible = false;
    // The bits fly well away from the shape's own bounds.
    this.mesh.frustumCulled = false;
  }

  /** How many bits are in the air, for the tests and `?bench`. */
  get active() {
    return this.live;
  }

  /** How strongly she throws spray at `speedKn`: 0 below `minKn`, 1 from `fullKn`. */
  static strength(speedKn: number) {
    const s = TUNING.waves.spray;
    const t = clamp((speedKn - s.minKn) / (s.fullKn - s.minKn), 0, 1);
    return t * t * (3 - 2 * t);
  }

  /** Moves the spray on and throws more; `wave` gives the sea's height at a scene point. */
  update(dt: number, boat: SprayInput, wave: Wave) {
    if (this.enabled && dt > 0 && !Number.isNaN(this.lastHeel)) this.throwSpray(dt, boat, wave);
    this.lastHeel = boat.heel;
    this.lastBump = boat.sinceBump;
    this.fly(dt, wave);
  }

  /** Clears the air, as after a ship change or a reload. */
  reset() {
    this.live = 0;
    this.due = 0;
    this.lastHeel = NaN;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  private throwSpray(dt: number, boat: SprayInput, wave: Wave) {
    const s = TUNING.waves.spray;
    const power = BoatSpray.strength(boat.speedKn);
    const bowX = boat.x + boat.dx * boat.length * 0.45;
    const bowZ = boat.z + boat.dz * boat.length * 0.45;
    // Head seas: a crest under her bow higher than the sea at her middle bursts over it.
    const head = clamp((wave(bowX, bowZ) - wave(boat.x, boat.z)) / s.headRise, 0, 1);
    this.due += power * s.bowRate * (1 + head * s.headBoost) * dt;
    for (; this.due >= 1; this.due--) this.bowBit(boat, bowX, bowZ, power, head, wave);
    // A gust heels her: the heel growing fast throws a splash off her lee side.
    const heeling = (Math.abs(boat.heel) - Math.abs(this.lastHeel)) / dt;
    if (heeling > s.heelRateDeg * DEG && power > 0)
      this.burst(boat, s.heelBurst * power, true, wave);
    if (boat.sinceBump < this.lastBump) this.burst(boat, s.bumpBurst, false, wave);
  }

  /** One bit off a bow shoulder: outward, up and a little ahead, bigger the faster she goes. */
  private bowBit(boat: SprayInput, x: number, z: number, power: number, head: number, wave: Wave) {
    const s = TUNING.waves.spray;
    const side = this.random() < 0.5 ? -1 : 1;
    const sx = -boat.dz * side;
    const sz = boat.dx * side;
    const out = s.outward * (0.6 + this.random() * 0.6) * (0.5 + power * 0.5);
    const ahead = boat.speedKn * TUNING.seamanship.boat.knotToUnits * 0.25;
    const up = s.rise * (0.4 + power * 0.6) * (1 + head * 0.5) * (0.7 + this.random() * 0.5);
    const size = s.sizeMin + (s.sizeMax - s.sizeMin) * power * (0.6 + this.random() * 0.4);
    const px = x + sx * boat.beam * 0.3;
    const pz = z + sz * boat.beam * 0.3;
    this.add(
      px,
      wave(px, pz) + 0.3,
      pz,
      sx * out + boat.dx * ahead,
      up,
      sz * out + boat.dz * ahead,
      size,
    );
  }

  /** A burst of `count` bits: off her lee side amidships (`lee`), or off both bows (a bump). */
  private burst(boat: SprayInput, count: number, lee: boolean, wave: Wave) {
    const s = TUNING.waves.spray;
    // Starboard is (-dz, dx); heel + leans her mast to port, so her lee side is port.
    const px = -boat.dz;
    const pz = boat.dx;
    const leeSide = boat.heel > 0 ? -1 : 1;
    const along = lee ? 0 : boat.length * 0.45;
    for (let i = 0; i < Math.round(count); i++) {
      const spread = (this.random() - 0.5) * 2;
      const across = lee ? leeSide : spread < 0 ? -1 : 1;
      const x =
        boat.x + boat.dx * (along + spread * boat.length * 0.2) + px * across * boat.beam * 0.5;
      const z =
        boat.z + boat.dz * (along + spread * boat.length * 0.2) + pz * across * boat.beam * 0.5;
      const out = across * s.outward * (0.5 + this.random());
      this.add(
        x,
        wave(x, z) + 0.3,
        z,
        px * out,
        s.rise * (0.6 + this.random() * 0.5),
        pz * out,
        s.sizeMin + (s.sizeMax - s.sizeMin) * (0.5 + this.random() * 0.5),
      );
    }
  }

  /** A new bit; when the air is full the oldest gives way. */
  private add(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number) {
    if (this.live === SPRAY_CAPACITY) this.remove(0);
    const o = this.live++ * 8;
    const st = this.state;
    st[o] = x;
    st[o + 1] = y;
    st[o + 2] = z;
    st[o + 3] = vx;
    st[o + 4] = vy;
    st[o + 5] = vz;
    st[o + 6] = size;
    st[o + 7] = 0;
  }
  private remove(i: number) {
    const last = --this.live;
    if (i !== last) this.state.copyWithin(i * 8, last * 8, last * 8 + 8);
  }

  /** Each bit flies, falls and shrinks back into the sea. */
  private fly(dt: number, wave: Wave) {
    const s = TUNING.waves.spray;
    const st = this.state;
    for (let i = this.live - 1; i >= 0; i--) {
      const o = i * 8;
      const vy = st[o + 4]! - s.gravity * dt;
      const x = st[o]! + st[o + 3]! * dt;
      const y = st[o + 1]! + vy * dt;
      const z = st[o + 2]! + st[o + 5]! * dt;
      const age = st[o + 7]! + dt;
      st[o] = x;
      st[o + 1] = y;
      st[o + 2] = z;
      st[o + 4] = vy;
      st[o + 7] = age;
      if (age > s.life || (vy < 0 && y < wave(x, z) - 0.2)) this.remove(i);
    }
    for (let i = 0; i < this.live; i++) {
      const o = i * 8;
      const age = st[o + 7]! / s.life;
      const size = st[o + 6]! * (1 - age * 0.6);
      this.euler.set(age * 4 + i, i * 1.7, 0);
      this.quat.setFromEuler(this.euler);
      this.pos.set(st[o]!, st[o + 1]!, st[o + 2]!);
      this.matrix.compose(this.pos, this.quat, this.scale.set(size, size * 0.8, size));
      this.mesh.setMatrixAt(i, this.matrix);
    }
    this.mesh.count = this.live;
    this.mesh.visible = this.live > 0;
    if (this.live) this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}
