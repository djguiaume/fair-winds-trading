/**
 * Model sheet (models.html): the game's own boat and island models side by side, for reviewing
 * the art (decision 0016) and checking triangle and draw-call counts on a real device.
 * ?view=boats shows the sloop at each upgrade level and the cutter; ?view=lines the starter and
 * the swift and hauler lines (decision 0035); ?view=islands the four producer islands at the game
 * camera's angle. ?view=sloop&level=3&quality=low inspects one ship class (any ship file in src/data/ships/) with
 * the game's three quality profiles; ?view=compare&level=1..3 every class side by side at true size
 * (decision 0077); ?view=towns&kind=fish shows one port island at the four settlement levels
 * (decision 0060), &kind=all every producer island at &level=1..4, &before=1 the current look; independent hull/hold/sails=1..3, yaw degrees, sail=0..1 and signed boom degrees exercise its attachment pivots.
 */
import * as THREE from 'three';
import { type BoatModel, type ShipUpgrades, buildIslands, createBoatModel } from './render/models';
import { HULL_DIMENSIONS } from './sim/hullShape';
import { isRefinedShip } from './render/models/shipModels';
import { LighthouseBeams } from './render/lighthouseBeams';
import { Atmosphere } from './render/atmosphere';
import { daylightAt } from './sim/daylight';
import { Ocean } from './render/ocean';
import { PALETTE } from './render/palette';
import { QUALITY, renderPixelRatio, type QualityLevel } from './render/quality';
import type { MapDef } from './sim/map';
import { DEG } from './sim/math';

const params = new URLSearchParams(location.search);
const view: string =
  ['islands', 'towns', 'lines', 'compare', ...Object.keys(HULL_DIMENSIONS)].find(
    (v) => v === params.get('view'),
  ) ?? 'boats';
const inspectBoat = view in HULL_DIMENSIONS;
const quality: QualityLevel =
  (['low', 'medium', 'high'] as const).find((q) => q === params.get('quality')) ??
  (params.has('low') ? 'low' : 'high');
const profile = QUALITY[quality];
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !inspectBoat || quality === 'high',
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = !inspectBoat || profile.shadows;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.deepWater);
const skyLight = new THREE.HemisphereLight(PALETTE.sky, '#1a4d55', 1.5);
scene.add(skyLight);
const sun = new THREE.DirectionalLight(PALETTE.sun, 1.7);
sun.position.set(-30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, far: 200 });
scene.add(sun, sun.target);
const camera = new THREE.PerspectiveCamera(
  view === 'islands' || view === 'towns' ? 40 : 30,
  1,
  1,
  800,
);

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
const upgrade = (key: string, fallback: 1 | 2 | 3) =>
  Math.max(1, Math.min(3, Number(params.get(key)) || fallback)) as 1 | 2 | 3;
