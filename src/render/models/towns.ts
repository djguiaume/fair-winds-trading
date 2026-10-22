import * as THREE from 'three';
import type { LandmarkKind } from '../../sim/map';
import { type Rng, createRng, range } from '../../sim/rng';
import { blobShape, glowing, paint, paintGroups, slab, windowPanes } from './geometry';
import { insetOutline } from '../../sim/coast';
import { landmarkParts } from './landmarks';
import {
  islandLayout,
  layoutGround,
  characterPiers,
  fishingMoorings,
  type IslandTheme,
  type Outline,
} from '../../sim/islandLayout';

/**
 * Settlement growth (decision 0060): a port island's town grows in four steps, hamlet, village,
 * town and port town. Each kind of port has its own island profile, buildings, layout and
 * industry, so Saltmere, Port Calda, Westholm and Stonehaven grow differently. The beach (the
 * collision outline) and the pier line stay where the simulation has them.
 * Every placement is seeded per island and filled in a fixed order, so a level-up only adds.
 */
export type TownLevel = 1 | 2 | 3 | 4;

type Parts = THREE.BufferGeometry[];
type Kind = 'fish' | 'timber' | 'grain' | 'stone' | 'yard';
type Spot = { x: number; y: number; z: number };

const C = {
  sand: '#f2d9a0',
  grass: '#7cc04f',
  meadow: '#8fcc5a',
  rock: '#c2ad8c',
  rock2: '#d6c4a4',
  cut: '#ece3d2',
  wood: '#9b6b3d',
  post: '#6b4a2a',
  plank: '#b08a5a',
  stone: '#d9cbb0',
  stoneDark: '#b49e7c',
  chimney: '#8a8174',
  trunk: '#5a3d24',
  pine: ['#2f7a45', '#3a8a4c', '#2a6e3e'],
  leaves: ['#4aa04f', '#5cae4a', '#3f8f45'],
  crops: ['#e8c547', '#c9d65a', '#e2b53e', '#a6c64a', '#d9a63a'],
  furrow: '#8f7a30',
  hay: '#e2c160',
  lamp: '#ffe3a0',
  flag: '#c8603e',
  sail: '#f4ead2',
};

/** Walls and roofs per port kind: the fishing town, the timber town, the farm and the quarry. */
const STYLE: Record<Kind, { walls: string[]; roofs: string[] }> = {
  fish: {
    walls: ['#f8f3ea', '#e2ecf0', '#f4e0c4', '#f0d6cf'],
    roofs: ['#3f74a8', '#c8603e', '#2f5f8a', '#d98a4a'],
  },
  timber: { walls: ['#9a6a3c', '#8a5a32', '#a87a4a'], roofs: ['#4f6b3a', '#5a3d24', '#6e7f45'] },
  grain: { walls: ['#f8f3ea', '#f1e4c8', '#ece2cf'], roofs: ['#d9b45a', '#c9a24a', '#e0bf66'] },
  stone: { walls: ['#d6cdbd', '#c9bfae', '#e0d8c8'], roofs: ['#5f6f7d', '#6f7f8d', '#4f5f6d'] },
  yard: { walls: ['#f4ede0', '#ece2cf', '#f8f3ea'], roofs: ['#c8603e', '#3f74a8', '#8a4a2a'] },
};

// ---------------------------------------------------------------- geometry helpers

const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: string) =>
  paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);

const cyl = (
  rt: number,
  rb: number,
  h: number,
  x: number,
  y: number,
  z: number,
  c: string,
  n = 6,
) => paint(new THREE.CylinderGeometry(rt, rb, h, n).translate(x, y, z), c);

/** Gable roof: a triangular prism with its ridge along X, eaves at height y. */
function gable(w: number, d: number, h: number, y: number, c: string) {
  const s = new THREE.Shape([
    new THREE.Vector2(-d / 2, 0),
    new THREE.Vector2(d / 2, 0),
    new THREE.Vector2(0, h),
  ]);
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  g.rotateY(Math.PI / 2).translate(-w / 2, y, 0);
  return paint(g, c);
}

/** Hipped (pyramid) roof. */
function hip(w: number, d: number, h: number, y: number, c: string) {
  const g = new THREE.CylinderGeometry(0, 0.72, h, 4, 1).rotateY(Math.PI / 4);
  g.scale(w / 1.02, 1, d / 1.02);
  return paint(g.translate(0, y + h / 2, 0), c);
}

/** Moves parts to (x, y, z), turned by rotY and scaled. */
function put(out: Parts, parts: Parts, x: number, y: number, z: number, rotY = 0, s = 1) {
  for (const g of parts) out.push(g.scale(s, s, s).rotateY(rotY).translate(x, y, z));
}

// ---------------------------------------------------------------- buildings

/** Tall narrow harbour house with a steep gable. */
function fishHouse(i: number, rng: Rng): Parts {
  const { walls, roofs } = STYLE.fish;
  const h = range(rng, 1.1, 1.6);
  return [
    box(0.8, h, 0.95, 0, h / 2, 0, walls[i % 4]!),
    gable(0.9, 1.1, 0.7, h, roofs[(i * 3) % 4]!),
    box(0.16, 0.45, 0.16, 0.25, h + 0.5, 0.15, C.chimney),
    box(0.3, 0.45, 0.04, 0, 0.23, 0.49, C.post),
    ...windowPanes(0.8, 0.95, h * 0.72, 2, 1, i),
  ];
}

/** Low log cabin with a mossy or shingle gable and a stone chimney. */
function cabin(i: number, rng: Rng): Parts {
  const { walls, roofs } = STYLE.timber;
  const w = range(rng, 1.2, 1.6);
  return [
    box(w, 0.7, 0.95, 0, 0.35, 0, walls[i % 3]!),
    gable(w + 0.2, 1.2, 0.45, 0.7, roofs[i % 3]!),
    box(0.25, 1.2, 0.25, w / 2 - 0.1, 0.6, -0.2, C.chimney),
    ...windowPanes(w, 0.95, 0.4, 2, 0, i),
  ];
}

/** Long farmhouse under a thatched hip roof. */
function farmhouse(i: number): Parts {
  const { walls, roofs } = STYLE.grain;
  return [
    box(1.6, 0.75, 0.85, 0, 0.375, 0, walls[i % 3]!),
    hip(1.85, 1.1, 0.75, 0.75, roofs[i % 3]!),
    ...windowPanes(1.6, 0.85, 0.42, 3, 1, i),
  ];
}

function barn(): Parts {
  return [
    box(1.6, 1.0, 1.1, 0, 0.5, 0, '#a8432f'),
    gable(1.75, 1.3, 0.8, 1.0, '#6b3a2a'),
    box(0.6, 0.7, 0.04, 0, 0.35, 0.56, '#f4ead2'),
  ];
}

/** Grey stone house under slate; every third one has a little tower. */
function stoneHouse(i: number): Parts {
  const { walls, roofs } = STYLE.stone;
  const parts = [
    box(1.0, 0.9, 0.9, 0, 0.45, 0, walls[i % 3]!),
    hip(1.15, 1.05, 0.6, 0.9, roofs[i % 3]!),
    ...windowPanes(1.0, 0.9, 0.5, 2, 1, i),
  ];
  if (i % 3 === 2) {
    parts.push(box(0.45, 1.7, 0.45, 0.4, 0.85, 0.3, walls[(i + 1) % 3]!));
    parts.push(...windowPanes(0.45, 0.45, 1.4, 1, 0, i + 1, 0.4, 0.3));
  }
  return parts;
}

function yardHouse(i: number): Parts {
  const { walls, roofs } = STYLE.yard;
  return [
    box(1.1, 0.85, 0.9, 0, 0.42, 0, walls[i % 3]!),
    gable(1.25, 1.05, 0.55, 0.85, roofs[i % 3]!),
    ...windowPanes(1.1, 0.9, 0.48, 2, 1, i),
  ];
}

function pine(rng: Rng): Parts {
  const s = range(rng, 0.8, 1.3);
  const parts = [cyl(0.08 * s, 0.12 * s, 0.5 * s, 0, 0.25 * s, 0, C.trunk, 5)];
  for (let i = 0; i < 3; i++)
    parts.push(cyl(0, (0.62 - i * 0.15) * s, 0.9 * s, 0, (0.7 + i * 0.42) * s, 0, C.pine[i]!, 6));
  return parts;
}

function broadleaf(rng: Rng): Parts {
  const s = range(rng, 0.8, 1.2);
  const crown = new THREE.IcosahedronGeometry(0.6 * s, 0).translate(0, 1.0 * s, 0);
  return [
    cyl(0.08 * s, 0.11 * s, 0.7 * s, 0, 0.35 * s, 0, C.trunk, 5),
    paint(crown, C.leaves[Math.floor(rng() * 3)]!),
  ];
}

function windmill(): Parts {
  const parts = [
    cyl(0.42, 0.62, 2.2, 0, 1.1, 0, '#fff3dc', 8),
    cyl(0, 0.58, 0.7, 0, 2.55, 0, '#8a4a2a', 8),
  ];
  for (let k = 0; k < 4; k++) {
    const blade = new THREE.BoxGeometry(0.25, 1.8, 0.05).translate(0, 0.9, 0);
    parts.push(paint(blade.rotateZ((k * Math.PI) / 2 + 0.4).translate(0, 2.2, 0.55), C.sail));
  }
  return parts;
}

