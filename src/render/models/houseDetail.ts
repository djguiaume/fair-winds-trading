import * as THREE from 'three';
import { TUNING } from '../../data/tuning';
import { triangleCount } from './geometry';

/**
 * A town's homes in two drawings (issue #500): the rich houses near the camera, today's plain
 * houses beyond `graphics.json › houses.richWithin` and on the levels without `richHouses`.
 * Both are baked in island space: the level object sits at their centre for the distance and the
 * meshes move back by the same amount.
 */
export function houseLod(plain: THREE.Mesh, rich: THREE.Mesh, enabled: boolean): THREE.LOD {
  plain.geometry.computeBoundingSphere();
  const centre = plain.geometry.boundingSphere!.center.clone();
  const { richWithin, hysteresis } = TUNING.graphics.houses;
  const lod = new THREE.LOD();
  lod.name = 'houses';
  lod.position.copy(centre);
  for (const mesh of [rich, plain]) mesh.position.copy(centre).negate();
  // The swap distance counts from the camera to the town's centre, so a wide town adds its radius.
  const reach = richWithin + plain.geometry.boundingSphere!.radius;
  lod.addLevel(rich, 0);
  lod.addLevel(plain, reach, hysteresis);
  setRichHouses(lod, enabled);
  return lod;
}

/** Quality levels without rich houses show the plain ones whatever the distance. */
export function setRichHouses(lod: THREE.LOD, enabled: boolean) {
  lod.autoUpdate = enabled;
  if (enabled) return;
  const [rich, plain] = lod.levels.map((l) => l.object);
  rich!.visible = false;
  plain!.visible = true;
}

/** Is this mesh the plain houses, the far drawing that never shows with the near one? */
export const isFarHouses = (mesh: THREE.Object3D) =>
  mesh.parent instanceof THREE.LOD && mesh.parent.levels.at(-1)!.object === mesh;

/** Triangles of a town model drawn with its near (rich) or its far (plain) homes. */
export function drawnTriangles(root: THREE.Object3D, set: 'near' | 'far') {
  let n = 0;
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || (set === 'near' && isFarHouses(o))) return;
    if (set === 'far' && o.parent instanceof THREE.LOD && !isFarHouses(o)) return;
    n += triangleCount(o.geometry);
  });
  return n;
}
