import * as THREE from 'three';
import { waveHeight } from './oceanWaves';
import { QUALITY, type QualityLevel } from './quality';
import { PALETTE } from '../data/props';

const CAPACITY = 64;
/** Bounded history and transparency coverage; no spray particles or render targets. */
export const WAKE_DETAIL = {
  ultralow: { points: 24, life: 1.8, interval: 0.1, centre: false },
  low: { points: 24, life: 1.8, interval: 0.1, centre: false },
  medium: { points: 40, life: 2.6, interval: 0.075, centre: true },
  high: { points: 64, life: 3.4, interval: 0.06, centre: true },
  ultra: { points: 64, life: 3.4, interval: 0.06, centre: true },
} as const;

/** The player's bow waves hug her shoulders; the other boats' run further aft as a V. */
const BOW_WAVE = { aft: 0.35, spread: 0.48 };

interface Point {
  x: number;
  z: number;
  sx: number;
  sz: number;
  age: number;
  strength: number;
  distance: number;
}

/** Hull dimensions in scene units, exported by the model rather than guessed by ship class. */
export interface WakeHull {
  length: number;
  beam: number;
}

/**
 * Foam strips on the waves in one dynamic mesh and one draw: the player's wake and the other
 * boats' bow waves share it. Colours come from the palette (`wakeFoam`, `wakeEdge`), so they can
 * follow the water.
 */
export class FoamStrips {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  protected readonly geometry = new THREE.BufferGeometry();
  private readonly positions: Float32Array;
  private readonly foam: Float32Array;
  protected vertices = 0;

  /** Room for `strips` strips of one quad each, floating on `water` (scene x, z, time). */
  constructor(
    strips: number,
    private readonly water: (x: number, z: number, t: number) => number = waveHeight,
  ) {
    this.positions = new Float32Array(strips * 6 * 3);
    this.foam = new Float32Array(strips * 6 * 4);
    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.geometry.setAttribute(
      'aFoam',
      new THREE.BufferAttribute(this.foam, 4).setUsage(THREE.DynamicDrawUsage),
    );
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uFoam: { value: new THREE.Color(PALETTE.colors.wakeFoam as string) },
        uEdge: { value: new THREE.Color(PALETTE.colors.wakeEdge as string) },
      },
      vertexShader: `attribute vec4 aFoam;
        varying vec4 vFoam;
        void main() {
          vFoam = aFoam;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `uniform float uTime;
        uniform vec3 uFoam;
        uniform vec3 uEdge;
        varying vec4 vFoam;
        void main() {
          float edge = 1.0 - smoothstep(0.3, 1.0, abs(vFoam.x));
          float breakup = 0.64 + 0.22 * sin(vFoam.y * 2.8 + vFoam.x * 4.0 - uTime * 0.9)
                                  + 0.14 * sin(vFoam.y * 6.1 - vFoam.x * 7.0 + uTime * 0.5);
          float alpha = edge * smoothstep(0.18, 0.8, breakup) * vFoam.z;
          vec3 col = mix(uEdge, uFoam, vFoam.w);
          gl_FragColor = vec4(col, alpha);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.geometry.setDrawRange(0, 0);
  }

  protected strip(
    ax: number,
    az: number,
    asx: number,
    asz: number,
    aw: number,
    aa: number,
    av: number,
    bx: number,
    bz: number,
    bsx: number,
    bsz: number,
    bw: number,
    ba: number,
    bv: number,
    white: number,
    time: number,
  ) {
    for (let corner = 0; corner < 6; corner++) {
      const end = corner === 2 || corner === 4 || corner === 5;
      const side = corner === 0 || corner === 3 || corner === 4 ? -1 : 1;
      const x = (end ? bx : ax) + (end ? bsx * bw : asx * aw) * side;
      const z = (end ? bz : az) + (end ? bsz * bw : asz * aw) * side;
      const i = this.vertices++;
      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = this.water(x, z, time) + 0.14;
      this.positions[i * 3 + 2] = z;
      this.foam[i * 4] = side;
      this.foam[i * 4 + 1] = end ? bv : av;
      this.foam[i * 4 + 2] = end ? ba : aa;
      this.foam[i * 4 + 3] = white;
    }
  }

  /**
   * Curved, tapered foam on either shoulder of a hull at (cx, cz) heading (dx, dz): from the bow
   * it runs `shape.aft` hull lengths aft and spreads `shape.spread` beams out.
   */
  protected bowWaves(
    cx: number,
    cz: number,
    dx: number,
    dz: number,
    hull: WakeHull,
    strength: number,
    steps: number,
    time: number,
    shape: { aft: number; spread: number } = BOW_WAVE,
  ) {
    const sx = -dz,
      sz = dx;
    for (const side of [-1, 1]) {
      for (let j = 0; j < steps; j++) {
        const a = j / steps,
          b = (j + 1) / steps;
        const forwardA = hull.length * (0.48 - a * shape.aft);
        const forwardB = hull.length * (0.48 - b * shape.aft);
        const acrossA = hull.beam * (0.06 + a * shape.spread) * side;
        const acrossB = hull.beam * (0.06 + b * shape.spread) * side;
        this.strip(
          cx + dx * forwardA + sx * acrossA,
          cz + dz * forwardA + sz * acrossA,
          sx,
          sz,
          hull.beam * 0.09,
          strength * Math.sin(a * Math.PI) * 0.65,
          a * 5,
          cx + dx * forwardB + sx * acrossB,
          cz + dz * forwardB + sz * acrossB,
          sx,
          sz,
          hull.beam * 0.09,
          strength * Math.sin(b * Math.PI) * 0.65,
          b * 5,
          1,
          time,
        );
      }
    }
  }