function rack(): Parts {
  return [
    box(1.3, 0.06, 0.06, 0, 0.9, 0, C.post),
    box(0.06, 0.9, 0.06, -0.6, 0.45, 0, C.post),
    box(0.06, 0.9, 0.06, 0.6, 0.45, 0, C.post),
    box(1.2, 0.45, 0.05, 0, 0.62, 0, '#c9b48a'),
  ];
}

function smokehouse(): Parts {
  return [
    box(1.0, 0.9, 0.8, 0, 0.45, 0, '#5a4636'),
    gable(1.1, 0.95, 0.5, 0.9, '#3d2f25'),
    box(0.3, 0.6, 0.3, 0, 1.4, 0, C.chimney),
  ];
}

/** Open-sided fish market hall on posts. */
function marketHall(): Parts {
  const parts = [
    box(2.4, 0.08, 1.4, 0, 0.04, 0, C.stone),
    gable(2.7, 1.7, 0.8, 1.1, STYLE.fish.roofs[0]!),
  ];
  for (const x of [-1.1, 0, 1.1])
    for (const z of [-0.6, 0.6]) parts.push(box(0.12, 1.1, 0.12, x, 0.55, z, C.post));
  return parts;
}

/** A small fishing boat at its mooring, mast up. */
function fishingBoat(): Parts {
  const hull = new THREE.CylinderGeometry(0.5, 0.35, 2.0, 6, 1).rotateX(Math.PI / 2);
  hull.scale(1, 0.5, 1).translate(0, 0.1, 0);
  return [
    paint(hull, '#3f74a8'),
    box(0.6, 0.06, 1.5, 0, 0.32, 0, C.plank),
    cyl(0.04, 0.05, 1.8, 0, 1.2, -0.2, C.post, 4),
  ];
}

function logPile(): Parts {
  const parts: Parts = [];
  const rows = [
    [-0.35, 0],
    [0, 0],
    [0.35, 0],
    [-0.17, 1],
    [0.17, 1],
    [0, 2],
  ] as const;
  for (const [z, layer] of rows) {
    const log = new THREE.CylinderGeometry(0.17, 0.17, 1.6, 6).rotateZ(Math.PI / 2);
    parts.push(paint(log.translate(0, 0.17 + layer * 0.29, z), '#a8703c'));
  }
  return parts;
}

function sawmill(): Parts {
  const wheel = new THREE.CylinderGeometry(0.6, 0.6, 0.15, 10).rotateZ(Math.PI / 2);
  return [
    box(1.8, 1.0, 1.1, 0, 0.5, 0, '#8a5a32'),
    gable(2.0, 1.3, 0.6, 1.0, '#5a3d24'),
    paint(wheel.translate(1.0, 0.55, 0), C.wood),
  ];
}

function lumber(): Parts {
  const parts: Parts = [];
  for (let i = 0; i < 4; i++)
    parts.push(box(1.4, 0.12, 0.7, 0, 0.06 + i * 0.13, 0, i % 2 ? '#d2a86a' : '#c49658'));
  return parts;
}

/** A ship on the stocks: keel and ribs, then a planked hull. */
function slip(planked: boolean): Parts {
  const parts = [box(0.8, 0.1, 4.2, 0, 0.05, 0, C.wood)];
  if (planked) {
    const hull = new THREE.CylinderGeometry(1.0, 0.5, 3.8, 8, 1, false, Math.PI / 2, Math.PI);
    parts.push(
      paint(
        hull
          .rotateX(Math.PI / 2)
          .rotateZ(Math.PI)
          .translate(0, 1.05, 0),
        '#8a5a32',
      ),
    );
  } else {
    for (let i = 0; i < 7; i++) {
      const z = -1.6 + i * 0.53;
      const w = 0.5 + Math.sin((i / 6) * Math.PI) * 0.5;
      parts.push(box(0.08, 0.9, 0.08, -w, 0.55, z, C.plank));
      parts.push(box(0.08, 0.9, 0.08, w, 0.55, z, C.plank));
    }
  }
  return parts;
}

/** Dense woods use open triangular trunks and two conifer tiers to stay in budget. */
function woodlandTree(kind: IslandTheme, rng: Rng): Parts {
  const s = range(rng, 0.8, 1.3);
  const trunk = paint(
    new THREE.CylinderGeometry(0.07 * s, 0.1 * s, 0.7 * s, 3, 1, true).translate(0, 0.35 * s, 0),
    C.trunk,
  );
  if (kind === 'timber' || kind === 'stone')
    return [
      trunk,
      paint(
        new THREE.ConeGeometry(0.62 * s, 1.15 * s, 5, 1, true).translate(0, 0.95 * s, 0),
        C.pine[0]!,
      ),
      paint(
        new THREE.ConeGeometry(0.4 * s, 1.0 * s, 5, 1, true).translate(0, 1.55 * s, 0),
        C.pine[1]!,
      ),
    ];
  return [
    trunk,
    paint(
      new THREE.IcosahedronGeometry(0.65 * s, 0).translate(0, s, 0),
      C.leaves[Math.floor(rng() * 3)]!,
    ),
  ];
}

/** Open timber workshops with readable machinery and stacked planks. */
function timberWorkshop(store: boolean): Parts {
  const parts = [gable(3.5, 2.3, 0.7, 1.9, store ? '#6e7f45' : '#a65c35')];
  for (const x of [-1.5, 1.5])
    for (const z of [-0.9, 0.9]) parts.push(box(0.16, 1.9, 0.16, x, 0.95, z, C.post));
  if (store) {
    put(parts, lumber(), -0.7, 0, 0, 0, 1.4);
    put(parts, lumber(), 0.8, 0, 0.2, 0, 1.2);
  } else {
    parts.push(
      box(2.8, 0.65, 0.8, 0, 0.325, 0, C.wood),
      box(0.15, 2.2, 0.15, 0.5, 1.1, 0, '#b3c6cf'),
    );
    const log = new THREE.CylinderGeometry(0.22, 0.22, 3.1, 6)
      .rotateZ(Math.PI / 2)
      .translate(0, 0.88, 0);
    parts.push(paint(log, '#c0905c'));
  }
  parts[0]!.userData.timberWorkshop = store ? 'lumber-store' : 'cutting-shed';
  return parts;
}

function workingSawmill(): Parts {
  const parts = sawmill()
    .slice(0, 2)
    .map((g) => g.rotateY(-Math.PI / 2));
  parts.push(
    paint(
      new THREE.CylinderGeometry(0.82, 0.82, 0.18, 12)
        .rotateX(Math.PI / 2)
        .translate(0, 0.85, 1.12),
      C.post,
    ),
  );
  for (let spoke = 0; spoke < 8; spoke++)
    parts.push(
      paint(
        new THREE.BoxGeometry(0.09, 1.5, 0.08)
          .rotateZ((spoke * Math.PI) / 4)
          .translate(0, 0.85, 1.24),
        C.plank,
      ),
    );
  parts.push(paint(new THREE.TorusGeometry(0.76, 0.08, 4, 12).translate(0, 0.85, 1.25), C.plank));
  return parts;
}

/** Open, curved hull and slipway: its silhouette must read as a ship from offshore. */
function workingSlip(planked: boolean): Parts {
  const parts = slip(false);
  parts.push(box(2.8, 0.12, 5.0, 0, -0.05, 0, C.plank));
  if (planked) {
    const vertices: number[] = [];
    const point = (section: number, arc: number) => {
      const t = section / 8,
        a = -Math.PI / 2 + (arc / 6) * Math.PI;
      const width = 0.12 + Math.pow(Math.sin(t * Math.PI), 0.65) * 1.05;
      return [Math.sin(a) * width, 1.25 - Math.cos(a) * width, -2.3 + t * 4.6];
    };
    for (let section = 0; section < 8; section++)
      for (let arc = 0; arc < 6; arc++) {
        const a = point(section, arc),
          b = point(section + 1, arc),
          c = point(section + 1, arc + 1),
          d = point(section, arc + 1);
        vertices.push(...a, ...b, ...c, ...a, ...c, ...d, ...c, ...b, ...a, ...d, ...c, ...a);
      }
    const hull = new THREE.BufferGeometry();
    hull.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    hull.computeVertexNormals();
    parts.push(paint(hull, '#b77c43'));
  }
  return parts;
}

