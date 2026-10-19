import * as THREE from 'three';
import { waveHeight } from './ocean';

const MAX_POINTS = 44;
const LIFE = 2.6;
const SPAWN_EVERY = 0.07;

interface WakePoint {
  x: number;
  z: number;
  /** Unit vector across the trail. */
  sx: number;
  sz: number;
  age: number;
  strength: number;
}

/** Foam trail behind the boat: a ribbon that widens and fades with age. One draw call. */
export class Wake {
  readonly mesh: THREE.Mesh;
  private readonly points: WakePoint[] = [];
  private readonly positions = new Float32Array(MAX_POINTS * 2 * 3);
  private readonly colors = new Float32Array(MAX_POINTS * 2 * 4);
  private readonly geometry = new THREE.BufferGeometry();
  private sinceSpawn = 0;

  constructor() {
    const index: number[] = [];
    for (let i = 0; i < MAX_POINTS - 1; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
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
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  /** `stern` in scene coords, `heading` as a scene-space unit vector of the bow direction. */
  update(
    dt: number,
    time: number,
    stern: THREE.Vector3,
    dirX: number,
    dirZ: number,
    speedKn: number,
  ) {
    for (const p of this.points) p.age += dt;
    while (this.points.length && this.points[this.points.length - 1]!.age > LIFE) this.points.pop();

    this.sinceSpawn += dt;
    if (this.sinceSpawn >= SPAWN_EVERY) {
      this.sinceSpawn = 0;
      const strength = Math.min(1, speedKn / 6);
      if (strength > 0.08) {
        this.points.unshift({ x: stern.x, z: stern.z, sx: -dirZ, sz: dirX, age: 0, strength });
        if (this.points.length > MAX_POINTS) this.points.pop();
      }
    }

    // Live head point stays glued to the stern so the trail doesn't lag behind the boat.
    const n = this.points.length;
    for (let i = 0; i < MAX_POINTS; i++) {
      const p =
        i === 0 && n
          ? { ...this.points[0]!, x: stern.x, z: stern.z }
          : this.points[Math.min(i, n - 1)];
      const o = i * 6;
      const c = i * 8;
      if (!p || i >= n) {
        this.positions.fill(0, o, o + 6);
        this.colors.fill(0, c, c + 8);
        continue;
      }
      const t = p.age / LIFE;
      const half = 1.2 + t * 4.5;
      const y = waveHeight(p.x, p.z, time) + 0.12;
      this.positions.set(
        [p.x + p.sx * half, y, p.z + p.sz * half, p.x - p.sx * half, y, p.z - p.sz * half],
        o,
      );
      const a = (1 - t) * (1 - t) * 0.6 * p.strength * Math.min(1, i / 2 + 0.3);
      this.colors.set([0.92, 0.99, 1, a, 0.92, 0.99, 1, a], c);
    }
    this.geometry.attributes.position!.needsUpdate = true;
    this.geometry.attributes.color!.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
