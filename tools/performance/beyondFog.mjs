/* global window */
/**
 * Page script (issue #558): what the camera draws that the fog hides. Walks the scene for meshes
 * that pass the frustum yet lie wholly past the fog's far distance, and counts them with their
 * triangles. The camera's far plane follows the fog, so this should stay at the few meshes that
 * are never culled (sky, sea); a number that grows says culling by distance is needed.
 */
export function measureBeyondFog() {
  const { view } = window.fwt;
  const { scene, camera } = view;
  const fogFar = scene.fog.far;
  camera.updateMatrixWorld();
  const eye = camera.position;
  const out = { fogFar, meshes: 0, triangles: 0 };
  scene.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    for (let o = object; o; o = o.parent) if (!o.visible) return;
    const geometry = object.geometry;
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    const sphere = object.boundingSphere ?? geometry.boundingSphere;
    if (!sphere) return;
    const scale = object.matrixWorld.getMaxScaleOnAxis();
    const centre = sphere.center.clone().applyMatrix4(object.matrixWorld);
    if (centre.distanceTo(eye) - sphere.radius * scale <= fogFar) return;
    // Past the fog and still drawn: only a mesh the frustum never culls can be.
    if (object.frustumCulled) return;
    const triangles = (geometry.index ?? geometry.attributes.position).count / 3;
    out.meshes += 1;
    out.triangles += triangles * (object.count ?? 1);
  });
  return out;
}