/** Bakery: a whitewashed house with a big domed bread oven and chimney. */
function bakery(): Parts {
  const oven = new THREE.SphereGeometry(0.5, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  return [
    box(1.3, 0.85, 0.9, 0, 0.42, 0, '#f8f3ea'),
    gable(1.45, 1.1, 0.6, 0.85, '#c8603e'),
    paint(oven.translate(0.95, 0, 0), '#c9a27a'),
    box(0.3, 1.0, 0.3, -0.4, 1.3, -0.15, C.chimney),
    ...windowPanes(1.3, 0.9, 0.48, 2, 0, 3),
  ];
}

/** Masons' yard: an open work shed over a banker stone, with dressed blocks. */
function masons(): Parts {
  const parts = [
    gable(1.8, 1.3, 0.55, 1.0, STYLE.stone.roofs[0]!),
    box(0.7, 0.5, 0.5, 0, 0.25, 0, C.cut),
    ...blocks(4).map((g) => g.translate(0, 0, 1.0)),
  ];
  for (const x of [-0.8, 0.8])
    for (const z of [-0.55, 0.55]) parts.push(box(0.12, 1.0, 0.12, x, 0.5, z, C.post));
  return parts;
}

function haystack(): Parts {
  return [cyl(0, 0.5, 0.9, 0, 0.45, 0, C.hay, 7)];
}

function granary(): Parts {
  return [
    cyl(0.55, 0.55, 1.6, 0, 0.8, 0, '#e4d6b8', 10),
    cyl(0, 0.65, 0.6, 0, 1.9, 0, '#a8432f', 10),
  ];
}

function spireChurch(): Parts {
  return [
    box(1.0, 1.0, 2.0, 0, 0.5, 0, '#f4ede0'),
    gable(2.1, 1.15, 0.7, 1.0, '#8a4a2a'),
    box(0.7, 2.0, 0.7, 0, 1.0, 1.2, '#f4ede0'),
    cyl(0, 0.52, 1.6, 0, 2.8, 1.2, '#5f6f7d', 4),
  ];
}

function keep(): Parts {
  const parts = [box(1.6, 3.0, 1.6, 0, 1.5, 0, '#cfc4b0'), ...windowPanes(1.6, 1.6, 2.2, 1, 1, 1)];
  for (const x of [-0.6, 0, 0.6])
    for (const z of [-0.6, 0.6]) parts.push(box(0.35, 0.35, 0.35, x, 3.17, z, '#cfc4b0'));
  parts.push(cyl(0.03, 0.03, 1.4, 0, 3.7, 0, C.post, 4));
  parts.push(box(0.04, 0.35, 0.6, 0, 4.2, 0.3, C.flag));
  return parts;
}

/** A timber derrick crane for lifting blocks. */
function derrick(): Parts {
  const boom = new THREE.BoxGeometry(0.1, 0.1, 2.4).rotateX(-0.6).translate(0, 1.9, 0.8);
  return [
    cyl(0.07, 0.09, 2.6, 0, 1.3, 0, C.post, 5),
    paint(boom, C.post),
    box(0.02, 0.9, 0.02, 0, 1.9, 1.75, C.post),
    box(0.45, 0.35, 0.45, 0, 1.3, 1.75, C.cut),
  ];
}

function blocks(n: number): Parts {
  const parts: Parts = [];
  for (let i = 0; i < n; i++) {
    const x = (i % 3) * 0.55 - 0.55;
    parts.push(box(0.5, 0.4, 0.5, x, 0.2 + Math.floor(i / 3) * 0.4, 0, i % 2 ? C.cut : C.stone));
  }
  return parts;
}

function crates(n: number): Parts {
  const parts: Parts = [];
  for (let i = 0; i < n; i++) {
    const x = (i % 3) * 0.5 - 0.5;
    const y = i >= 3 ? 0.45 : 0;
    parts.push(
      i % 3 === 2
        ? cyl(0.22, 0.22, 0.5, x, y + 0.25, 0, '#8a5a32')
        : box(0.45, 0.45, 0.45, x, y + 0.22, 0, C.plank),
    );
  }
  return parts;
}

function warehouse(roof: string): Parts {
  return [box(2.0, 1.1, 1.2, 0, 0.55, 0, C.wood), gable(2.2, 1.4, 0.55, 1.1, roof)];
}

function lampPost(): Parts {
  return [
    cyl(0.04, 0.05, 1.3, 0, 0.65, 0, C.post, 4),
    glowing(box(0.2, 0.25, 0.2, 0, 1.4, 0, C.lamp)),
  ];
}

// ---------------------------------------------------------------- the island

interface Profile {
  tiers: number;
  /** Tier radius factor, how far the tiers sit back from the harbour and to the side. */
  k: number;
  back: number;
  side: number;
  /** Extra step back per tier, which makes ledges on the harbour side. */
  step: number;
  /** Height of the waterfront shelf, or null for none. */
  shelf: number | null;
}

const PROFILE: Record<Kind, Profile> = {
  // Cliffs pushed to the back and one side so the harbour town gets a long, low waterfront.
  fish: { tiers: 3, k: 0.7, back: 0.3, side: -0.18, step: 0.05, shelf: 0.6 },
  // Low rolling wooded hills.
  timber: { tiers: 2, k: 0.86, back: 0.12, side: 0.1, step: 0.08, shelf: 0.6 },
  // One low terrace, no plateau: the whole island is farmland.
  grain: { tiers: 1, k: 0.95, back: 0, side: 0, step: 0, shelf: null },
  // Tall terraces the town climbs; the quarry cuts into the seaward side.
  stone: { tiers: 4, k: 0.92, back: 0.05, side: 0, step: 0.11, shelf: 0.55 },
  yard: { tiers: 2, k: 0.75, back: 0.28, side: 0.15, step: 0.05, shelf: 0.6 },
};

interface Disc {
  x: number;
  z: number;
  r: number;
  y: number;
}

export interface TownIslandSpec {
  profile?: IslandTheme;
  seed: number;
  level: TownLevel;
  /** Produced good ('fish', 'timber', 'grain', 'stone'); anything else is a shipyard port. */
  kind?: string;
  /** Island radius in reference units, and its seeded stretch. */
  R: number;
  sx: number;
  sz: number;
  landmark?: LandmarkKind;
  /** Pier line shared with the simulation: x offset, root z and length. */
  pier: { x: number; z0: number; len: number };
}

/**
 * The whole port island at its level, in reference units with the harbour toward +Z: terrain,
 * dock, town and industry. The beach is the same as every other island's.
 */
export function townIslandParts(spec: TownIslandSpec): Parts {
  if (spec.profile) return characterTownParts(spec);
  const { level, R, sx, sz, pier } = spec;
  const kind: Kind =
    (['fish', 'timber', 'grain', 'stone'] as const).find((k) => k === spec.kind) ?? 'yard';
  const P = PROFILE[kind];
  const rng = createRng(spec.seed);
  /** Independent seeded stream per feature, so one feature's count never shifts another's. */
  const stream = (k: number) => createRng(spec.seed * 7919 + k * 104729);
  const out: Parts = [];

  // Terrain: beach, optional shelf, cliff tiers, grass cap. Discs describe the walkable tops.
  const beach = slab(blobShape(rng, R * 1.1, 14, 0.2, sx, sz), 1.45, 0.85);
  out.push(paint(beach.translate(0, -1, 0), C.sand));
  const discs: Disc[] = [{ x: 0, z: 0, r: R * 0.9, y: 0.45 }];
  if (P.shelf !== null) {
    const shelf = slab(blobShape(rng, R * 0.9, 14, 0.1, sx, sz), P.shelf + 0.3, 0.97);
    out.push(paint(shelf.translate(0, -0.3, R * 0.02), C.grass));
    discs.push({ x: 0, z: R * 0.02, r: R * 0.84, y: P.shelf });
  }
  let y = P.shelf ?? 0;
  const ox = P.side * R;
  let oz = -P.back * R;
  for (let i = 0; i < P.tiers; i++) {
    const h =
      kind === 'grain' ? 0.75 : kind === 'timber' ? range(rng, 1.0, 1.3) : range(rng, 1.15, 1.45);
    const r = R * (0.9 - i * 0.16) * P.k;
    if (i) oz -= P.step * R;
    const layer = slab(blobShape(rng, r, 12, 0.12, sx, sz), h, 0.96);
    out.push(paint(layer.translate(ox, y, oz), i % 2 ? C.rock2 : C.rock));
    y += h;
    discs.push({ x: ox, z: oz, r: r * 0.9, y });
  }
  const top = discs[discs.length - 1]!;
  const capR = top.r * 1.02;
  const cap = slab(blobShape(rng, capR, 12, 0.08, sx, sz), 0.22, 0.97);
  out.push(paint(cap.translate(top.x, top.y, top.z), kind === 'grain' ? C.meadow : C.grass));
  top.y += 0.22;

  /** Ground height at a point, or null on (or near) a cliff edge or off the island. */
  const ground = (x: number, z: number, m: number): number | null => {
    let best: Disc | null = null;
    for (const d of discs) {
      const dist = Math.hypot((x - d.x) / sx, (z - d.z) / sz);
      if (d !== discs[0] && Math.abs(dist - d.r) < m + R * 0.05) return null;
      if (dist < d.r - (d === discs[0] ? m : 0) && (!best || d.y > best.y)) best = d;
    }
    return best ? best.y : null;
  };
  const taken: { x: number; z: number; r: number }[] = [];
  const claim = (x: number, z: number, r: number) => taken.push({ x, z, r });
  const free = (x: number, z: number, r: number) =>
    !taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + r) &&
    // A lane up to the pier.
    !(Math.abs(x - pier.x) < 0.7 + r && z > R * 0.45);
  /** The first candidates (in preference order) that sit on clear ground. */
  const spots = (candidates: { x: number; z: number }[], count: number, r: number) => {
    const found: Spot[] = [];
    for (const c of candidates) {
      if (found.length >= count) break;
      const g = ground(c.x, c.z, r * 0.6);
      if (g === null || !free(c.x, c.z, r)) continue;
      claim(c.x, c.z, r);
      found.push({ x: c.x, y: g, z: c.z });
    }
    return found;
  };
  const scatter = (s: Rng, n: number, maxR: number, a0 = 0, a1 = Math.PI * 2, cx = 0, cz = 0) =>
    Array.from({ length: n }, () => {
      const a = range(s, a0, a1);
      const d = Math.sqrt(s()) * maxR;
      return { x: cx + Math.cos(a) * d * sx, z: cz + Math.sin(a) * d * sz };
    });
  const near = (px: number, pz: number) => (p: { x: number; z: number }, q: typeof p) =>
    Math.hypot(p.x - px, p.z - pz) - Math.hypot(q.x - px, q.z - pz);
  const pierRoot = { x: pier.x, z: pier.z0 };
  /** Front (+Z) turned toward the pier root, or straight out to sea. */
  const facePier = (p: Spot, s: Rng) =>
    Math.atan2(pierRoot.x - p.x, pierRoot.z + 2 - p.z) + (s() - 0.5) * 0.3;
  const faceOut = (p: Spot) => Math.atan2(p.x, p.z);
  const S = 1.25; // town buildings read a little larger than the old fixed houses
  const n = (counts: [number, number, number, number]) => counts[level - 1]!;

  // Dock: plank jetty, a proper pier, a T-head with a lamp, then a second pier with a quay.
  dock(out, level, pier, kind === 'stone' && level >= 3);
  const second = { x: pier.x - R * 0.42, z: pier.z0 - 0.2 };
  claim(second.x, second.z - 0.6, 1.2); // reserved from level 1, built at level 4
  if (level >= 4) secondPier(out, second.x, second.z, pier.len * 0.6, kind === 'stone');
  // Warehouses at the pier root.
  const wh = spots(
    [
      { x: pier.x + 2.1, z: pier.z0 - 1.4 },
      { x: pier.x + 2.4, z: pier.z0 - 3.2 },
    ],
    2,
    1.2,
  );
  const roof = STYLE[kind].roofs[1]!;
  if (level >= 2 && wh[0]) put(out, warehouse(roof), wh[0].x, wh[0].y, wh[0].z, 0.1, S);
  if (level >= 4 && wh[1]) put(out, warehouse(roof), wh[1].x, wh[1].y, wh[1].z, -0.1, S);

  if (kind === 'fish') {
    // A crescent of tall houses facing the sea, a second row behind from level 3.
    const s = stream(1);
    const row = (d: number, shift: number) =>
      Array.from({ length: 30 }, (_, i) => {
        const k = (i % 2 ? 1 : -1) * Math.ceil(i / 2);
        const a = Math.PI / 2 + k * 0.16 + shift;
        return { x: Math.cos(a) * d * R * sx, z: Math.sin(a) * d * R * sz };
      });
    const front = spots(row(0.7, 0), 9, 0.6);
    const back = spots(row(0.5, 0.08), 6, 0.6);
    const homes = [...front.slice(0, 6), ...back.slice(0, 3), ...front.slice(6), ...back.slice(3)];
    homes
      .slice(0, n([3, 6, 9, 13]))
      .forEach((p, i) => put(out, fishHouse(i, s), p.x, p.y, p.z, faceOut(p), S));
    // Drying racks along the beach, more each level.
    for (let i = 0; i < n([1, 2, 4, 6]); i++) {
      const a = Math.PI / 2 + (i % 2 ? 1 : -1) * (0.55 + Math.floor(i / 2) * 0.24);
      const x = Math.cos(a) * 0.86 * R * sx;
      const z = Math.sin(a) * 0.86 * R * sz;
      put(out, rack(), x, 0.45, z, Math.atan2(x, z) + Math.PI / 2, S);
    }
    const low = (c: { x: number; z: number }) => (ground(c.x, c.z, 0) ?? 9) < 1.5;
    const civic = spots(
      scatter(stream(2), 120, 0.75 * R)
        .filter(low)
        .sort(near(pier.x - 1, pier.z0 - 4)),
      4,
      1.2,
    );
    if (level >= 2 && civic[0]) put(out, crates(5), civic[0].x, civic[0].y, civic[0].z, 0.2, S);
    if (level >= 3)
      civic
        .slice(1, level >= 4 ? 3 : 2)
        .forEach((p) => put(out, smokehouse(), p.x, p.y, p.z, facePier(p, s), S));
    if (level >= 4 && civic[3])
      put(out, marketHall(), civic[3].x, civic[3].y, civic[3].z, facePier(civic[3], s), S);
    // Fishing boats at their moorings off the beach (scenery, not solid to the player's ship).
    const moor = [
      { x: pier.x + 2.4, z: pier.z0 + pier.len * 0.5, r: 0.2 },
      { x: pier.x - 2.4, z: pier.z0 + pier.len * 0.7, r: -0.3 },
      { x: pier.x + 2.6, z: pier.z0 + pier.len * 1.05, r: 0.1 },
    ];
    for (const m of moor.slice(0, n([0, 1, 2, 3]))) put(out, fishingBoat(), m.x, 0, m.z, m.r, S);
    trees(out, spots(scatter(stream(3), 60, 0.9 * R), 8, 0.6), broadleaf, stream(4));
  } else if (kind === 'timber') {
    // Cabins in a clearing that widens each level; the forest fills the rest, stumps where cut.
    const s = stream(1);
    if (level >= 3) put(out, slip(level >= 4), pier.x + R * 0.48, 0.45, R * 0.76, 0.55);
    claim(pier.x + R * 0.48, R * 0.76, 1.8);
    const yard = spots(
      scatter(stream(2), 120, 0.7 * R, 0, Math.PI).sort(near(pier.x - 3, pier.z0 - 2)),
      6,
      1.1,
    );
    yard.slice(0, n([1, 2, 3, 4])).forEach((p) => put(out, logPile(), p.x, p.y, p.z, 0.4, S));
    if (level >= 3 && yard[4])
      put(out, sawmill(), yard[4].x, yard[4].y, yard[4].z, facePier(yard[4], s), S);
    if (level >= 3 && yard[5]) put(out, lumber(), yard[5].x, yard[5].y, yard[5].z, 0.3, S);
    const plots = spots(scatter(s, 160, 0.82 * R).sort(near(pierRoot.x, pierRoot.z)), 10, 0.85);
    plots
      .slice(0, n([2, 4, 7, 10]))
      .forEach((p, i) => put(out, cabin(i, s), p.x, p.y, p.z, facePier(p, s), S));
    const clearing = [0.35, 0.5, 0.62, 0.75][level - 1]! * R;
    const st = stream(4);
    for (const p of spots(scatter(stream(3), 300, 0.95 * R), 70, 0.5)) {
      if (Math.hypot(p.x - pierRoot.x, p.z - pierRoot.z) < clearing) {
        if (level > 1) put(out, [cyl(0.14, 0.16, 0.18, 0, 0.09, 0, C.wood)], p.x, p.y, p.z);
      } else put(out, pine(st), p.x, p.y, p.z, st() * 6, 1.1);
    }
  } else if (kind === 'grain') {
    // Farmhouses by the pier, then a patchwork of fields spreading over the island.
    const s = stream(2);
    const core = spots(
      scatter(s, 140, 0.45 * R, 0, Math.PI * 2, pier.x, R * 0.42).sort(
        near(pierRoot.x, pierRoot.z),
      ),
      8,
      0.85,
    );
    core
      .slice(0, n([1, 2, 4, 5]))
      .forEach((p, i) => put(out, farmhouse(i), p.x, p.y, p.z, facePier(p, s), S));
    if (level >= 2 && core[6])
      put(out, barn(), core[6].x, core[6].y, core[6].z, facePier(core[6], s), S);
    if (level >= 4 && core[7])
      put(out, spireChurch(), core[7].x, core[7].y, core[7].z, facePier(core[7], s), S);
    const g = stream(1);
    const cell = R * 0.26;
    const origin = { x: (g() - 0.5) * R * 0.5, z: -R * 0.4 };
    const cells: { x: number; z: number }[] = [];
    for (let i = -4; i <= 4; i++)
      for (let j = -4; j <= 4; j++) cells.push({ x: i * cell, z: j * cell - R * 0.05 });
    const fields = spots(cells.sort(near(origin.x, origin.z)), n([3, 6, 10, 14]), cell * 0.48);
    fields.forEach((c, i) => {
      const w = cell * 0.9;
      const crop = C.crops[Math.floor(g() * C.crops.length)]!;
      const parts = [
        box(w, 0.1, w, 0, 0.05, 0, crop),
        box(w * 0.94, 0.04, 0.06, 0, 0.12, -w * 0.22, C.furrow),
        box(w * 0.94, 0.04, 0.06, 0, 0.12, w * 0.22, C.furrow),
      ];
      put(out, parts, c.x, c.y, c.z, i % 2 ? Math.PI / 2 : 0);
    });
    const farm = spots(scatter(stream(3), 160, 0.8 * R).sort(near(origin.x, origin.z)), 10, 0.85);
    farm.slice(0, n([1, 1, 2, 3])).forEach((p) => put(out, windmill(), p.x, p.y, p.z, 0.4, S));
    if (level >= 3 && farm[3]) put(out, granary(), farm[3].x, farm[3].y, farm[3].z, 0, S);
    if (level >= 3 && core[5])
      put(out, bakery(), core[5].x, core[5].y, core[5].z, facePier(core[5], s), S);
    farm.slice(4, 4 + n([0, 2, 4, 6])).forEach((p) => put(out, haystack(), p.x, p.y, p.z, 0, S));
    trees(out, spots(scatter(stream(4), 80, 0.9 * R), n([7, 6, 5, 4]), 0.6), broadleaf, stream(5));
  } else if (kind === 'stone') {
    // The quarry cuts terraces into the seaward cliff; houses climb the terraces from the shore.
    const quarryA = Math.PI / 2 + 1.0;
    claim(Math.cos(quarryA) * R * 0.5, Math.sin(quarryA) * R * 0.5, R * 0.34);
    quarry(out, level, discs.slice(-P.tiers), quarryA, R, sx, sz);
    const s = stream(1);
    const plots = scatter(s, 320, 0.88 * R, 0.1, Math.PI - 0.1)
      .map((p) => ({
        ...p,
        rank: (ground(p.x, p.z, 0.5) ?? 99) + Math.hypot(p.x - pierRoot.x, p.z - pierRoot.z) * 0.15,
      }))
      .sort((p, q) => p.rank - q.rank);
    spots(plots, 10, 0.62)
      .slice(0, n([2, 4, 7, 10]))
      .forEach((p, i) =>
        put(out, stoneHouse(i), p.x, p.y, p.z, faceOut(p) + (s() - 0.5) * 0.4, 1.15),
      );
    const yard = spots(
      scatter(stream(2), 80, 0.7 * R, 0.5, Math.PI - 0.2).sort(near(pier.x - 2, pier.z0 - 1)),
      4,
      0.9,
    );
    if (level >= 3 && yard[3])
      put(out, masons(), yard[3].x, yard[3].y, yard[3].z, facePier(yard[3], s), S);
    yard
      .slice(0, n([1, 1, 2, 3]))
      .forEach((p, i) => put(out, blocks(n([3, 4, 5, 6]) - i), p.x, p.y, p.z, 0.3, S));
    if (level >= 4) put(out, keep(), top.x, top.y, top.z, 0.3, 1.3);
    claim(top.x, top.z, 1.6);
    trees(
      out,
      spots(scatter(stream(3), 40, top.r * 0.8, 0, Math.PI * 2, top.x, top.z), 3, 0.5),
      pine,
      stream(4),
    );
  } else {
    // Shipyard port: a slipway whose ship grows from keel and ribs to a planked hull.
    const s = stream(1);
    if (level >= 2) put(out, slip(level >= 4), pier.x + R * 0.45, 0.45, R * 0.74, 0.55);
    claim(pier.x + R * 0.45, R * 0.74, 1.8);
    if (spec.landmark) claim(top.x, top.z, capR * 0.6);
    const homes = spots(
      scatter(s, 140, 0.8 * R, 0, Math.PI).sort(near(pierRoot.x, pierRoot.z)),
      8,
      0.8,
    );
    homes
      .slice(0, n([2, 3, 5, 8]))
      .forEach((p, i) => put(out, yardHouse(i), p.x, p.y, p.z, facePier(p, s), S));
    trees(out, spots(scatter(stream(2), 60, 0.9 * R), 8, 0.6), pine, stream(3));
  }

  if (spec.landmark)
    put(out, landmarkParts(spec.landmark, Math.min(1.15, capR / 3.8)), top.x, top.y, top.z, 0.2);
  return out;
}