const L = (n: 1 | 2 | 3): ShipUpgrades => ({ sails: n, hold: n, hull: n });
if (inspectBoat) {
  const level = Math.max(1, Math.min(3, Number(params.get('level')) || 3)) as 1 | 2 | 3;
  const low = quality === 'low';
  document.getElementById('title')!.textContent =
    `${view} · sails ${upgrade('sails', level)} / hold ${upgrade('hold', level)} / hull ${upgrade('hull', level)} · ${quality}`;
  addBoat(
    view,
    { sails: upgrade('sails', level), hold: upgrade('hold', level), hull: upgrade('hull', level) },
    0,
    0,
    (Number(params.get('yaw')) || -90) * DEG,
    'Actual game model<small>hull, hold and sails upgrades preserved</small>',
  );
  boats[0]!.setLowDetail?.(low);
  // Framed by hull length: 5 m sloop at 22 / 38, as the refined captures were taken.
  const k = Math.max(1, HULL_DIMENSIONS[view]!.length / 5) ** 0.85;
  camera.position.set(0, 22 * k, 38 * k);
  camera.lookAt(0, 5 * k, 0);
} else if (view === 'boats') {
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
} else if (view === 'towns') {
  // The real Windward Ring port sizes, so the shelf is judged on the islands it must fit.
  const kinds = {
    fish: { name: 'Saltmere', radius: 24 },
    timber: { name: 'Port Calda', radius: 26 },
    grain: { name: 'Westholm', radius: 24 },
    stone: { name: 'Stonehaven', radius: 23 },
    yard: { name: 'Abbey Head', radius: 18 },
  } as const;
  const LEVEL_NAMES = ['Hamlet', 'Village', 'Town', 'Port town'];
  const kindParam = params.get('kind') ?? 'fish';
  const before = params.has('before');
  const level = Math.max(1, Math.min(4, Number(params.get('level')) || 4)) as 1 | 2 | 3 | 4;
  const entries =
    kindParam === 'all'
      ? (['fish', 'timber', 'grain', 'stone'] as const).map((k) => ({ kind: k, level }))
      : ([1, 2, 3, 4] as const).map((l) => ({ kind: kindParam as keyof typeof kinds, level: l }));
  const map: MapDef = {
    name: 'towns',
    seed: 7,
    boundsRadius: 300,
    wind: { fromDeg: 0, speedKn: 14, gustiness: 0, shiftDeg: 0 },
    start: { x: 0, y: 0, headingDeg: 0 },
    islands: entries.map((e, i) => ({
      id: `i${i}`,
      name: kinds[e.kind].name,
      x: (i - 1.5) * 64,
      y: 0,
      radius: kinds[e.kind].radius,
      look: {
        kind: e.kind,
        ...(e.kind !== 'yard' && !before ? { profile: e.kind, harbourBearing: Math.PI } : {}),
        houses: 5,
        trees: e.kind === 'timber' ? 14 : 4,
        dock: true,
        ...(e.kind === 'yard' ? { landmark: 'ruins' as const, rock: true } : {}),
      },
    })),
    ports: entries.map((e, i) => ({
      id: `p${i}`,
      name: kinds[e.kind].name,
      islandId: `i${i}`,
      produces: [],
      wants: [],
    })),
    // Every harbour faces the camera.
    course: entries.map((e, i) => ({ label: kinds[e.kind].name, x: (i - 1.5) * 64, y: -40 })),
  };
  const levels = Object.fromEntries(entries.map((e, i) => [`p${i}`, e.level]));
  document.getElementById('title')!.textContent = before
    ? 'Port islands today · fixed houses'
    : kindParam === 'all'
      ? `Settlement level ${level} · ${LEVEL_NAMES[level - 1]} (0060)`
      : `${kinds[kindParam as keyof typeof kinds].name} · settlement levels 1–4 (0060)`;
  islandsForWater = params.has('focus')
    ? map.islands.filter((_, i) => i === Number(params.get('focus')) - 1)
    : map.islands;
  // One island per build, so each copy gets the same seed and only its level differs.
  map.islands.forEach((island, i) => {
    if (params.has('focus') && i !== Number(params.get('focus')) - 1) return;
    scene.add(
      buildIslands(
        { ...map, islands: [island], ports: [map.ports[i]!], course: [map.course[i]!] },
        { shadows: true, levels: before ? undefined : levels },
      ),
    );
  });
  entries.forEach((e, i) =>
    labels.push({
      at: new THREE.Vector3((i - 1.5) * 64, 0, 34),
      html: before
        ? `${kinds[e.kind].name}<small>today</small>`
        : `${LEVEL_NAMES[e.level - 1]}<small>${kinds[e.kind].name} · level ${e.level}</small>`,
    }),
  );
  if (!params.has('focus')) {
    addBoat('sloop', L(1), -64 * 1.5 + 18, 28, 60 * DEG, '');
    labels.pop();
  }
  // &focus=1..4 frames one island at the game camera's pitch and default distance.
  const focus = Number(params.get('focus'));
  const fx = focus >= 1 && focus <= 4 ? (focus - 2.5) * 64 : 0;
  const pitch = (focus ? 58 : 50) * DEG;
  const dist = focus ? 150 : 245;
  if (focus) labels.length = 0;
  camera.position.set(fx, Math.sin(pitch) * dist, 8 + Math.cos(pitch) * dist);
  camera.lookAt(fx, 0, focus ? 8 : 4);
} else if (view === 'compare') {
  // Every playable hull side by side at true relative size and one upgrade level (&level=1..3),
  // tagged with whether it already has its own refined model (decision 0077). A long, narrow
  // lens keeps the row close to orthographic so sizes compare fairly.
  const level = Math.max(1, Math.min(3, Number(params.get('level')) || 1)) as 1 | 2 | 3;
  document.getElementById('title')!.textContent =
    `Ship models · ${level === 1 ? 'stock' : `all upgrades at level ${level}`}`;
  const ids = Object.keys(HULL_DIMENSIONS);
  const gap = 6;
  const width = ids.reduce((w, id) => w + HULL_DIMENSIONS[id]!.length * 2.2 + gap, -gap);
  let x = -width / 2;
  for (const id of ids) {
    const len = HULL_DIMENSIONS[id]!.length * 2.2;
    const status = isRefinedShip(id) ? 'refined' : 'old model · to redesign';
    const name = `${id[0]!.toUpperCase()}${id.slice(1)}`;
    addBoat(id, L(level), x + len / 2, 0, -90 * DEG, `${name}<small>${status}</small>`);
    x += len + gap;
  }
  camera.fov = 13;
  camera.position.set(0, 70, 380);
  camera.lookAt(0, 9, 0);
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
  if ((o as THREE.Mesh).isMesh && !inspectBoat) o.receiveShadow = true;
});

