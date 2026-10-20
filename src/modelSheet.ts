/**
 * Model sheet (models.html): the game's own boat and island models side by side, for reviewing
 * the art (decision 0016) and checking triangle and draw-call counts on a real device.
 * ?view=boats shows the sloop at each upgrade level and the cutter; ?view=lines the starter and
 * the swift and hauler lines (decision 0035); ?view=islands the four producer islands at the game
 * camera's angle.
 */
import * as THREE from 'three';
import { type BoatModel, type ShipUpgrades, buildIslands, createBoatModel } from './render/models';
import { Ocean } from './render/ocean';
import { PALETTE } from './render/palette';
import type { MapDef } from './sim/map';
import { DEG } from './sim/math';

const params = new URLSearchParams(location.search);
const view = (['islands', 'lines'] as const).find((v) => v === params.get('view')) ?? 'boats';
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.deepWater);
scene.add(new THREE.HemisphereLight(PALETTE.sky, '#1a4d55', 1.5));
const sun = new THREE.DirectionalLight(PALETTE.sun, 1.7);
sun.position.set(-30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, far: 200 });
scene.add(sun, sun.target);
const camera = new THREE.PerspectiveCamera(view === 'islands' ? 40 : 30, 1, 1, 800);

const boats: BoatModel[] = [];
const labels: Array<{ at: THREE.Vector3; html: string }> = [];
function addBoat(
  id: string,
  upgrades: ShipUpgrades,
  x: number,
  z: number,
  yaw: number,
  html: string,
) {
  const b = createBoatModel(id, { upgrades });
  b.root.position.set(x, 0, z);
  b.root.rotation.y = yaw;
  b.root.traverse((o) => (o.castShadow = true));
  scene.add(b.root);
  boats.push(b);
  labels.push({ at: new THREE.Vector3(x, -2, z + 6), html });
}

let islandsForWater: MapDef['islands'] = [];
const L = (n: 1 | 2 | 3): ShipUpgrades => ({ sails: n, hold: n, hull: n });
if (view === 'boats') {
  document.getElementById('title')!.textContent = 'Boats · style D (Storybook classic)';
  const side = -90 * DEG; // bow to the left of the screen
  addBoat(
    'sloop',
    L(1),
    -44,
    0,
    side,
    'Sloop · stock<small>patched sails · 2 crates · bare hull</small>',
  );
  addBoat(
    'sloop',
    L(2),
    -22,
    0,
    side,
    'Sloop · level 2<small>new canvas + jib · hold · band</small>',
  );
  addBoat(
    'sloop',
    L(3),
    0,
    0,
    side,
    'Sloop · level 3<small>racing sails + topsail · copper</small>',
  );
  addBoat('cutter', L(1), 24, 0, side, 'Cutter · stock<small>two jibs</small>');
  addBoat('cutter', L(3), 50, 0, side, 'Cutter · level 3<small>all upgrades</small>');
  camera.position.set(3, 34, 132);
  camera.lookAt(3, 4, 0);
} else if (view === 'lines') {
  document.getElementById('title')!.textContent = 'Ship lines · swift and hauler (0035)';
  const side = -150 * DEG; // bow toward the camera, so square sails show their face
  addBoat('sloop', L(1), -72, -22, side, 'Sloop<small>starter</small>');
  const rows = [
    { z: -22, ids: ['cutter', 'schooner', 'clipper'], line: 'Swift' },
    { z: 30, ids: ['hoy', 'fluyt', 'indiaman'], line: 'Hauler' },
  ];
  for (const row of rows)
    row.ids.forEach((id, i) =>
      addBoat(
        id,
        L(1),
        -34 + i * 40,
        row.z,
        side,
        `${id[0]!.toUpperCase()}${id.slice(1)}<small>${row.line} · tier ${i + 1}</small>`,
      ),
    );
  camera.position.set(0, 80, 170);
  camera.lookAt(0, 2, 4);
} else {
  document.getElementById('title')!.textContent = 'Islands · B2 (Bright highlands)';
  const map: MapDef = {
    name: 'sheet',
    seed: 7,
    boundsRadius: 200,
    wind: { fromDeg: 0, speedKn: 14, gustiness: 0, shiftDeg: 0 },
    start: { x: 0, y: 0, headingDeg: 0 },
    islands: [
      {
        id: 'a',
        name: 'Saltmere',
        x: -42,
        y: 30,
        radius: 20,
        look: { kind: 'fish', houses: 5, trees: 3, dock: true },
      },
      {
        id: 'b',
        name: 'Port Calda',
        x: 42,
        y: 34,
        radius: 15,
        look: { kind: 'timber', houses: 1, trees: 16, dock: true },
      },
      {
        id: 'c',
        name: 'Westholm',
        x: 44,
        y: -32,
        radius: 16,
        look: { kind: 'grain', houses: 2, trees: 3, dock: true },
      },
      {
        id: 'd',
        name: 'Stonehaven',
        x: -40,
        y: -34,
        radius: 13,
        look: { kind: 'stone', trees: 3, rock: true, dock: true },
      },
    ],
    // Harbours face the middle, where the sloop is.
    ports: [],
    course: [
      { label: 'Saltmere', x: -10, y: 8 },
      { label: 'Port Calda', x: 10, y: 8 },
      { label: 'Westholm', x: 10, y: -8 },
      { label: 'Stonehaven', x: -10, y: -8 },
    ],
  };
  islandsForWater = map.islands;
  scene.add(buildIslands(map, { shadows: true }));
  for (const i of map.islands) {
    labels.push({
      at: new THREE.Vector3(i.x, 2, -i.y - i.radius - 4),
      html: `${i.name}<small>${i.look!.kind}</small>`,
    });
  }
  addBoat('sloop', L(1), 0, 0, 30 * DEG, 'Sloop for scale');
  const pitch = 58 * DEG;
  const dist = 165;
  camera.position.set(0, Math.sin(pitch) * dist, Math.cos(pitch) * dist);
  camera.lookAt(0, 0, 0);
}
scene.traverse((o) => {
  if ((o as THREE.Mesh).isMesh) o.receiveShadow = true;
});

const ocean = new Ocean(islandsForWater, 140, true, 600);
ocean.setFog(400, 700);
scene.add(ocean.mesh);

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const labelsEl = document.getElementById('labels')!;
function drawLabels() {
  labelsEl.innerHTML = '';
  for (const l of labels) {
    const q = l.at.clone().project(camera);
    const d = document.createElement('div');
    d.className = 'label';
    d.style.left = `${((q.x + 1) / 2) * innerWidth}px`;
    d.style.top = `${((1 - q.y) / 2) * innerHeight}px`;
    d.innerHTML = l.html;
    labelsEl.appendChild(d);
  }
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = params.has('still') ? 3 : clock.getElapsedTime();
  for (const b of boats) {
    b.update({ sail: 1, boomAngle: 35 * DEG, luff: 0, heel: -6 * DEG, windRelative: 0.6, time: t });
  }
  ocean.update(t, new THREE.Vector3());
  renderer.info.reset();
  renderer.render(scene, camera);
  const tris = renderer.info.render.triangles;
  document.getElementById('stats')!.textContent =
    `${renderer.info.render.calls} draw calls · ${tris.toLocaleString()} triangles (incl. ocean)`;
  drawLabels();
});