function trees(out: Parts, at: Spot[], make: (r: Rng) => Parts, s: Rng) {
  for (const p of at) put(out, make(s), p.x, p.y, p.z, s() * 6, 1.1);
}

/** The pier on the simulation's line: wider and sturdier each level, a T-head from level 3. */
function dock(out: Parts, level: TownLevel, pier: TownIslandSpec['pier'], stone: boolean) {
  const { x, z0, len } = pier;
  const w = [0.6, 0.9, 1.1, 1.1][level - 1]!;
  const deck = stone ? C.stone : level === 1 ? '#a8805a' : C.wood;
  out.push(box(w, 0.2, len, x, 0.45, z0 + len / 2, deck));
  const posts = level === 1 ? [0.5, 1.0] : [0.3, 0.6, 0.95];
  for (const k of [-1, 1])
    for (const t of posts) {
      if (stone) out.push(box(0.3, 1.2, 0.3, x + k * (w / 2), -0.1, z0 + len * t, C.stoneDark));
      else out.push(cyl(0.08, 0.08, 1.2, x + k * (w / 2 - 0.05), 0, z0 + len * t, C.post, 5));
    }
  if (level >= 2)
    for (const k of [-1, 1])
      out.push(cyl(0.09, 0.11, 0.25, x + k * (w / 2 - 0.15), 0.67, z0 + len * 0.9, '#3d3d3d'));
  if (level >= 3) {
    out.push(box(2.8, 0.2, 1.0, x, 0.45, z0 + len - 0.4, deck));
    for (const k of [-1, 1])
      out.push(cyl(0.08, 0.08, 1.2, x + k * 1.3, 0, z0 + len - 0.4, C.post, 5));
    put(out, lampPost(), x + 1.2, 0.55, z0 + len - 0.4);
  }
}

