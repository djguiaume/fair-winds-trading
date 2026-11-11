import * as THREE from 'three';
import { PROP_RECIPES } from '../../../../../src/data/props';
import { buildProp } from '../../../../../src/render/models/propRecipe';
import { vertexColorMaterial } from '../../../../../src/render/models/geometry';
import a from './fish-house-a.json';
import b from './fish-house-b.json';

const recipes = PROP_RECIPES as Record<string, unknown>;
recipes['fish-house-a'] = { ...a, id: 'fish-house-a' };
recipes['fish-house-b'] = { ...b, id: 'fish-house-b' };

const W = 1280, H = 960;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c') as HTMLCanvasElement, antialias: true });
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const mat = vertexColorMaterial();
const rows = ['fish-house', 'fish-house-a', 'fish-house-b'];
const rowH = H / 3;
renderer.setScissorTest(true);
for (let r = 0; r < 3; r++) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#a6d6ee');
  scene.add(new THREE.HemisphereLight('#cfe8f7', '#5d8a46', 1.4));
  const sun = new THREE.DirectionalLight('#fff3dc', 2.2);
  sun.position.set(4, 6, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 4, bottom: -4 });
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), new THREE.MeshLambertMaterial({ color: '#7cc04f' }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  for (let v = 0; v < 4; v++) {
    for (const g of buildProp(rows[r]!, { R: 18, style: 'fish', variant: v, shape: v / 3, size: 1 })) {
      const m = new THREE.Mesh(g, mat);
      m.castShadow = true;
      m.position.set((v - 1.5) * 1.55, 0, 0);
      m.rotation.y = -0.7 + (v % 2) * 0.35;
      scene.add(m);
    }
  }
  const cam = new THREE.PerspectiveCamera(30, W / rowH, 0.1, 100);
  cam.position.set(0.6, 2.3, 6.0);
  cam.lookAt(0, 1.0, 0);
  const y = H - (r + 1) * rowH;
  renderer.setViewport(0, y, W, rowH);
  renderer.setScissor(0, y, W, rowH);
  renderer.render(scene, cam);
}
(window as unknown as { done: boolean }).done = true;
