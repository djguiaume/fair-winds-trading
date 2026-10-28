import * as THREE from 'three';
import { type Rng, createRng } from '../sim/rng';
import { NORTH_UP, type ViewAxes } from './cameraOrbit';

interface Streak {
  x: number;
  z: number;
  age: number;
  life: number;
}

/** The streak field across and up the screen, turning with the camera (decision 0223). */
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
    this.streaks = Array.from({ length: count }, () => this.spawn(0, 0, NORTH_UP, this.rng() * 3));
  }

  private spawn(cx: number, cz: number, axes: Readonly<ViewAxes>, age = 0): Streak {
    const across = (this.rng() - 0.5) * AREA_X;
    const up = (this.rng() - 0.5) * AREA_Z;
    return {
      x: cx + across * axes.rightX + up * axes.forwardX,
      z: cz + across * axes.rightZ + up * axes.forwardZ,
      age,
      life: 2 + this.rng() * 2,
    };
  }

  /**
   * `toX/toZ`: scene-space unit vector the wind blows toward; `speed` in units/s. `strength` 0..1
   * (decision 0040): around a normal breeze the streaks look as before; a calm thins and fades
   * them, strong wind makes every streak show and brightens them a little.
   */
  update(
    dt: number,
    center: THREE.Vector3,
    toX: number,
    toZ: number,
    speed: number,
    strength = 0.56,
    axes: Readonly<ViewAxes> = NORTH_UP,
  ) {
    const len = 3 + speed * 0.18;
    const w = 0.09;
    const shown = Math.min(1, 0.4 + 1.1 * strength) * this.streaks.length;
    const alpha = 0.35 * (0.5 + 0.9 * strength);
    this.streaks.forEach((s, i) => {
      s.age += dt;
      s.x += toX * speed * dt;
      s.z += toZ * speed * dt;
      const dx = s.x - center.x;
      const dz = s.z - center.z;
      const far =
        Math.abs(dx * axes.rightX + dz * axes.rightZ) > AREA_X / 2 ||
        Math.abs(dx * axes.forwardX + dz * axes.forwardZ) > AREA_Z / 2;
      if (s.age > s.life || far) this.streaks[i] = s = this.spawn(center.x, center.z, axes);
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
      const a = i < shown ? alpha * fade : 0;
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
