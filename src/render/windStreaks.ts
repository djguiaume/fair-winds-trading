import * as THREE from 'three';
import { type Rng, createRng } from '../sim/rng';
import { NORTH_UP, type ViewAxes } from './cameraOrbit';
import { TUNING } from '../data/tuning';

interface Streak {
  x: number;
  z: number;
  age: number;
  life: number;
}

/** What the streaks need of the camera: its ground axes, where it stands, how low it is. */
export interface StreakView {
  readonly axes: Readonly<ViewAxes>;
  readonly eye: Readonly<THREE.Vector3>;
  /** 0 the sea camera .. 1 the follow cam. */
  readonly low: number;
}

/** The sea camera looking north: the streaks as they always were. */
const FROM_ABOVE: StreakView = { axes: NORTH_UP, eye: new THREE.Vector3(), low: 0 };

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
   * them, strong wind makes every streak show and brightens them a little. Seen from the low follow
   * cam (`view.low`), the streaks lie thinner on the water and fade out near the camera (issue
   * #540), so the closest never read as bars.
   */
  update(
    dt: number,
    center: THREE.Vector3,
    toX: number,
    toZ: number,
    speed: number,
    strength = 0.56,
    view: StreakView = FROM_ABOVE,
  ) {
    const { axes, eye, low } = view;
    const look = TUNING.graphics.windStreaks;
    const follow = look.chase;
    const len = 3 + speed * 0.18;
    const w = THREE.MathUtils.lerp(look.halfWidth, follow.halfWidth, low);
    const y = THREE.MathUtils.lerp(look.lift, follow.lift, low);
    const shown = Math.min(1, 0.4 + 1.1 * strength) * this.streaks.length;
    const alpha = 0.35 * (0.5 + 0.9 * strength) * THREE.MathUtils.lerp(1, follow.alpha, low);
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
      const near = THREE.MathUtils.smoothstep(
        Math.hypot(s.x - eye.x, s.z - eye.z),
        follow.fadeFrom,
        follow.fadeTo,
      );
      const fade = Math.sin(Math.PI * Math.min(1, s.age / s.life)) * (1 - low * (1 - near));
      const px = -toZ * w;
      const pz = toX * w;
      const hx = toX * len * 0.5;
      const hz = toZ * len * 0.5;
      this.corner(i * 4, s.x - hx + px, y, s.z - hz + pz, 0);
      this.corner(i * 4 + 1, s.x - hx - px, y, s.z - hz - pz, 0);
      const a = i < shown ? alpha * fade : 0;
      this.corner(i * 4 + 2, s.x + hx + px, y, s.z + hz + pz, a);
      this.corner(i * 4 + 3, s.x + hx - px, y, s.z + hz - pz, a);
    });
    this.geometry.attributes.position!.needsUpdate = true;
    this.geometry.attributes.color!.needsUpdate = true;
  }

  /** One white corner of a streak, written in place (no array per frame). */
  private corner(v: number, x: number, y: number, z: number, alpha: number) {
    this.positions[v * 3] = x;
    this.positions[v * 3 + 1] = y;
    this.positions[v * 3 + 2] = z;
    this.colors[v * 4] = 1;
    this.colors[v * 4 + 1] = 1;
    this.colors[v * 4 + 2] = 1;
    this.colors[v * 4 + 3] = alpha;
  }

  dispose() {
    this.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
