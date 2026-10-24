import * as THREE from 'three';
import { mergeAll, vertexColorMaterial } from '../../../../src/render/models/geometry';
import { PROP_TYPES } from '../../../../src/render/models/props';
import { buildRecipe, type Recipe } from './recipe';
import palette from './palette.json';
import fish from './props/fish-house.json';
import loft from './props/net-loft.json';
import fishRaw from './props/fish-house.json?raw';

const W = 420, H = 380;
function view(parts: THREE.BufferGeometry[][], canvas: HTMLCanvasElement, gap = 1.5, dist = 1) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  r.setSize(W, H);
  r.setClearColor('#bfe3ef');
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#8a7a5a', 2.2));
  const sun = new THREE.DirectionalLight('#fff4dc', 2.2);
  sun.position.set(3, 6, 4);
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(3.4, 24).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#8fcc5a' }));
  scene.add(ground);
  parts.forEach((p, i) => {
    const m = new THREE.Mesh(mergeAll(p), vertexColorMaterial());
    m.position.x = (i - (parts.length - 1) / 2) * gap;
    scene.add(m);
  });
  const cam = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);
  cam.position.set(3.2 * dist, 3.6 * dist, 6.4 * dist);
  cam.lookAt(0, 0.9, 0);
  r.render(scene, cam);
}
const args = (variant: number, shape: number) => ({ R: 20, style: 'fish' as const, variant, shape, size: 1 });
const sets = [[0, 0.2], [1, 0.9], [2, 0.5]] as const;
view(sets.map(([v, s]) => PROP_TYPES['fish-house']!.build(args(v, s))), document.getElementById('a') as HTMLCanvasElement);
view(sets.map(([v, s]) => buildRecipe(fish as unknown as Recipe, palette, args(v, s))), document.getElementById('b') as HTMLCanvasElement);
view(sets.map(([v, s]) => buildRecipe(loft as unknown as Recipe, palette, args(v, s))), document.getElementById('c') as HTMLCanvasElement, 1.6, 1.15);
(document.getElementById('json') as HTMLElement).textContent = 'src/data/props/fish-house.json\n\n' + fishRaw;
document.body.dataset.done = '1';
