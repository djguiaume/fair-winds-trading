import * as THREE from 'three';
import { TUNING } from '../../data/tuning';

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

/** Parts drawn near the camera: the plain houses are only the far drawing of the rich ones. */
export const nearParts = (parts: THREE.BufferGeometry[]) =>
  parts.filter((g) => g.userData.house !== 'plain');

/** Is this mesh the plain houses, the far drawing that never shows with the near one? */
export const isFarHouses = (mesh: THREE.Object3D) =>
  mesh.parent instanceof THREE.LOD && mesh.parent.levels.at(-1)!.object === mesh;