  /** Uploads the strips written since `vertices` was last set to 0. */
  protected finish(time: number) {
    this.geometry.setDrawRange(0, this.vertices);
    this.geometry.attributes.position!.needsUpdate = true;
    this.geometry.attributes.aFoam!.needsUpdate = true;
    this.mesh.material.uniforms.uTime!.value = time;
  }

  dispose() {
    this.geometry.dispose();
    this.mesh.material.dispose();
  }
}

/** Broken foam edges, quiet centre turbulence and two hull-attached bow waves: one draw call. */
export class Wake extends FoamStrips {
  private readonly history: Point[] = Array.from({ length: CAPACITY }, () => ({
    x: 0,
    z: 0,
    sx: 0,
    sz: 0,
    age: 0,
    strength: 0,
    distance: 0,
  }));
  private count = 0;
  private elapsed = 0;
  private distance = 0;
  private level: QualityLevel = 'medium';

  constructor(water?: (x: number, z: number, t: number) => number) {
    // Three strips per history segment, plus two bow strips of six segments each.
    super(CAPACITY * 3 + 12, water);
  }

  setQuality(level: QualityLevel) {
    this.level = level;
    this.count = Math.min(this.count, WAKE_DETAIL[level].points);
  }

  /** Clear on ship changes and teleports so unrelated positions are never joined. */
  reset() {
    this.count = 0;
    this.elapsed = 0;
    this.distance = 0;
    this.geometry.setDrawRange(0, 0);
  }

  /** Centre and heading are scene-space; emitted history stays in world space through turns. */
  update(
    dt: number,
    time: number,
    centre: THREE.Vector3,
    dx: number,
    dz: number,
    speedKn: number,
    hull: WakeHull,
  ) {
    const detail = WAKE_DETAIL[this.level];
    const sx = -dz,
      sz = dx;
    const x = centre.x - dx * hull.length * 0.5;
    const z = centre.z - dz * hull.length * 0.5;
    const newest = this.history[0]!;
    if (this.count && Math.hypot(x - newest.x, z - newest.z) > Math.max(25, hull.length * 2))
      this.reset();
    for (let i = 0; i < this.count; i++) this.history[i]!.age += dt;
    while (this.count && this.history[this.count - 1]!.age > detail.life) this.count--;
    this.elapsed += dt;
    const strength = THREE.MathUtils.smoothstep(Math.abs(speedKn), 0.4, 8);
    if (strength > 0 && (this.count === 0 || this.elapsed >= detail.interval)) {
      const moved = this.count ? Math.hypot(x - newest.x, z - newest.z) : 0;
      // Do not accumulate overlapping stationary foam.
      if (!this.count || moved > 0.12) {
        this.distance += moved;
        const recycled = this.history[CAPACITY - 1]!;
        for (let i = CAPACITY - 1; i > 0; i--) this.history[i] = this.history[i - 1]!;
        Object.assign(recycled, { x, z, sx, sz, age: 0, strength, distance: this.distance });
        this.history[0] = recycled;
        this.count = Math.min(detail.points, this.count + 1);
        this.elapsed = 0;
      }
    }
    this.vertices = 0;
    for (let i = 0; i < this.count - 1; i++) {
      const a = this.history[i]!,
        b = this.history[i + 1]!;
      const at = a.age / detail.life,
        bt = b.age / detail.life;
      const af = (1 - at) ** 2 * a.strength,
        bf = (1 - bt) ** 2 * b.strength;
      const ax = i === 0 && strength > 0 ? x : a.x;
      const az = i === 0 && strength > 0 ? z : a.z;
      for (const side of [-1, 1]) {
        const spreadA = hull.beam * 0.32 + a.age * (0.8 + a.strength * 1.4);
        const spreadB = hull.beam * 0.32 + b.age * (0.8 + b.strength * 1.4);
        this.strip(
          ax + a.sx * spreadA * side,
          az + a.sz * spreadA * side,
          a.sx,
          a.sz,
          hull.beam * 0.12 + at * 0.55,
          af * 0.65,
          a.distance,
          b.x + b.sx * spreadB * side,
          b.z + b.sz * spreadB * side,
          b.sx,
          b.sz,
          hull.beam * 0.12 + bt * 0.55,
          bf * 0.65,
          b.distance,
          1,
          time,
        );
      }
      if (detail.centre)
        this.strip(
          ax,
          az,
          a.sx,
          a.sz,
          hull.beam * 0.35 + at,
          af * 0.18,
          a.distance,
          b.x,
          b.z,
          b.sx,
          b.sz,
          hull.beam * 0.35 + bt,
          bf * 0.18,
          b.distance,
          0,
          time,
        );
    }
    // Bow waves on either shoulder; they disappear when the boat stops.
    this.bowWaves(
      centre.x,
      centre.z,
      dx,
      dz,
      hull,
      strength,
      QUALITY[this.level].lowDetail ? 3 : 6,
      time,
    );
    this.finish(time);
    this.mesh.visible = this.count > 1 || strength > 0;
  }
}
