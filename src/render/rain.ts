import * as THREE from 'three';
import { type Rng, createRng } from '../sim/rng';
import { type Storm } from '../sim/storms';

interface Drop {
  x: number;
  y: number;
  z: number;
}

const AREA_X = 240;
/** The camera looks north at a slant, so the far (upper) part of the screen covers more sea. */
const AREA_NEAR = 80;
const AREA_FAR = 170;
const TOP = 40;
/** Falling speed (units/s). */
const FALL = 70;

/** Conservative broad phase over every position a drop can sample after movement/respawn. */
export function rainMayReachArea(
  center: THREE.Vector3,
  showers: number,
  storms: readonly Storm[],
): boolean {
  if (showers > 0) return true;
  return storms.some((storm) => {
    if (storm.intensity <= 0) return false;
    const dx = Math.max(0, Math.abs(storm.x - center.x) - AREA_X / 2);
    // Simulation north is negative scene z. The rain field extends further north.
    const z = -storm.y;
    const dz = Math.max(0, center.z - AREA_FAR - z, z - center.z - AREA_NEAR);
    return dx * dx + dz * dz < storm.radius * storm.radius;
  });
}

/**
 * Rain (decision 0067): short falling streaks around the camera, slanted by the wind. Each drop
 * asks `rainAt` how hard it rains where it is, so a storm's downpour has an edge you can see
 * coming. One draw call; the drop count follows the quality level.
 */
export class Rain {
  readonly mesh: THREE.LineSegments;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly drops: Drop[];
  private readonly rng: Rng = createRng(1234);

  constructor(count: number) {
    this.positions = new Float32Array(count * 2 * 3);
    this.colors = new Float32Array(count * 2 * 4);
    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage),
    );
    this.mesh = new THREE.LineSegments(
      this.geometry,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.drops = Array.from({ length: count }, () => this.spawn(0, 0, this.rng() * TOP));
  }

  private spawn(cx: number, cz: number, y = TOP): Drop {
    return {
      x: cx + (this.rng() - 0.5) * AREA_X,
      y,
      z: cz + AREA_NEAR - this.rng() * (AREA_NEAR + AREA_FAR),
    };
  }

  /**
   * `windX/windZ`: scene-space wind in units/s (drops are blown along); `rainAt(x, z)` gives
   * 0..1 rain at a scene position.
   */
  update(
    dt: number,
    center: THREE.Vector3,
    windX: number,
    windZ: number,
    rainAt: (x: number, z: number) => number,
    rainPossible = true,
  ) {
    this.mesh.visible = false;
    // Freeze drops while dry. The normal bounds check recentres them on restart, including
    // camera teleports, without an accumulated dry-frame time step or buffer uploads.
    if (!rainPossible) return;
    const slant = 0.06;
    this.drops.forEach((d, i) => {
      d.y -= FALL * dt;
      d.x += windX * dt;
      d.z += windZ * dt;
      const far =
        Math.abs(d.x - center.x) > AREA_X / 2 ||
        d.z - center.z > AREA_NEAR ||
        center.z - d.z > AREA_FAR;
      if (d.y < 0 || far) this.drops[i] = d = this.spawn(center.x, center.z, far ? d.y : TOP);
      // Thin the drops out where it rains lightly: drop i shows once rain passes its share.
      const rain = rainAt(d.x, d.z);
      const show = rain > (i / this.drops.length) * 0.95 + 0.04;
      const a = show ? 0.25 + 0.3 * rain : 0;
      if (a > 0) this.mesh.visible = true;
      this.positions.set(
        [d.x, d.y, d.z, d.x - windX * slant, d.y + FALL * slant * 0.6, d.z - windZ * slant],
        i * 6,
      );
      this.colors.set([0.85, 0.9, 1, a, 0.85, 0.9, 1, 0], i * 8);
    });
    this.geometry.attributes.position!.needsUpdate = true;
    this.geometry.attributes.color!.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
