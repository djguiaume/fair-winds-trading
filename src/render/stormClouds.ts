import * as THREE from 'three';
import type { Storm } from '../sim/storms';

/** Discs drawn at once: the storms nearest the boat (a storm belt's train has several, 0167). */
const MAX_STORMS = 5;

/**
 * The shadow a storm cloud throws on the sea (decision 0067): a dark disc with a soft edge at the
 * storm's position, so a storm can be seen coming before its rain arrives. A storm belt's train of
 * squalls (0167) reads as a row of these marching in. One cheap mesh per storm, no textures.
 */
export class StormClouds {
  readonly root = new THREE.Group();
  private readonly discs: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly picked: Storm[] = [];

  constructor() {
    // Concentric rings so the alpha can stay dark across the core and fade over the outer part.
    const geometry = new THREE.RingGeometry(0.001, 1, 36, 10);
    geometry.rotateX(-Math.PI / 2);
    // Alpha per vertex: dark in the middle, fading to nothing at the rim.
    const pos = geometry.attributes.position!;
    const colors = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      const fade = 1 - Math.min(1, Math.max(0, (r - 0.7) / 0.3));
      colors.set([0.0, 0.02, 0.05, 0.72 * fade * fade * (3 - 2 * fade)], i * 4);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    for (let i = 0; i < MAX_STORMS; i++) {
      // Each storm its own material: their strengths differ.
      const disc = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }),
      );
      disc.renderOrder = 1;
      disc.visible = false;
      this.discs.push(disc);
      this.root.add(disc);
    }
  }

  /** Once a frame: the storms nearest `near` (the boat) when there are more than discs. */
  update(storms: readonly Storm[], time: number, near?: { x: number; y: number }) {
    const list = this.picked;
    list.length = 0;
    for (const s of storms) if (s.intensity > 0.02) list.push(s);
    if (near && list.length > MAX_STORMS) {
      const gap = (s: Storm) => Math.hypot(s.x - near.x, s.y - near.y) - s.radius;
      list.sort((a, b) => gap(a) - gap(b));
    }
    this.discs.forEach((disc, i) => {
      const s = list[i];
      disc.visible = Boolean(s);
      if (!s) return;
      disc.position.set(s.x, 1.2, -s.y);
      disc.scale.setScalar(s.radius * (0.95 + 0.05 * Math.sin(time * 0.3 + i)));
      disc.rotation.y = time * 0.05;
      disc.material.opacity = Math.min(1, s.intensity * 1.2);
    });
  }

  dispose() {
    this.discs[0]?.geometry.dispose();
    for (const disc of this.discs) disc.material.dispose();
  }
}
