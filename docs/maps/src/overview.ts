// Top-down review render of a map with the real game models and ocean shader.
// With `npm run dev`, open /docs/maps/src/overview.html (?map=phase0 for the practice map);
// the page title turns to "done" once drawn, for screenshot scripts.
import * as THREE from 'three';
import { PHASE0_MAP, PHASE1_MAP } from '../../../src/data/maps';
import { buildHighlandIslands } from '../../../src/render/models/highlandIslands';
import { Ocean } from '../../../src/render/ocean';
import { PALETTE } from '../../../src/render/palette';

const map = new URLSearchParams(location.search).get('map') === 'phase0' ? PHASE0_MAP : PHASE1_MAP;
const size = Math.min(innerWidth, innerHeight);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(size, size);
document.body.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#123c47');
scene.add(new THREE.HemisphereLight(PALETTE.sky, '#1a4d55', 1.5));
const sun = new THREE.DirectionalLight(PALETTE.sun, 1.7);
sun.position.set(-30, 50, 20);
scene.add(sun);

const R = map.boundsRadius;
const ocean = new Ocean(map.islands, 220, true, R * 2, map.terrain);
ocean.setFog(1e4, 2e4);
ocean.update(0, new THREE.Vector3());
scene.add(ocean.mesh);
scene.add(buildHighlandIslands(map, { shadows: false }));
// Dark outside the playable disc.
const edge = new THREE.Mesh(
  new THREE.RingGeometry(R, R * 1.5, 128).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: '#123c47' }),
);
edge.position.y = 3;
scene.add(edge);

const camera = new THREE.OrthographicCamera(-R, R, R, -R, 1, 1000);
camera.position.set(0, 400, 0);
camera.up.set(0, 0, -1); // north (-z) at the top
camera.lookAt(0, 0, 0);
renderer.render(scene, camera);
document.title = 'done';
