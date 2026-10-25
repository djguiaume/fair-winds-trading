import * as THREE from 'three';

/** A soft round glow, drawn once into a small canvas texture. */
export function glowTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (g) {
    const r = size / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(255, 226, 160, 1)');
    grad.addColorStop(0.2, 'rgba(255, 176, 80, 0.8)');
    grad.addColorStop(1, 'rgba(255, 160, 60, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}

/**
 * Warm lights at night (decision 0068): lanterns on every harbour and a stern lantern on the
 * boat, so ports and your own ship are easy to find in the dark. One additive point cloud, no
 * real lights, so it costs one draw call on an old tablet.
 */
export class Lanterns {
  readonly points: THREE.Points;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly positions: Float32Array;
  private readonly material: THREE.PointsMaterial;
  private readonly texture = glowTexture();

  /** `spots`: harbour lantern positions in scene space; the last point is the boat's. */
  constructor(spots: readonly THREE.Vector3[]) {
    this.positions = new Float32Array((spots.length + 1) * 3);
    spots.forEach((p, i) => this.positions.set([p.x, p.y, p.z], i * 3));
    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.material = new THREE.PointsMaterial({
      size: 13,
      map: this.texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      fog: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }

  /** `glow` 0..1 (night, a little in storms); `boat` is the stern lantern's scene position. */
  update(glow: number, boat: THREE.Vector3, time: number) {
    this.points.visible = glow > 0.02;
    if (!this.points.visible) return;
    this.material.opacity = Math.min(1, glow) * (0.92 + 0.08 * Math.sin(time * 7.3));
    this.positions.set([boat.x, boat.y, boat.z], this.positions.length - 3);
    this.geometry.attributes.position!.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
