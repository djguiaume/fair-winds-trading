import * as THREE from 'three';
import { TUNING } from '../data/tuning';
import palette from '../data/palette.json';
import { PALETTE } from './palette';

/** Most pieces of each kind afloat at once; the tuning counts are capped to fit. */
const CAPACITY = 12;
const GRAVITY = 18;

interface Piece {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  spin: number;
  size: number;
  age: number;
  life: number;
}

/**
 * What a crash or a reef strike throws up (decision 0208): a chunky splash of foam that rises and
 * falls back, and a few planks that drift off on the swell and sink. Shared by every impact: one
 * instanced draw per kind, hidden while nothing is afloat. Opaque, no particles, nothing glows.
 */
export class ImpactDebris {
  readonly planks: THREE.InstancedMesh;
  readonly splash: THREE.InstancedMesh;
  private readonly afloat: Piece[] = [];
  private readonly thrown: Piece[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly euler = new THREE.Euler();
  private readonly pos = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();

  constructor() {
    // Planks a little darker than the hull's plank colour, so they read on the turquoise sea.
    const wood = new THREE.Color(palette.colors.plank).lerp(new THREE.Color('#2e2219'), 0.2);
    this.planks = new THREE.InstancedMesh(
      new THREE.BoxGeometry(2.6, 0.22, 0.55),
      new THREE.MeshLambertMaterial({ color: wood, flatShading: true }),
      CAPACITY,
    );
    this.splash = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.75, 0),
      new THREE.MeshLambertMaterial({ color: PALETTE.foam, flatShading: true }),
      CAPACITY,
    );
    for (const m of [this.planks, this.splash]) {
      m.name = m === this.planks ? 'ImpactPlanks' : 'ImpactSplash';
      m.count = 0;
      m.visible = false;
      // The pieces fly well away from the shape's own bounds.
      m.frustumCulled = false;
    }
  }

  /** How many pieces are about, for the tests and `?bench`. */
  get active() {
    return this.afloat.length + this.thrown.length;
  }

  /**
   * An impact at scene `x`, `z`, the boat heading along `dx`, `dz` (a unit vector) with a hull
   * `beam` wide: the splash goes up at her bow, the planks float off both sides.
   */
  spawn(x: number, z: number, dx: number, dz: number, beam: number, random = Math.random) {
    const d = TUNING.seamanship.damage;
    const spread = () => (random() - 0.5) * 2;
    for (let i = 0; i < Math.min(CAPACITY, d.splash); i++) {
      if (this.thrown.length >= CAPACITY) this.thrown.shift();
      this.thrown.push({
        x: x + dx * 2 + spread() * beam * 0.5,
        y: 0.3,
        z: z + dz * 2 + spread() * beam * 0.5,
        vx: dx * 2 + spread() * 2.5,
        vy: 7 + random() * 4,
        vz: dz * 2 + spread() * 2.5,
        yaw: random() * Math.PI,
        spin: spread() * 3,
        size: 1.2 + random() * 0.8,
        age: 0,
        life: 2,
      });
    }
    for (let i = 0; i < Math.min(CAPACITY, d.planks); i++) {
      if (this.afloat.length >= CAPACITY) this.afloat.shift();
      const side = i % 2 === 0 ? 1 : -1;
      // Across the heading: (-dz, dx) is to one side of her.
      const sx = -dz * side;
      const sz = dx * side;
      this.afloat.push({
        x: x + dx * (1 + random() * 2) + sx * beam * (0.4 + random() * 0.4),
        y: 0,
        z: z + dz * (1 + random() * 2) + sz * beam * (0.4 + random() * 0.4),
        vx: sx * (1 + random() * 1.5) - dx * 0.8,
        vy: 0,
        vz: sz * (1 + random() * 1.5) - dz * 0.8,
        yaw: random() * Math.PI,
        spin: spread() * 0.8,
        size: 0.8 + random() * 0.4,
        age: 0,
        life: d.debrisSeconds * (0.75 + random() * 0.25),
      });
    }
  }

  /** Move every piece on; `wave` gives the sea's height at a scene point. */
  update(dt: number, wave: (x: number, z: number) => number) {
    let n = 0;
    for (let i = this.thrown.length - 1; i >= 0; i--) {
      const p = this.thrown[i]!;
      p.age += dt;
      p.vy -= GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if ((p.vy < 0 && p.y < wave(p.x, p.z) - 0.4) || p.age > p.life) {
        this.thrown.splice(i, 1);
        continue;
      }
      // The chunks shrink as they fall back, so the splash collapses into the sea.
      const s = p.size * (p.vy > 0 ? 1 : Math.max(0.35, 1 + p.vy / 14));
      this.euler.set(p.spin * p.age, p.yaw, 0);
      this.put(this.splash, n++, p, s, s * 1.15, s);
    }
    this.splash.count = n;
    this.splash.visible = n > 0;
    if (n) this.splash.instanceMatrix.needsUpdate = true;

    n = 0;
    for (let i = this.afloat.length - 1; i >= 0; i--) {
      const p = this.afloat[i]!;
      p.age += dt;
      if (p.age > p.life) {
        this.afloat.splice(i, 1);
        continue;
      }
      const drag = Math.exp(-0.6 * dt);
      p.vx *= drag;
      p.vz *= drag;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      // They ride the swell, then settle and sink in their last second.
      const sink = Math.max(0, p.age - (p.life - 1)) * 0.9;
      p.y = wave(p.x, p.z) + 0.06 - sink;
      this.euler.set(Math.sin(p.age * 2 + p.yaw) * 0.12, p.yaw + p.spin * p.age, 0);
      this.put(this.planks, n++, p, p.size, 1, 1);
    }
    this.planks.count = n;
    this.planks.visible = n > 0;
    if (n) this.planks.instanceMatrix.needsUpdate = true;
  }

  /** Clear the sea, as after a ship change or a reload. */
  reset() {
    this.afloat.length = 0;
    this.thrown.length = 0;
    this.update(0, () => 0);
  }

  private put(mesh: THREE.InstancedMesh, i: number, p: Piece, sx: number, sy: number, sz: number) {
    this.quat.setFromEuler(this.euler);
    this.matrix.compose(this.pos.set(p.x, p.y, p.z), this.quat, this.scale.set(sx, sy, sz));
    mesh.setMatrixAt(i, this.matrix);
  }

  dispose() {
    for (const m of [this.planks, this.splash]) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      m.dispose();
    }
  }
}
