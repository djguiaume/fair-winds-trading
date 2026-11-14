import type * as THREE from 'three';

/** Takes the ground and the trees off a built island model: they have their own render budget. */
export function withoutGround(model: THREE.Object3D): void {
  const apart: THREE.Object3D[] = [];
  model.traverse((o) => {
    if (o.name === 'ground' || o.name === 'forest') apart.push(o);
  });
  for (const o of apart) o.removeFromParent();
}
