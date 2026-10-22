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
  const spacing = kind === 'grain' ? 0.165 : kind === 'timber' ? 0.19 : 0.18;
  const margin = (kind === 'timber' ? 1.1 : kind === 'grain' ? 0.9 : 1.0) / R;
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
        if (h === null || (Math.abs(x - 0.08) < 0.12 && z > 0.45)) continue;
        if (Math.hypot(x - layout.landmark[0], z - layout.landmark[1]) < 0.24) continue;
        const civic =
          kind === 'fish' ? [0.15, -0.45] : kind === 'timber' ? [-0.05, -0.2] : [-0.35, -0.25];
        if ([[-0.2, 0.5], civic].some(([cx, cz]) => Math.hypot(x - cx!, z - cz!) < 0.23)) continue;
        if (kind === 'timber' && ((x > 0.3 && z > 0.25) || z < -0.55)) continue;
        if (kind === 'fish' && x > 0.75 && z > 0) continue;
        if (kind === 'stone' && Math.abs(x + 0.65) < 0.16 && z > 0.24) continue;
        if (kind === 'grain' && ((x > 0.65 && z > -0.2) || Math.hypot(x + 0.9, z + 0.65) < 0.2))
          continue;
        if (plots.some((q) => Math.hypot(q.x / R - x, q.z / R - z) < spacing * 0.9)) continue;
        plots.push({ x: x * R, y: h * R, z: z * R, yaw: Math.atan2(-nx, -nz) });
      }
  }
  // Irregular back courts fill gaps behind the frontage; no second regimented row.
  const lanes = characterStreets(kind).map((c) => c.getSpacedPoints(80));
  for (let i = 0; i < 1800 && plots.length < 44; i++) {
    const x = range(rng, kind === 'grain' ? -0.85 : -1.4, kind === 'grain' ? 0.65 : 1.25);
    const z = range(rng, -0.78, 0.68);
    const h = layoutGround(layout, x, z, margin);
    if (h === null || (Math.abs(x - 0.08) < 0.12 && z > 0.45)) continue;
    const civic =
      kind === 'fish' ? [0.15, -0.45] : kind === 'timber' ? [-0.05, -0.2] : [-0.35, -0.25];
    if (
      [[-0.2, 0.5], civic, layout.landmark].some(([cx, cz]) => Math.hypot(x - cx!, z - cz!) < 0.25)
    )
      continue;
    if (kind === 'timber' && ((x > 0.3 && z > 0.25) || z < -0.55)) continue;
    if (kind === 'fish' && x > 0.75 && z > 0) continue;
    if (kind === 'stone' && Math.abs(x + 0.65) < 0.16 && z > 0.24) continue;
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
  return plots.sort(
    (a, b) =>
      Math.hypot(a.x - 0.08 * R, a.z - 0.85 * R) - Math.hypot(b.x - 0.08 * R, b.z - 0.85 * R),
  );
}