function secondPier(out: Parts, x: number, z0: number, len: number, stone: boolean) {
  out.push(box(0.9, 0.2, len, x, 0.45, z0 + len / 2, stone ? C.stone : C.wood));
  for (const k of [-1, 1])
    for (const t of [0.4, 0.95])
      out.push(cyl(0.08, 0.08, 1.2, x + k * 0.4, 0, z0 + len * t, C.post, 5));
  out.push(box(2.6, 0.5, 0.7, x, 0.3, z0 - 0.1, C.stoneDark));
}

/**
 * Quarry terraces cut into the seaward cliff, from the top tier down: each level cuts one more
 * pale step, with cut blocks and, from the second cut, a derrick crane.
 */
function quarry(
  out: Parts,
  level: TownLevel,
  tiers: Disc[],
  a: number,
  R: number,
  sx: number,
  sz: number,
) {
  const dx = Math.cos(a);
  const dz = Math.sin(a);
  const face = Math.atan2(dx, dz);
  for (let i = 0; i < level && i < tiers.length; i++) {
    const t = tiers[tiers.length - 1 - i]!;
    const x = t.x + dx * t.r * 0.92 * sx;
    const z = t.z + dz * t.r * 0.92 * sz;
    const cutW = R * (0.22 + i * 0.05);
    out.push(
      paint(
        new THREE.BoxGeometry(cutW, 1.3, R * 0.18).rotateY(face).translate(x, t.y - 0.6, z),
        C.cut,
      ),
    );
    if (i >= 1) put(out, derrick(), x - dx * 0.8, t.y - 0.05, z - dz * 0.8, face);
    put(out, blocks(3), x + dz * 1.4, t.y - 0.05, z - dx * 1.4, face);
  }
}

/** Curved lanes are authored around each landscape, never a rectangular town grid. */
export function characterStreets(kind: IslandTheme) {
  const paths: [number, number][][] =
    kind === 'fish'
      ? [
          [
            [-1.25, 0.43],
            [-0.85, 0.55],
            [-0.4, 0.45],
            [0.0, 0.32],
            [0.4, 0.43],
            [0.8, 0.2],
          ],
          [
            [-1.15, 0.05],
            [-0.75, -0.05],
            [-0.35, -0.42],
            [0.2, -0.55],
            [0.75, -0.28],
          ],
          [
            [-0.15, 0.45],
            [-0.15, 0.0],
            [0.15, -0.35],
          ],
        ]
      : kind === 'timber'
        ? [
            [
              [-1.3, 0.38],
              [-0.95, 0.16],
              [-0.5, 0.23],
              [-0.1, 0.4],
              [0.25, 0.1],
              [0.65, -0.22],
              [1.1, -0.2],
            ],
            [
              [-1.25, -0.12],
              [-0.85, -0.03],
              [-0.4, 0.02],
              [0.05, -0.25],
              [0.55, -0.4],
              [1.0, -0.42],
            ],
            [
              [-1.25, 0.6],
              [-0.7, 0.55],
              [-0.2, 0.5],
            ],
            [
              [0.0, -0.55],
              [0.45, -0.5],
              [1.0, -0.55],
            ],
          ]
        : kind === 'stone'
          ? [
              [
                [-0.95, -0.4],
                [-0.65, -0.2],
                [-0.2, -0.12],
                [0.15, -0.35],
                [0.4, -0.48],
              ],
              [
                [-0.9, -0.6],
                [-0.4, -0.58],
                [0.0, -0.65],
                [0.35, -0.48],
              ],
              [
                [-1.0, 0.45],
                [-0.65, 0.55],
                [-0.25, 0.48],
                [0.15, 0.55],
                [0.55, 0.45],
              ],
            ]
          : [
              [
                [-0.62, -0.3],
                [-0.3, -0.05],
                [-0.1, 0.2],
                [0.15, 0.43],
                [0.4, 0.05],
                [0.5, -0.3],
              ],
              [
                [-0.65, -0.6],
                [-0.2, -0.5],
                [0.25, -0.55],
                [0.65, -0.6],
              ],
              [
                [-0.65, -0.35],
                [-0.1, -0.28],
                [0.35, -0.35],
              ],
            ];
  return paths.map(
    (path) =>
      new THREE.CatmullRomCurve3(
        path.map(([x, z]) => new THREE.Vector3(x, 0, z)),
        false,
        'centripetal',
      ),
  );
}

