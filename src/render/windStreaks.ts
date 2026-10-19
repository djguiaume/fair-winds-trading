import * as THREE from 'three';
import { type Rng, createRng } from '../sim/rng';

interface Streak {
  x: number;
  z: number;
  age: number;
  life: number;
}

const AREA_X = 200;
const AREA_Z = 160;

/** Faint white streaks drifting with the wind around the camera, like in the reference ad. */
export class WindStreaks {
  readonly mesh: THREE.Mesh;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly streaks: Streak[];
  private readonly rng: Rng = createRng(99);

  constructor(count: number) {
    this.positions = new Float32Array(count * 4 * 3);
    this.colors = new Float32Array(count * 4 * 4);
    const index: number[] = [];
    for (let i = 0; i < count; i++) {
      const a = i * 4;
      index.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
    this.geometry.setIndex(index);
    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage),
    );
    this.mesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.streaks = Array.from({ length: count }, () => this.spawn(0, 0, this.rng() * 3));
  }

  private spawn(cx: number, cz: number, age = 0): Streak {
    return {
      x: cx + (this.rng() - 0.5) * AREA_X,
      z: cz + (this.rng() - 0.5) * AREA_Z,
      age,
      life: 2 + this.rng() * 2,
    };
  }

  /** `toX/toZ`: scene-space unit vector the wind blows toward; `speed` in units/s. */
  update(dt: number, center: THREE.Vector3, toX: number, toZ: number, speed: number) {
    const len = 3 + speed * 0.18;
    const w = 0.09;
    this.streaks.forEach((s, i) => {
      s.age += dt;
      s.x += toX * speed * dt;
      s.z += toZ * speed * dt;
      const far = Math.abs(s.x - center.x) > AREA_X / 2 || Math.abs(s.z - center.z) > AREA_Z / 2;
      if (s.age > s.life || far) this.streaks[i] = s = this.spawn(center.x, center.z);
      const fade = Math.sin(Math.PI * Math.min(1, s.age / s.life));
      const px = -toZ * w;
      const pz = toX * w;
      const hx = toX * len * 0.5;
      const hz = toZ * len * 0.5;
      const y = 2.2;
      this.positions.set(
        [
          s.x - hx + px,
          y,
          s.z - hz + pz,
          s.x - hx - px,
          y,
          s.z - hz - pz,
          s.x + hx + px,
          y,
          s.z + hz + pz,
          s.x + hx - px,
          y,
          s.z + hz - pz,
        ],
        i * 12,
      );
      const a = 0.35 * fade;
      this.colors.set([1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, a, 1, 1, 1, a], i * 16);
    });
    this.geometry.attributes.position!.needsUpdate = true;
    this.geometry.attributes.color!.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