/** The new silhouettes retain the inexpensive primitive models and single merged land mesh. */
function characterTownParts(spec: TownIslandSpec): Parts {
  const kind = spec.profile!;
  const { R, level } = spec;
  const layout = islandLayout(kind);
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
    if (s.material === 'rock' && s.height > 0.5) {
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
    for (let i = 0; i < 10; i++) {
      const top = (0.65 - (i * (0.65 - 0.065)) / 9) * R;
      out.push(
        box(
          R * 0.15,
          top - 0.3,
          R * 0.06,
          -0.65 * R,
          (top + 0.3) / 2,
          (0.28 + i * 0.045) * R,
          C.cut,
        ),
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
  const plots = characterTownPlan(kind, R);
  // Reveal connected lane fragments near occupied plots, with no roads across water or cliffs.
  const active = plots.slice(0, [3, 10, 21, 32][level - 1]!);
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
      const len = a.distanceTo(b) * R;
      const g = paint(
        new THREE.PlaneGeometry(len + 0.01, R * 0.04).rotateX(-Math.PI / 2).translate(0, 0.012, 0),
        '#c1af7c',
      );
      put(out, [g], x * R, h * R, z * R, -Math.atan2(b.z - a.z, b.x - a.x));
    }
  }
  const count = [3, 10, 21, 32][level - 1]!;
  const rng = createRng(spec.seed);
  plots.slice(0, count).forEach((p, i) => {
    const home =
      kind === 'fish'
        ? fishHouse(i, rng)
        : kind === 'timber'
          ? cabin(i, rng)
          : kind === 'stone'
            ? stoneHouse(i)
            : farmhouse(i);
    home[0]!.userData.residence = i;
    // Houses face their winding lane; plots and random streams stay fixed as the town grows.
    put(out, home, p.x, p.y, p.z, p.yaw, kind === 'grain' ? 0.8 : kind === 'timber' ? 1.0 : 1.15);
  });
  dock(out, level, characterPiers(kind, R, level)[0]!, kind === 'stone' && level >= 3);
  // Additional finger piers use the shared harbour plan (including their collision segments).
  for (const p of characterPiers(kind, R, level).slice(1))
    secondPier(out, p.x, p.z0, p.len, kind === 'stone');
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
    if (h !== null) put(out, parts, x * R, h * R, z * R, 0, scale);
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
          ? sawmill()
          : kind === 'stone'
            ? masons()
            : spireChurch();
    if (kind === 'timber' || kind === 'stone') civic = workshop(civic);
    placeAt(
      civic,
      kind === 'fish' ? 0.15 : kind === 'timber' ? -0.05 : -0.35,
      kind === 'fish' ? -0.45 : kind === 'timber' ? -0.2 : -0.25,
      1.35,
    );
  }
  const features = [1, 2, 4, 6][level - 1]!;
  if (kind === 'fish') {
    for (let i = 0; i < features; i++) placeAt(rack(), -1.2 + i * 0.28, 0.73);
    if (level >= 3) placeAt(workshop(smokehouse()), 0.9, 0.15);
    put(
      out,
      landmarkParts('lighthouse', 0.8),
      layout.landmark[0] * R,
      0.12 * R,
      layout.landmark[1] * R,
    );
    if (level >= 3) placeAt(fishHouse(1, createRng(spec.seed)), 1.95, 0.65);
    for (let i = 0; i < level; i++)
      put(out, fishingBoat(), (-0.55 + i * 0.35) * R, 0, 1.13 * R, 0.1, 0.9);
  } else if (kind === 'timber') {
    for (let i = 0; i < features; i++)
      placeAt(i % 2 ? lumber() : logPile(), 0.4 + (i % 3) * 0.3, 0.58 - Math.floor(i / 3) * 0.25);
    if (level >= 3) put(out, slip(level === 4), 1.05 * R, 0.45, 0.6 * R, 0.45);
  } else if (kind === 'stone') {
    for (let i = 0; i < Math.min(level, 3); i++) {
      placeAt(derrick(), 0.85, -0.15 + i * 0.24, 1.1, 0.045);
      placeAt(blocks(3 + level), 1.0, -0.1 + i * 0.24);
    }
    placeAt(keep(), layout.landmark[0], layout.landmark[1], level === 4 ? 1.25 : 0.7);
  } else {
    placeAt(windmill(), 1.0, -0.5, 1.25, 0.07);
    if (level >= 3) placeAt(windmill(), -1.15, -0.4, 1.25, 0.07);
    if (level >= 2) placeAt(barn(), 0.85, -0.05);
    if (level >= 3) placeAt(granary(), -0.9, -0.65);
    if (level >= 3) placeAt(workshop(bakery()), 1.25, -0.05);
  }
  // Fields/forest are reserved outside the final town footprint at every level.
  const treesRng = createRng(spec.seed + 789);
  const forest: { x: number; z: number }[] = [];
  for (let i = 0; i < 650; i++) {
    const x = range(treesRng, -1.7, 1.7),
      z = range(treesRng, -1.3, 0.7);
    const h = layoutGround(layout, x, z, 0.08);
    if (h === null || plots.some((p) => Math.hypot(p.x / R - x, p.z / R - z) < 0.16)) continue;
    if (
      kind === 'grain' &&
      [
        [-0.9, -0.65],
        [1, -0.5],
        [-1.15, -0.4],
      ].some(([cx, cz]) => Math.hypot(x - cx!, z - cz!) < 0.2)
    )
      continue;
    if (Math.hypot(x - layout.landmark[0], z - layout.landmark[1]) < 0.25) continue;
    if (
      kind === 'timber' &&
      z < -0.23 &&
      !forest.some((p) => Math.hypot(p.x - x, p.z - z) < 0.11)
    ) {
      put(out, pine(treesRng), x * R, h * R, z * R, treesRng() * 6, 1.8);
      forest.push({ x, z });
    } else if (i < 22 && z < -0.4)
      put(out, kind === 'stone' ? pine(treesRng) : broadleaf(treesRng), x * R, h * R, z * R, 0, 1);
  }
  if (kind === 'grain') {
    let fields = 0;
    for (let z = -1.04; z < 0.65; z += 0.32)
      for (let x = -1.5; x < 1.6; x += 0.32) {
        const h = layoutGround(layout, x, z, 0.17);
        if (
          [
            [0.85, -0.05],
            [1.25, -0.05],
            [-0.9, -0.65],
            [-0.35, -0.25],
            [-0.2, 0.5],
          ].some(([cx, cz]) => Math.hypot(x - cx!, z - cz!) < 0.33)
        )
          continue;
        if (
          h === null ||
          plots.some((p) => Math.hypot(p.x / R - x, p.z / R - z) < 0.28) ||
          Math.hypot(x - 1, z + 0.5) < 0.3 ||
          Math.hypot(x + 1.15, z + 0.4) < 0.3
        )
          continue;
        if (fields++ >= [3, 7, 13, 22][level - 1]!) continue;
        put(
          out,
          [
            box(R * 0.28, 0.07, R * 0.28, 0, 0.035, 0, C.crops[fields % 5]!),
            box(R * 0.26, 0.03, 0.05, 0, 0.09, 0, C.furrow),
          ],
          x * R,
          h * R,
          z * R,
        );
      }
  }
  return out;
}