/** A seeded maximum-level plan follows winding lanes, with uneven setbacks and small courts. */
export function characterTownPlan(kind: IslandTheme, R: number) {
  const layout = islandLayout(kind);
  const spacing =
    kind === 'grain' ? 0.165 : kind === 'timber' ? 0.19 : kind === 'stone' ? 0.14 : 0.18;
  const margin =
    (kind === 'timber' ? 1.1 : kind === 'grain' ? 0.9 : kind === 'stone' ? 0.82 : 1.0) / R;
  const plots: (Spot & { yaw: number })[] = [];
  const rng = createRng(711 + ['fish', 'timber', 'stone', 'grain'].indexOf(kind));
  for (const street of characterStreets(kind)) {
    const n = Math.ceil(street.getLength() / spacing);
    for (let i = 0; i <= n; i++)
      for (const side of [-1, 1]) {
        const t = Math.max(0, Math.min(1, (i + (rng() - 0.5) * 0.25) / n));
        const p = street.getPointAt(t),
          tangent = street.getTangentAt(t);
        const setback = 0.12 + rng() * 0.045;
        const nx = -tangent.z * side,
          nz = tangent.x * side;
        const x = p.x + nx * setback,
          z = p.z + nz * setback;
        const h = layoutGround(layout, x, z, margin);
        if (
          h === null ||
          (kind === 'stone' &&
            layout.surfaces.some((s) => s.material === 'rock' && s.height === h)) ||
          (Math.abs(x - 0.08) < 0.12 && z > 0.45)
        )
          continue;
        if (Math.hypot(x - layout.landmark[0], z - layout.landmark[1]) < 0.24) continue;
        const civic =
          kind === 'fish' ? [0.15, -0.45] : kind === 'timber' ? [-0.05, -0.2] : [-0.35, -0.25];
        if (Math.hypot(x + 0.2, z - 0.5) < 0.23 || Math.hypot(x - civic[0]!, z - civic[1]!) < 0.32)
          continue;
        if (kind === 'timber' && ((x > 0.3 && z > 0.25) || z < -0.55)) continue;
        if (
          kind === 'fish' &&
          ((x > 0.75 && z > 0) || (x > -1.3 && x < -0.1 && z > 0.15 && z < 0.68))
        )
          continue;
        if (kind === 'stone' && x > -1.2 && x < -0.25 && z > 0.12 && z < 0.5) continue;
        if (kind === 'grain' && ((x > 0.65 && z > -0.2) || Math.hypot(x + 0.9, z + 0.65) < 0.2))
          continue;
        if (plots.some((q) => Math.hypot(q.x / R - x, q.z / R - z) < spacing * 0.9)) continue;
        plots.push({ x: x * R, y: h * R, z: z * R, yaw: Math.atan2(-nx, -nz) });
      }
  }
  // Irregular back courts fill gaps behind the frontage; no second regimented row.
  const lanes = characterStreets(kind).map((c) => c.getSpacedPoints(80));
  for (let i = 0; i < 5000 && plots.length < 44; i++) {
    const x = range(rng, kind === 'grain' ? -0.85 : -1.4, kind === 'grain' ? 0.65 : 1.25);
    const z = range(rng, -0.78, 0.68);
    const h = layoutGround(layout, x, z, margin);
    if (
      h === null ||
      (kind === 'stone' && layout.surfaces.some((s) => s.material === 'rock' && s.height === h)) ||
      (Math.abs(x - 0.08) < 0.12 && z > 0.45)
    )
      continue;
    const civic =
      kind === 'fish' ? [0.15, -0.45] : kind === 'timber' ? [-0.05, -0.2] : [-0.35, -0.25];
    if (
      [[-0.2, 0.5], layout.landmark].some(([cx, cz]) => Math.hypot(x - cx!, z - cz!) < 0.25) ||
      Math.hypot(x - civic[0]!, z - civic[1]!) < 0.32
    )
      continue;
    if (kind === 'timber' && ((x > 0.3 && z > 0.25) || z < -0.55)) continue;
    if (kind === 'fish' && ((x > 0.75 && z > 0) || (x > -1.3 && x < -0.1 && z > 0.15 && z < 0.68)))
      continue;
    if (kind === 'stone' && x > -1.2 && x < -0.25 && z > 0.12 && z < 0.5) continue;
    if (plots.some((q) => Math.hypot(q.x / R - x, q.z / R - z) < spacing * 0.95)) continue;
    let nearest = Infinity,
      yaw = 0;
    for (const lane of lanes)
      for (let j = 1; j < lane.length; j++) {
        const p = lane[j]!,
          d = Math.hypot(p.x - x, p.z - z);
        if (d < nearest) {
          nearest = d;
          yaw = Math.atan2(p.x - x, p.z - z);
        }
      }
    if (nearest < 0.105 || nearest > 0.38) continue;
    plots.push({ x: x * R, y: h * R, z: z * R, yaw });
  }
  // Grow outwards from one harbour-side nucleus, including the first three homes.
  const ordered: typeof plots = [];
  while (plots.length) {
    const nucleus = ordered[0] ?? {
      x: (kind === 'stone' ? -0.9 : -0.32) * R,
      z: (kind === 'stone' ? -0.3 : 0.38) * R,
      y: 0,
    };
    plots.sort((a, b) => {
      const score = (p: Spot) => {
        const local = ordered.length
          ? Math.min(...ordered.map((q) => Math.hypot(p.x - q.x, p.z - q.z)))
          : 0;
        return (
          Math.hypot(p.x - nucleus.x, p.z - nucleus.z) +
          local * 1.8 +
          (ordered.length ? Math.abs(p.y - nucleus.y) * 1.5 : 0)
        );
      };
      return score(a) - score(b);
    });
    ordered.push(plots.shift()!);
  }
  return ordered;
}

/** Omit horizontal undersides: every island is viewed from above the sea. */
function withoutUndersides(g: THREE.BufferGeometry) {
  const normal = g.getAttribute('normal');
  const keep: number[] = [];
  for (let i = 0; i < normal.count; i += 3)
    if (!(normal.getY(i) < -0.999 && normal.getY(i + 1) < -0.999 && normal.getY(i + 2) < -0.999))
      keep.push(i, i + 1, i + 2);
  if (keep.length === normal.count) return g;
  const trimmed = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(g.attributes)) {
    const values = new Float32Array(keep.length * attribute.itemSize);
    keep.forEach((index, j) => {
      for (let k = 0; k < attribute.itemSize; k++)
        values[j * attribute.itemSize + k] = attribute.array[index * attribute.itemSize + k]!;
    });
    trimmed.setAttribute(
      name,
      new THREE.BufferAttribute(values, attribute.itemSize, attribute.normalized),
    );
  }
  trimmed.userData = g.userData;
  g.dispose();
  return trimmed;
}

