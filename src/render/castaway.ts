import * as THREE from 'three';
import type { MapDef } from '../sim/map';
import { landmarkSpot } from '../sim/landmarks';

/**
 * Harbourmaster Rook on the prologue's wreck (decision 0127): a small low-poly figure in a navy
 * coat, waving, shown until he is aboard. Eight triangles' worth of shapes, one material each.
 */
export class Castaway {
  readonly root = new THREE.Group();
  private readonly arm: THREE.Mesh;

  constructor(map: MapDef) {
    const coat = new THREE.MeshLambertMaterial({ color: '#2b3f66', flatShading: true });
    const skin = new THREE.MeshLambertMaterial({ color: '#e2b48c', flatShading: true });
    const cap = new THREE.MeshLambertMaterial({ color: '#d9d4c7', flatShading: true });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.2, 6), coat);
    body.position.y = 0.6;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), skin);
    head.position.y = 1.45;
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.16, 6), cap);
    hat.position.y = 1.68;
    const armGeometry = new THREE.BoxGeometry(0.16, 0.8, 0.16).translate(0, 0.4, 0);
    this.arm = new THREE.Mesh(armGeometry, coat);
    this.arm.position.set(0.34, 1.1, 0);
    this.root.add(body, head, hat, this.arm);
    const spot = map.prologue ? landmarkSpot(map, map.prologue.wreck) : null;
    // On the wreck's deck, which stands about a unit above the water on a reef.
    if (spot) this.root.position.set(spot.x, 1.1, -spot.y);
    this.root.visible = false;
  }

  /** Shown while someone is waiting on the wreck; the arm waves. */
  update(visible: boolean, time: number) {
    this.root.visible = visible;
    if (visible) this.arm.rotation.z = -0.5 - 0.45 * Math.sin(time * 5);
  }
}
