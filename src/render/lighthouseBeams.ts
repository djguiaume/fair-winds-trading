import * as THREE from 'three';
import type { IslandDef } from '../sim/map';
import { islandPoint } from '../sim/islandLayout';

/** Two opposing lighthouse beams, sharing one translucent unlit material. */
export class LighthouseBeams {
  readonly root = new THREE.Group();
  private readonly material = new THREE.MeshBasicMaterial({
    color: '#fff1c4',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  private readonly geometry = new THREE.ConeGeometry(7, 70, 12, 1, true)
    .rotateZ(Math.PI / 2)
    .translate(35, 0, 0);
  constructor(islands: readonly IslandDef[]) {
    this.root.name = 'lighthouse-beams';
    for (const island of islands.filter((i) => i.look?.profile === 'fish')) {
      const p = islandPoint(island, 1.95, -0.65),
        beacon = new THREE.Group();
      beacon.position.set(p.x, 0.12 * island.radius + 4.8 * 0.8 * 2.2, -p.y);
      for (const angle of [0, Math.PI]) {
        const beam = new THREE.Mesh(this.geometry, this.material);
        beam.rotation.y = angle;
        beacon.add(beam);
      }
      this.root.add(beacon);
    }
    this.update(0, 0);
  }
  update(time: number, night: number) {
    this.root.visible = night > 0.05;
    this.material.opacity = 0.12 * night;
    for (const beacon of this.root.children) beacon.rotation.y = time * 0.22;
  }
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