/** The new silhouettes retain the inexpensive primitive models and single merged land mesh. */
function characterTownParts(spec: TownIslandSpec): Parts {
  const kind = spec.profile!;
  const { R, level } = spec;
  const layout = islandLayout(kind, level);
  const out: Parts = [];
  const shape = (outline: Outline, holes: Outline[] = []) => {
    const s = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x * R, -z * R)));
    s.holes = holes.map((h) => new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x * R, -z * R))));
    return s;
  };
  const terrain = (
    outline: Outline,
    bottom: number,
    top: number,
    cap: string,
    holes: Outline[] = [],
  ) => {
    const g = new THREE.ExtrudeGeometry(shape(outline, holes), {
      depth: top - bottom,
      bevelEnabled: false,
      curveSegments: 1,
    });
    g.rotateX(-Math.PI / 2).translate(0, bottom, 0);
    out.push(paintGroups(g, [cap, cap === C.sand ? C.sand : C.rock]));
  };
  for (const coast of layout.coasts)
    terrain(coast, -1, 0.3, C.sand, layout.lake ? [layout.lake] : []);
  for (const s of layout.surfaces) {
    if (s.material === 'rock' && s.height > 0.7) {
      const xs = s.outline.map((p) => p[0]),
        zs = s.outline.map((p) => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2,
        cz = (Math.min(...zs) + Math.max(...zs)) / 2;
      const rx = (Math.max(...xs) - Math.min(...xs)) / 2,
        rz = (Math.max(...zs) - Math.min(...zs)) / 2;
      const g = new THREE.ConeGeometry(R, s.height * R, 10)
        .scale(rx, 1, rz)
        .translate(cx * R, (s.height * R) / 2, cz * R);
      out.push(paint(g, C.rock2));
    } else
      terrain(
        s.outline,
        0.3,
        s.height * R,
        s.material === 'grass' ? C.grass : kind === 'stone' ? C.cut : C.rock2,
        s.holes,
      );
  }
  if (kind === 'stone') {
    // Two flights traverse the cliff face, with a landing above the lower village.
    const flights = [
      [
        [-1.1, 0.18, 0.68],
        [-0.4, 0.34, 0.38],
      ],
      [
        [-0.4, 0.34, 0.38],
        [-1.05, 0.46, 0.08],
      ],
    ];
    for (const [a, b] of flights)
      for (let i = 0; i < 12; i++) {
        const t = (i + 0.5) / 12,
          x = a![0]! + (b![0]! - a![0]!) * t,
          z = a![1]! + (b![1]! - a![1]!) * t;
        const y = a![2]! + (b![2]! - a![2]!) * t;
        const length = (Math.hypot(b![0]! - a![0]!, b![1]! - a![1]!) * R) / 12;
        // Full masonry beneath each tread bears on the dry lower terrace.
        const supportHeight = (y - 0.08) * R;
        const step = box(
          length + 0.02,
          supportHeight + 0.03,
          R * 0.085,
          0,
          -supportHeight / 2,
          0,
          C.cut,
        );
        put(out, [step], x * R, y * R, z * R, -Math.atan2(b![1]! - a![1]!, b![0]! - a![0]!));
      }
    put(out, [box(R * 0.13, 0.12, R * 0.12, 0, 0, 0, C.cut)], -0.4 * R, 0.38 * R, 0.34 * R);
    put(
      out,
      [paint(new THREE.PlaneGeometry(R * 0.28, R * 0.055).rotateX(-Math.PI / 2), '#c1af7c')],
      -1.07 * R,
      0.68 * R + 0.015,
      0.04 * R,
      Math.PI / 2,
    );
    // The footpath starts on dry land and connects the stair foot to the harbour.
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.05, 0, 0.46),
      new THREE.Vector3(-0.7, 0, 0.57),
      new THREE.Vector3(-0.25, 0, 0.58),
      new THREE.Vector3(0.08, 0, 0.63),
    ]);
    const p = path.getSpacedPoints(25);
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1]!,
        b = p[i]!;
      put(
        out,
        [
          paint(
            new THREE.PlaneGeometry(a.distanceTo(b) * R + 0.02, R * 0.055).rotateX(-Math.PI / 2),
            '#c1af7c',
          ),
        ],
        ((a.x + b.x) * R) / 2,
        0.08 * R + 0.015,
        ((a.z + b.z) * R) / 2,
        -Math.atan2(b.z - a.z, b.x - a.x),
      );
    }
  }
  if (layout.lake) {
    terrain(insetOutline(layout.lake, -0.035), 0.3, 0.55, C.sand, [layout.lake]);
    // A true hole through the terrain; an independent still-water surface above the ocean.
    const water = new THREE.ShapeGeometry(shape(layout.lake));
    water.rotateX(-Math.PI / 2).translate(0, 0.5, 0);
    out.push(paint(water, '#319eae'));
  }
  const boundsOf = (parts: Parts) => {
    const bounds = new THREE.Box3();
    for (const g of parts) {
      g.computeBoundingBox();
      bounds.union(g.boundingBox!);
    }
    return bounds;
  };
  type Footprint = [number, number][];
  const footprint = (parts: Parts): Footprint => {
    const points: Footprint = [];
    for (const g of parts) {
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) points.push([p.getX(i), p.getZ(i)]);
    }
    points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (a: number[], b: number[], c: number[]) =>
      (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!);
    const half = (ps: Footprint) => {
      const h: Footprint = [];
      for (const p of ps) {
        while (h.length > 1 && cross(h[h.length - 2]!, h[h.length - 1]!, p) <= 0) h.pop();
        h.push(p);
      }
      h.pop();
      return h;
    };
    return [...half(points), ...half([...points].reverse())];
  };
  const overlaps = (a: Footprint, b: Footprint) => {
    for (const p of [a, b])
      for (let i = 0; i < p.length; i++) {
        const q = p[(i + 1) % p.length]!,
          r = p[i]!,
          nx = q[1] - r[1],
          nz = r[0] - q[0];
        const aa = a.map((v) => v[0] * nx + v[1] * nz),
          bb = b.map((v) => v[0] * nx + v[1] * nz);
        if (
          Math.max(...aa) + 0.03 * Math.hypot(nx, nz) < Math.min(...bb) ||
          Math.max(...bb) + 0.03 * Math.hypot(nx, nz) < Math.min(...aa)
        )
          return false;
      }
    return true;
  };
  const buildings: Footprint[] = [];
  const reserve = (parts: Parts, x: number, z: number, scale: number, yaw = 0) => {
    put([], parts, x * R, 0, z * R, yaw, scale);
    buildings.push(footprint(parts));
    parts.forEach((g) => g.dispose());
  };
  reserve(warehouse(STYLE[kind].roofs[0]!), -0.2, 0.5, 1.1);
  if (kind === 'fish') {
    reserve(marketHall(), 0.15, -0.45, 2);
    reserve(smokehouse(), 0.85, 0.06, 2.1);
  } else if (kind === 'timber') {
    reserve(workingSawmill(), -0.05, -0.2, 2);
    reserve(workingSlip(true), 1.05, 0.38, 1.65, 0.25);
    reserve(timberWorkshop(false), 0.4, 0.43, 1.1);
    reserve(timberWorkshop(true), 1.0, -0.9, 1.1);
  } else if (kind === 'stone') {
    reserve(masons(), 0.68, 0.12, 2);
    reserve(keep(), layout.landmark[0], layout.landmark[1], 1.25);
  } else {
    reserve(spireChurch(), -0.35, -0.25, 2);
    reserve(barn(), 0.85, -0.05, 1.65);
    reserve(granary(), -0.9, -0.65, 1.7);
    reserve(bakery(), 1.25, -0.05, 1.75);
  }
  const homeRng = createRng(spec.seed);
  const homes: { parts: Parts; spot: Spot & { yaw: number } }[] = [];
  for (const p of characterTownPlan(kind, R)) {
    const i = homes.length;
    const parts =
      kind === 'fish'
        ? fishHouse(i, homeRng)
        : kind === 'timber'
          ? cabin(i, homeRng)
          : kind === 'stone'
            ? stoneHouse(i)
            : farmhouse(i);
    put([], parts, p.x, p.y, p.z, p.yaw, kind === 'grain' ? 0.8 : kind === 'timber' ? 1 : 1.15);
    const bounds = boundsOf(parts);
    bounds.min.y = -100;
    bounds.max.y = 100;
    const polygon = footprint(parts);
    if (buildings.some((b) => overlaps(b, polygon))) {
      parts.forEach((g) => g.dispose());
      continue;
    }
    buildings.push(polygon);
    parts[0]!.userData.residence = i;
    parts[0]!.userData.buildingBounds = {
      minX: bounds.min.x,
      maxX: bounds.max.x,
      minZ: bounds.min.z,
      maxZ: bounds.max.z,
    };
    homes.push({ parts, spot: p });
  }
  const plots = homes.map((h) => h.spot);
  // Reveal connected lane fragments near occupied plots, with no roads across water or cliffs.
  const growth = [3, 10, Math.min(21, Math.ceil(homes.length * 0.75)), 32];
  const active = plots.slice(0, growth[level - 1]!);
  const clearedLanes: { x: number; z: number }[] = [];
  for (const street of characterStreets(kind)) {
    const points = street.getSpacedPoints(110);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!,
        b = points[i]!;
      const x = (a.x + b.x) / 2,
        z = (a.z + b.z) / 2;
      const h = layoutGround(layout, x, z, 0.025);
      if (h === null || !active.some((p) => Math.hypot(p.x / R - x, p.z / R - z) < 0.3)) continue;
      const ha = layoutGround(layout, a.x, a.z, 0.025),
        hb = layoutGround(layout, b.x, b.z, 0.025);
      if (ha !== h || hb !== h) continue;
      clearedLanes.push({ x, z });
      const len = a.distanceTo(b) * R;
      const g = paint(
        new THREE.PlaneGeometry(len + 0.01, R * 0.04).rotateX(-Math.PI / 2).translate(0, 0.012, 0),
        '#c1af7c',
      );
      put(out, [g], x * R, h * R, z * R, -Math.atan2(b.z - a.z, b.x - a.x));
    }
  }
  homes.forEach((home, i) => {
    if (i < growth[level - 1]!) out.push(...home.parts);
    else home.parts.forEach((g) => g.dispose());
  });
  dock(out, level, characterPiers(kind, R, level)[0]!, kind === 'stone' && level >= 3);
  // The same blue-and-white harbour flag identifies the player berth at every port.
  const arrival = characterPiers(kind, R, level)[0]!;
  if (level < 3) put(out, lampPost(), arrival.x + 0.25, 0.55, arrival.z0 + arrival.len - 0.4);
  const flag = [
    cyl(0.055, 0.07, 3.0, 0, 1.5, 0, C.post, 5),
    box(1.1, 0.8, 0.05, 0.55, 2.5, 0, '#f8f3ea'),
    box(0.45, 0.8, 0.055, 0.85, 2.5, 0, '#3f74a8'),
  ];
  flag[0]!.userData.playerBerth = true;
  put(out, flag, arrival.x - 0.33, 0.55, arrival.z0 + arrival.len - 0.35);
  // A pale landing strip makes the longest pier stand out without filling the water lane.
  out.push(
    box(
      0.35,
      0.025,
      Math.min(2.4, arrival.len),
      arrival.x,
      0.565,
      arrival.z0 + arrival.len - 1.2,
      '#f2d9a0',
    ),
  );

  // Additional finger piers use the shared harbour plan (including their collision segments).
  for (const p of characterPiers(kind, R, level).slice(1))
    secondPier(out, p.x, p.z0, p.len, kind === 'stone');
  const occupied: { x: number; z: number; radius: number }[] = [];
  const placeAt = (parts: Parts, x: number, z: number, scale = 1.1, footprint?: number) => {
    const bounds = new THREE.Box3();
    for (const g of parts) {
      g.computeBoundingBox();
      bounds.union(g.boundingBox!);
    }
    const margin =
      (Math.hypot(
        Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)),
        Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)),
      ) *
        scale) /
      R;
    const h = layoutGround(layout, x, z, footprint ?? margin);
    if (h !== null) {
      put(out, parts, x * R, h * R, z * R, 0, scale);
      occupied.push({ x, z, radius: margin });
    }
  };
  if (level >= 2) placeAt(warehouse(STYLE[kind].roofs[0]!), -0.2, 0.5);
  const workshop = (parts: Parts) => {
    parts[0]!.userData.workshop = kind;
    return parts;
  };
  if (level >= (kind === 'timber' || kind === 'stone' ? 3 : 4)) {
    let civic =
      kind === 'fish'
        ? marketHall()
        : kind === 'timber'
          ? workingSawmill()
          : kind === 'stone'
            ? masons()
            : spireChurch();
    if (kind === 'timber' || kind === 'stone') civic = workshop(civic);
    placeAt(
      civic,
      kind === 'fish' ? 0.15 : kind === 'timber' ? -0.05 : kind === 'stone' ? 0.68 : -0.35,
      kind === 'fish' ? -0.45 : kind === 'timber' ? -0.2 : kind === 'stone' ? 0.12 : -0.25,
      2.0,
      kind === 'stone' ? 0.025 : 0.12,
    );
  }
  const features = [1, 2, 4, 6][level - 1]!;
  if (kind === 'fish') {
    for (let i = 0; i < features + 2; i++) {
      const x = -1.1 + (i % 4) * 0.28,
        z = 0.52 - Math.floor(i / 4) * 0.22;
      const drying = rack();
      for (let f = 0; f < 5; f++)
        drying.push(cyl(0.04, 0.1, 0.3, -0.45 + f * 0.22, 0.55, 0.06, '#cad7d5', 5));
      placeAt(drying, x, z, 1.5, 0.06);
      placeAt(crates(2), x, z - 0.09, 1.0, 0.04);
    }
    placeAt(workshop(smokehouse()), 0.85, 0.06, level >= 3 ? 2.1 : 1.45, 0.1);
    put(
      out,
      landmarkParts('lighthouse', 0.8),
      layout.landmark[0] * R,
      0.12 * R,
      layout.landmark[1] * R,
    );
    if (level >= 3) placeAt(fishHouse(1, createRng(spec.seed)), 1.95, 0.65);
    for (const mooring of fishingMoorings(level)) {
      const boat = fishingBoat();
      // Spar, furled net and buoys remain readable from the approach camera.
      boat.push(box(1.2, 0.07, 0.07, 0, 1.7, -0.2, C.post));
      for (let n = 0; n < 4; n++)
        boat.push(cyl(0.07, 0.07, 0.18, -0.4 + n * 0.25, 0.5, 0.35, '#e2c160', 5));
      boat.push(box(0.5, 0.16, 0.6, 0, 0.43, 0.55, '#aaa88b'));
      put(out, boat, mooring.x * R, 0, mooring.z * R, mooring.yaw, 1.55);
    }
  } else if (kind === 'timber') {
    if (level >= 3) {
      placeAt(timberWorkshop(false), 0.4, 0.43, 1.1, 0.1);
      placeAt(timberWorkshop(true), 1.0, -0.9, 1.1, 0.1);
    }
    for (let i = 0; i < features; i++) {
      if (i < 3) {
        const x = 0.35 + i * 0.21,
          z = 0.82;
        const pile = logPile();
        pile[0]!.userData.logYard = 'shore';
        put(out, pile, x * R, 0.3, z * R, 0.08, 1.1);
        occupied.push({ x, z, radius: 0.14 });
      } else {
        const pile = logPile();
        pile[0]!.userData.logYard = 'upland';
        placeAt(pile, 0.2 + (i - 3) * 0.23, -0.9, 1.1, 0.09);
      }
    }
    if (level < 3) placeAt(workshop(workingSawmill()), -0.05, -0.2, 1.7, 0.12);
    put(out, lampPost(), 0.12 * R, 0.11 * R, -0.05 * R, 0, 1.3);
    put(out, lampPost(), 0.95 * R, 0.3, 0.82 * R, 0, 1.3);
    if (level >= 3) put(out, lampPost(), 0.9 * R, 0.32 * R, -0.9 * R, 0, 1.3);
    // A substantial waterfront boatyard, with a hull on stocks visible from the sea.
    put(out, workingSlip(level >= 3), 1.05 * R, 0.11 * R, 0.38 * R, 0.25, 1.65);
    occupied.push({ x: 1.05, z: 0.38, radius: 0.28 });
  } else if (kind === 'stone') {
    const benches = [
      [0.85, 0.22],
      [0.32, -0.22],
      [-0.03, -0.28],
    ];
    benches.slice(0, Math.min(level, 3)).forEach(([x, z]) => {
      placeAt(derrick(), x!, z!, 1.65, 0.025);
      placeAt(blocks(3 + level), x! + 0.12, z! + 0.12, 1.3, 0.025);
      const h = layoutGround(layout, x!, z!);
      if (h !== null)
        for (const offset of [-0.025, 0.025])
          put(
            out,
            [box(R * 0.32, 0.035, 0.035, 0, 0.03, 0, C.post)],
            x! * R,
            h * R,
            (z! + offset) * R,
            -0.2,
          );
      occupied.push({ x: x!, z: z!, radius: 0.2 });
    });
    placeAt(keep(), layout.landmark[0], layout.landmark[1], level === 4 ? 1.25 : 0.7);
  } else {
    const firstMill = windmill();
    firstMill[0]!.userData.windmill = { x: -1.15, z: -0.4 };
    placeAt(firstMill, -1.15, -0.4, 1.25, 0.07);
    if (level >= 3) placeAt(windmill(), 1.0, -0.5, 1.25, 0.07);
    placeAt(barn(), 0.85, -0.05, level >= 2 ? 1.65 : 1.1, 0.12);
    if (level >= 3) placeAt(granary(), -0.9, -0.65, 1.7, 0.1);
    if (level >= 3) placeAt(workshop(bakery()), 1.25, -0.05, 1.75, 0.1);
  }
  // Fields claim woodland as the settlement grows. Future house sites remain wooded.
  const fields: { x: number; z: number; h: number }[] = [];
  if (kind === 'grain') {
    const candidates: typeof fields = [];
    for (let z = -1.04; z < 0.65; z += 0.32)
      for (let x = -1.5; x < 1.6; x += 0.32) {
        const h = layoutGround(layout, x, z, 0.17);
        if (
          h === null ||
          plots.some((p) => Math.hypot(p.x / R - x, p.z / R - z) < 0.28) ||
          [
            [0.85, -0.05],
            [1.25, -0.05],
            [-0.9, -0.65],
            [-0.35, -0.25],
            [-0.2, 0.5],
          ].some(([cx, cz]) => Math.hypot(cx! - x, cz! - z) < 0.33) ||
          Math.hypot(x - 1, z + 0.5) < 0.3 ||
          Math.hypot(x + 1.15, z + 0.4) < 0.3
        )
          continue;
        candidates.push({ x, z, h });
      }
    candidates.sort((a, b) => Math.hypot(a.x + 0.4, a.z - 0.1) - Math.hypot(b.x + 0.4, b.z - 0.1));
    fields.push(...candidates.slice(0, [3, 7, 13, 22][level - 1]!));
    fields.forEach(({ x, z, h }, i) => {
      const patch = [box(R * 0.28, 0.07, R * 0.28, 0, 0.035, 0, C.crops[i % 5]!)];
      patch[0]!.userData.field = { x, z };
      for (let row = -2; row <= 2; row++)
        patch.push(
          paint(
            new THREE.PlaneGeometry(R * 0.26, 0.035)
              .rotateX(-Math.PI / 2)
              .translate(0, 0.085, row * R * 0.045),
            C.furrow,
          ),
        );
      put(out, patch, x * R, h * R, z * R);
    });
  }
  // Fixed candidate trees keep untouched woods stable; occupied land alone clears them.
  const treesRng = createRng(spec.seed + 789);
  const forest: { x: number; z: number }[] = [];
  for (let i = 0; i < 1100; i++) {
    const x = range(treesRng, -1.7, 1.7),
      z = range(treesRng, -1.3, 0.72);
    const tree = woodlandTree(kind, treesRng);
    const yaw = treesRng() * 6,
      scale = kind === 'timber' ? 1.8 : kind === 'stone' ? 1.1 : 1.7;
    const h = layoutGround(layout, x, z, 0.09);
    const finalHeight = layoutGround(islandLayout(kind), x, z, 0.09);
    if (
      h === null ||
      finalHeight === null ||
      (kind === 'stone' &&
        layout.surfaces.some(
          (s) => s.material === 'rock' && s.outline.length > 0 && h === s.height,
        ))
    )
      continue;
    if (
      forest.some(
        (p) =>
          Math.hypot(p.x - x, p.z - z) <
          (kind === 'timber' ? 0.185 : kind === 'stone' ? 0.23 : 0.27),
      )
    )
      continue;
    forest.push({ x, z });
    if (
      active.some((p) => Math.hypot(p.x / R - x, p.z / R - z) < 0.19) ||
      clearedLanes.some((p) => Math.hypot(p.x - x, p.z - z) < 0.09) ||
      occupied.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + 0.1) ||
      fields.some((p) => Math.abs(p.x - x) < 0.22 && Math.abs(p.z - z) < 0.22) ||
      (Math.abs(x - 0.08) < 0.14 && z > 0.45) ||
      Math.hypot(x - layout.landmark[0], z - layout.landmark[1]) < 0.23
    )
      continue;
    tree[0]!.userData.tree = { x, z };
    put(out, tree, x * R, h * R, z * R, yaw, scale);
  }
  return out.map(withoutUndersides);
}