const ocean = new Ocean(
  islandsForWater,
  inspectBoat ? profile.oceanSegments : 140,
  inspectBoat ? profile.fancyWater : true,
  600,
);
ocean.setFog(400, 700);
scene.add(ocean.mesh);
const lighthouseBeams = new LighthouseBeams(islandsForWater);
scene.add(lighthouseBeams.root);
// Reuse the game's moonlight and window rendering for repeatable night reviews.
if (params.has('night')) {
  scene.fog = new THREE.Fog(PALETTE.deepWater, 400, 700);
  const target = new THREE.Vector3(
    params.has('focus') ? (Number(params.get('focus')) - 2.5) * 64 : 0,
    0,
    8,
  );
  new Atmosphere(scene, sun, skyLight).update(
    1,
    daylightAt(570),
    { kind: 'breeze', rain: 0, showers: 0, gloom: 0, storm: 0, storms: [] },
    ocean,
    target,
  );
  scene.traverse((o) => {
    const windows = o.userData.windows as THREE.MeshBasicMaterial | undefined;
    windows?.color.set('#ffffff');
  });
}

for (const boat of boats) boat.setNightLighting?.(params.has('night') ? 1 : 0);

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  if (inspectBoat) renderer.setPixelRatio(renderPixelRatio(w, h, devicePixelRatio, profile));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  if (view === 'towns' && params.has('focus')) {
    const focus = Number(params.get('focus'));
    const x = (focus - 2.5) * 64 + (params.get('kind') === 'fish' ? 8 : 0);
    const dist =
      150 * Math.max(1, 1.1 / camera.aspect) * (params.get('kind') === 'timber' ? 1.22 : 1);
    const pitch = 58 * DEG;
    camera.position.set(x, Math.sin(pitch) * dist, 8 + Math.cos(pitch) * dist);
    camera.lookAt(x, 0, 8);
  }
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
  const sail =
    inspectBoat && params.has('sail') ? Math.max(0, Math.min(1, Number(params.get('sail')))) : 1;
  const boom = inspectBoat && params.has('boom') ? Number(params.get('boom')) * DEG : 35 * DEG;
  const trueAngle = (45 + Math.max(0, Math.min(1, (Math.abs(boom) / DEG - 12) / 68)) * 135) * DEG;
  const windRelative = params.has('wind')
    ? Number(params.get('wind')) * DEG
    : (boom < 0 ? -1 : 1) * (Math.PI - trueAngle);
  for (const b of boats) {
    b.update({ sail, boomAngle: boom, luff: 0, heel: -6 * DEG, windRelative, time: t });
  }
  lighthouseBeams.update(params.has('still') ? 3 : t, params.has('night') ? 1 : 0);
  ocean.update(t, new THREE.Vector3());
  renderer.info.reset();
  renderer.render(scene, camera);
  const tris = renderer.info.render.triangles;
  document.getElementById('stats')!.textContent =
    `${renderer.info.render.calls} draw calls · ${tris.toLocaleString()} triangles (incl. ocean)`;
  drawLabels();
});
