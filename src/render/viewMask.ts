import * as THREE from 'three';
import type { Surface } from './colorDrift';

/**
 * Which surface each pixel of the view shows (issue #573), for the colour check of
 * `npm run shots -- --both`: the scene drawn once more with one flat colour per surface, read back.
 * A debug tool only; the game never calls it.
 */

/** What the mask needs of the view: its renderer, scene, camera and the roots of each surface. */
export interface MaskedView {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** The roots whose meshes are land (islands, towns, woods). */
  land: THREE.Object3D[];
  /** The roots whose meshes are the sea and its layers. */
  sea: THREE.Object3D[];
  /** The drawn sky's dome: hidden, so the background (counted as sky) shows where it was. */
  sky: THREE.Object3D;
}

/** Class id 0 is "other" (boats, life, effects); the rest as `averageColors` reads them. */
const ID_OF: Record<Surface, number> = { sea: 1, land: 2, sky: 3 };
/** Sea and land past where the fog starts: left out, so both views compare the same distances. */
const HAZED = 4;

/** The surface an object belongs to, from the nearest root above it. */
function surfaceOf(object: THREE.Object3D, roots: Map<THREE.Object3D, Surface>): Surface | null {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) {
    const surface = roots.get(o);
    if (surface) return surface;
  }
  return null;
}

/**
 * Draws the mask at `width` x `height` and returns one class id per pixel, rows from the top. The
 * scene is put back as it was: materials, fog, background and the render target.
 */
export function renderViewMask(view: MaskedView, width: number, height: number): Uint8Array {
  const roots = new Map<THREE.Object3D, Surface>();
  for (const r of view.land) roots.set(r, 'land');
  for (const r of view.sea) roots.set(r, 'sea');
  const flat = new Map<number, THREE.MeshBasicMaterial>();
  const flatFor = (id: number) => {
    let m = flat.get(id);
    if (!m) {
      const fog = id === ID_OF.sea || id === ID_OF.land;
      m = new THREE.MeshBasicMaterial({ color: new THREE.Color(id / 255, 0, 0), fog });
      flat.set(id, m);
    }
    return m;
  };
  const swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
  const hidden: THREE.Object3D[] = [];
  const { scene, renderer, camera } = view;
  scene.traverseVisible((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const mesh = o as THREE.Mesh;
      const surface = surfaceOf(mesh, roots);
      swapped.push([mesh, mesh.material]);
      mesh.material = flatFor(surface ? ID_OF[surface] : 0);
    } else if (
      (o as THREE.Points).isPoints ||
      (o as THREE.Line).isLine ||
      (o as THREE.Sprite).isSprite
    )
      hidden.push(o);
  });
  for (const o of hidden) o.visible = false;
  const { background, fog } = scene;
  const sky = view.sky.visible;
  // Past the fog's far end the background shows: the air, counted with the sky.
  scene.background = new THREE.Color(ID_OF.sky / 255, 0, 0);
  // The sea camera sees almost nothing past the fog's start; the follow cam sees the horizon.
  // A fog as sharp as a step there marks what lies beyond as hazed (issue #573: the same sea
  // colour at the same distance).
  const near = (fog as THREE.Fog | null)?.near ?? camera.far;
  scene.fog = new THREE.Fog(new THREE.Color(HAZED / 255, 0, 0), near, near + 0.01);
  view.sky.visible = false;
  const target = new THREE.WebGLRenderTarget(width, height);
  const before = renderer.getRenderTarget();
  const pixels = new Uint8Array(width * height * 4);
  try {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  } finally {
    renderer.setRenderTarget(before);
    target.dispose();
    for (const [mesh, material] of swapped) mesh.material = material;
    for (const o of hidden) o.visible = true;
    for (const m of flat.values()) m.dispose();
    scene.background = background;
    scene.fog = fog;
    view.sky.visible = sky;
  }
  const ids = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      ids[y * width + x] = pixels[((height - 1 - y) * width + x) * 4]!;
  return ids;
}
