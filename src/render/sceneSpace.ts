import * as THREE from 'three';

/** Sim (x east, y north) → three.js scene (x, 0, -y). */
export function toScene(x: number, y: number, out = new THREE.Vector3()) {
  return out.set(x, 0, -y);
}
