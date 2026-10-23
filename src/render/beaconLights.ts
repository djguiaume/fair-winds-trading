import * as THREE from 'three';
import type { IslandDef } from '../sim/map';
import { landmarkLamps } from './landmarkLamps';

export type BeaconStyle = 'steady' | 'white' | 'red';

const COLOR: Record<BeaconStyle, THREE.Color> = {
  steady: new THREE.Color('#ffd48a'),
  white: new THREE.Color('#fff6e0'),
  red: new THREE.Color('#ff5a3c'),
};

/** A soft round glow, drawn once into a small canvas texture. */
function glowTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (g) {
    const r = size / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.55)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}

/**
 * How bright beacon `index` is at `time`: steady, or a group of 1-3 short flashes per period, so
 * neighbouring beacons can be told apart like real marks (Fl, Fl(2), Fl(3)).
 */
export function beaconBrightness(style: BeaconStyle, index: number, time: number) {
  if (style === 'steady') return 1;
  const flashes = (index % 3) + 1,
    period = 2 + flashes * 2,
    t = (time + index * 1.7) % period;
  const k = Math.floor(t);
  return k < flashes && t - k < 0.45 ? 1 : 0;
}

/** Night lights on the beacons of the island files: one additive point cloud, one draw call. */
export class BeaconLights {
  readonly points: THREE.Points;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly colors: Float32Array;
  private readonly material: THREE.PointsMaterial;
  private readonly texture = glowTexture();
  constructor(
    islands: readonly IslandDef[],
    private style: BeaconStyle = 'white',
  ) {
    const lamps = landmarkLamps(islands, 'beacon');
    const positions = new Float32Array(lamps.length * 3);
    lamps.forEach((l, i) => positions.set(l.position.toArray(), i * 3));
    this.colors = new Float32Array(lamps.length * 3);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.material = new THREE.PointsMaterial({
      size: 30,
      map: this.texture,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      fog: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = 'beacon-lights';
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }
  setStyle(style: BeaconStyle) {
    this.style = style;
  }
  /** `glow` 0..1: night, a little in storms. */
  update(time: number, glow: number) {
    this.points.visible = glow > 0.02;
    if (!this.points.visible) return;
    const c = COLOR[this.style],
      n = this.colors.length / 3;
    for (let i = 0; i < n; i++) {
      const b = Math.min(1, glow) * beaconBrightness(this.style, i, time);
      this.colors.set([c.r * b, c.g * b, c.b * b], i * 3);
    }
    this.geometry.attributes.color!.needsUpdate = true;
  }
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
