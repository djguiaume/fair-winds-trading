import * as THREE from 'three';
import { type Rng, range } from '../../sim/rng';
import type { IslandTheme } from '../../sim/islandLayout';
import type { IslandStyle } from '../../data/islands';
import { glowing, paint, windowPanes } from './geometry';
import { landmarkParts } from './landmarks';

/**
 * The prop catalogue (decision 0101): the low-poly buildings and props of the port towns, and
 * the type ids island files place them by. Models are in reference units, front toward +Z.
 */
export type Parts = THREE.BufferGeometry[];
export type Kind = 'fish' | 'timber' | 'grain' | 'stone' | 'yard';

export const C = {
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
export const STYLE: Record<Kind, { walls: string[]; roofs: string[] }> = {
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

export const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: string) =>
  paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);

export const cyl = (
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
export function gable(w: number, d: number, h: number, y: number, c: string) {
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
export function hip(w: number, d: number, h: number, y: number, c: string) {
  const g = new THREE.CylinderGeometry(0, 0.72, h, 4, 1).rotateY(Math.PI / 4);
  g.scale(w / 1.02, 1, d / 1.02);
  return paint(g.translate(0, y + h / 2, 0), c);
}

/** Moves parts to (x, y, z), turned by rotY and scaled. */
export function put(out: Parts, parts: Parts, x: number, y: number, z: number, rotY = 0, s = 1) {
  for (const g of parts) out.push(g.scale(s, s, s).rotateY(rotY).translate(x, y, z));
}

// ---------------------------------------------------------------- buildings

/** Tall narrow harbour house with a steep gable. */
export function fishHouse(i: number, rng: Rng): Parts {
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
export function cabin(i: number, rng: Rng): Parts {
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
export function farmhouse(i: number): Parts {
  const { walls, roofs } = STYLE.grain;
  return [
    box(1.6, 0.75, 0.85, 0, 0.375, 0, walls[i % 3]!),
    hip(1.85, 1.1, 0.75, 0.75, roofs[i % 3]!),
    ...windowPanes(1.6, 0.85, 0.42, 3, 1, i),
  ];
}

export function barn(): Parts {
  return [
    box(1.6, 1.0, 1.1, 0, 0.5, 0, '#a8432f'),
    gable(1.75, 1.3, 0.8, 1.0, '#6b3a2a'),
    box(0.6, 0.7, 0.04, 0, 0.35, 0.56, '#f4ead2'),
  ];
}

/** Grey stone house under slate; every third one has a little tower. */
export function stoneHouse(i: number): Parts {
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

export function yardHouse(i: number): Parts {
  const { walls, roofs } = STYLE.yard;
  return [
    box(1.1, 0.85, 0.9, 0, 0.42, 0, walls[i % 3]!),
    gable(1.25, 1.05, 0.55, 0.85, roofs[i % 3]!),
    ...windowPanes(1.1, 0.9, 0.48, 2, 1, i),
  ];
}

export function pine(rng: Rng): Parts {
  const s = range(rng, 0.8, 1.3);
  const parts = [cyl(0.08 * s, 0.12 * s, 0.5 * s, 0, 0.25 * s, 0, C.trunk, 5)];
  for (let i = 0; i < 3; i++)
    parts.push(cyl(0, (0.62 - i * 0.15) * s, 0.9 * s, 0, (0.7 + i * 0.42) * s, 0, C.pine[i]!, 6));
  return parts;
}

export function broadleaf(rng: Rng): Parts {
  const s = range(rng, 0.8, 1.2);
  const crown = new THREE.IcosahedronGeometry(0.6 * s, 0).translate(0, 1.0 * s, 0);
  return [
    cyl(0.08 * s, 0.11 * s, 0.7 * s, 0, 0.35 * s, 0, C.trunk, 5),
    paint(crown, C.leaves[Math.floor(rng() * 3)]!),
  ];
}

export function windmill(): Parts {
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

export function rack(): Parts {
  return [
    box(1.3, 0.06, 0.06, 0, 0.9, 0, C.post),
    box(0.06, 0.9, 0.06, -0.6, 0.45, 0, C.post),
    box(0.06, 0.9, 0.06, 0.6, 0.45, 0, C.post),
    box(1.2, 0.45, 0.05, 0, 0.62, 0, '#c9b48a'),
  ];
}

export function smokehouse(): Parts {
  return [
    box(1.0, 0.9, 0.8, 0, 0.45, 0, '#5a4636'),
    gable(1.1, 0.95, 0.5, 0.9, '#3d2f25'),
    box(0.3, 0.6, 0.3, 0, 1.4, 0, C.chimney),
  ];
}

/** Open-sided fish market hall on posts. */
export function marketHall(): Parts {
  const parts = [
    box(2.4, 0.08, 1.4, 0, 0.04, 0, C.stone),
    gable(2.7, 1.7, 0.8, 1.1, STYLE.fish.roofs[0]!),
  ];
  for (const x of [-1.1, 0, 1.1])
    for (const z of [-0.6, 0.6]) parts.push(box(0.12, 1.1, 0.12, x, 0.55, z, C.post));
  return parts;
}

/** A small fishing boat at its mooring, mast up. */
export function fishingBoat(): Parts {
  const hull = new THREE.CylinderGeometry(0.5, 0.35, 2.0, 6, 1).rotateX(Math.PI / 2);
  hull.scale(1, 0.5, 1).translate(0, 0.1, 0);
  return [
    paint(hull, '#3f74a8'),
    box(0.6, 0.06, 1.5, 0, 0.32, 0, C.plank),
    cyl(0.04, 0.05, 1.8, 0, 1.2, -0.2, C.post, 4),
  ];
}

export function logPile(): Parts {
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

export function sawmill(): Parts {
  const wheel = new THREE.CylinderGeometry(0.6, 0.6, 0.15, 10).rotateZ(Math.PI / 2);
  return [
    box(1.8, 1.0, 1.1, 0, 0.5, 0, '#8a5a32'),
    gable(2.0, 1.3, 0.6, 1.0, '#5a3d24'),
    paint(wheel.translate(1.0, 0.55, 0), C.wood),
  ];
}

export function lumber(): Parts {
  const parts: Parts = [];
  for (let i = 0; i < 4; i++)
    parts.push(box(1.4, 0.12, 0.7, 0, 0.06 + i * 0.13, 0, i % 2 ? '#d2a86a' : '#c49658'));
  return parts;
}

/** A ship on the stocks: keel and ribs, then a planked hull. */
export function slip(planked: boolean): Parts {
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
export function woodlandTree(kind: IslandTheme, rng: Rng): Parts {
  return prepareWoodlandTree(kind, rng)();
}

/** Consume the model's random draws now; allocate geometry only if the scatter accepts it. */
function prepareWoodlandTree(kind: IslandTheme, rng: Rng): () => Parts {
  const s = range(rng, 0.8, 1.3);
  const conifer = kind === 'timber' || kind === 'stone';
  const leaves = conifer ? undefined : C.leaves[Math.floor(rng() * 3)]!;
  return () => {
    const trunk = paint(
      new THREE.CylinderGeometry(0.07 * s, 0.1 * s, 0.7 * s, 3, 1, true).translate(0, 0.35 * s, 0),
      C.trunk,
    );
    if (conifer)
      return [
        trunk,
        paint(
          new THREE.ConeGeometry(0.62 * s, 1.15 * s, kind === 'timber' ? 4 : 5, 1, true).translate(
            0,
            0.95 * s,
            0,
          ),
          C.pine[0]!,
        ),
        paint(
          new THREE.ConeGeometry(0.4 * s, 1.0 * s, kind === 'timber' ? 4 : 5, 1, true).translate(
            0,
            1.55 * s,
            0,
          ),
          C.pine[1]!,
        ),
      ];
    return [trunk, paint(new THREE.IcosahedronGeometry(0.65 * s, 0).translate(0, s, 0), leaves!)];
  };
}

/** Open timber workshops with readable machinery and stacked planks. */
export function timberWorkshop(store: boolean): Parts {
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

export function workingSawmill(): Parts {
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
export function workingSlip(planked: boolean): Parts {
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
export function bakery(): Parts {
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
export function masons(): Parts {
  const parts = [
    gable(1.8, 1.3, 0.55, 1.0, STYLE.stone.roofs[0]!),
    box(0.7, 0.5, 0.5, 0, 0.25, 0, C.cut),
    ...blocks(4).map((g) => g.translate(0, 0, 1.0)),
  ];
  for (const x of [-0.8, 0.8])
    for (const z of [-0.55, 0.55]) parts.push(box(0.12, 1.0, 0.12, x, 0.5, z, C.post));
  return parts;
}

export function haystack(): Parts {
  return [cyl(0, 0.5, 0.9, 0, 0.45, 0, C.hay, 7)];
}

export function granary(): Parts {
  return [
    cyl(0.55, 0.55, 1.6, 0, 0.8, 0, '#e4d6b8', 10),
    cyl(0, 0.65, 0.6, 0, 1.9, 0, '#a8432f', 10),
  ];
}

export function spireChurch(): Parts {
  return [
    box(1.0, 1.0, 2.0, 0, 0.5, 0, '#f4ede0'),
    gable(2.1, 1.15, 0.7, 1.0, '#8a4a2a'),
    box(0.7, 2.0, 0.7, 0, 1.0, 1.2, '#f4ede0'),
    cyl(0, 0.52, 1.6, 0, 2.8, 1.2, '#5f6f7d', 4),
  ];
}

export function keep(): Parts {
  const parts = [box(1.6, 3.0, 1.6, 0, 1.5, 0, '#cfc4b0'), ...windowPanes(1.6, 1.6, 2.2, 1, 1, 1)];
  for (const x of [-0.6, 0, 0.6])
    for (const z of [-0.6, 0.6]) parts.push(box(0.35, 0.35, 0.35, x, 3.17, z, '#cfc4b0'));
  parts.push(cyl(0.03, 0.03, 1.4, 0, 3.7, 0, C.post, 4));
  parts.push(box(0.04, 0.35, 0.6, 0, 4.2, 0.3, C.flag));
  return parts;
}

/** A timber derrick crane for lifting blocks. */
export function derrick(): Parts {
  const boom = new THREE.BoxGeometry(0.1, 0.1, 2.4).rotateX(-0.6).translate(0, 1.9, 0.8);
  return [
    cyl(0.07, 0.09, 2.6, 0, 1.3, 0, C.post, 5),
    paint(boom, C.post),
    box(0.02, 0.9, 0.02, 0, 1.9, 1.75, C.post),
    box(0.45, 0.35, 0.45, 0, 1.3, 1.75, C.cut),
  ];
}

export function blocks(n: number): Parts {
  const parts: Parts = [];
  for (let i = 0; i < n; i++) {
    const x = (i % 3) * 0.55 - 0.55;
    parts.push(box(0.5, 0.4, 0.5, x, 0.2 + Math.floor(i / 3) * 0.4, 0, i % 2 ? C.cut : C.stone));
  }
  return parts;
}

export function crates(n: number): Parts {
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

export function warehouse(roof: string): Parts {
  return [box(2.0, 1.1, 1.2, 0, 0.55, 0, C.wood), gable(2.2, 1.4, 0.55, 1.1, roof)];
}

export function lampPost(): Parts {
  return [
    cyl(0.04, 0.05, 1.3, 0, 0.65, 0, C.post, 4),
    glowing(box(0.2, 0.25, 0.2, 0, 1.4, 0, C.lamp)),
  ];
}

// ---------------------------------------------------------------- the catalogue

export interface PropArgs {
  /** The island's radius in reference units, for props sized in radius units. */
  R: number;
  style: IslandStyle;
  variant: number;
  shape: number;
  size: number;
  length?: number;
}

export type PropGroup =
  'homes' | 'town' | 'timber' | 'fish' | 'farm' | 'stone' | 'nature' | 'landmarks';

export interface PropType {
  group: PropGroup;
  build: (a: PropArgs) => Parts;
  /** A residence: numbered in file order, lanes grow near it, it clears woods round it. */
  home?: boolean;
  /** Buildings must not overlap each other (a warning in the checks). */
  building?: boolean;
  /** Stands in the sea, outside every coast. */
  water?: boolean;
  /** The model takes `size` itself rather than being scaled (the landmarks). */
  sizedInModel?: boolean;
  /** Footprint radius in reference units at size 1, where it is not the model's own extent. */
  fit?: number;
  /** Footprint radius in island-radius units, for props sized by the island (fields). */
  fitRadius?: number;
  /** May overhang a ledge or the water (slipways, rails, paving): only its centre is checked. */
  edge?: boolean;
}

/** A constant "random" draw, so a seeded model takes its shape from the file instead. */
const drawn =
  (shape: number): Rng =>
  () =>
    shape;

/** Drying rack hung with fish. */
function dryingRack(): Parts {
  const parts = rack();
  for (let f = 0; f < 5; f++)
    parts.push(cyl(0.04, 0.1, 0.3, -0.45 + f * 0.22, 0.55, 0.06, '#cad7d5', 5));
  return parts;
}

/** A fishing boat at her mooring with spar, furled net and buoys; her hull is solid (0082). */
function mooredBoat(): Parts {
  const boat = fishingBoat();
  boat.push(box(1.2, 0.07, 0.07, 0, 1.7, -0.2, C.post));
  for (let n = 0; n < 4; n++)
    boat.push(cyl(0.07, 0.07, 0.18, -0.4 + n * 0.25, 0.5, 0.35, '#e2c160', 5));
  boat.push(box(0.5, 0.16, 0.6, 0, 0.43, 0.55, '#aaa88b'));
  boat[0]!.userData.solid = 'boat';
  return boat;
}

/** A crop field, 0.28 radius units square, with its furrows. */
function field({ R, variant }: PropArgs): Parts {
  const patch = [box(R * 0.28, 0.07, R * 0.28, 0, 0.035, 0, C.crops[variant % 5]!)];
  for (let row = -2; row <= 2; row++)
    patch.push(
      paint(
        new THREE.PlaneGeometry(R * 0.26, 0.035)
          .rotateX(-Math.PI / 2)
          .translate(0, 0.085, row * R * 0.045),
        C.furrow,
      ),
    );
  return patch;
}

const landmark =
  (kind: 'lighthouse' | 'ruins' | 'wreck' | 'beacon') =>
  ({ size, variant }: PropArgs): Parts =>
    landmarkParts(kind, size, variant);

/** Every type an island file can place, by id. Homes' fits are the old town plan's margins. */
export const PROP_TYPES: Record<string, PropType> = {
  'fish-house': {
    group: 'homes',
    home: true,
    building: true,
    fit: 1.0 / 1.15,
    build: ({ variant, shape }) => fishHouse(variant, drawn(shape)),
  },
  cabin: {
    group: 'homes',
    home: true,
    building: true,
    fit: 1.1,
    build: ({ variant, shape }) => cabin(variant, drawn(shape)),
  },
  farmhouse: {
    group: 'homes',
    home: true,
    building: true,
    fit: 0.9 / 0.8,
    build: ({ variant }) => farmhouse(variant),
  },
  'stone-house': {
    group: 'homes',
    home: true,
    building: true,
    fit: 0.82 / 1.15,
    build: ({ variant }) => stoneHouse(variant),
  },
  'yard-house': { group: 'homes', home: true, building: true, build: (a) => yardHouse(a.variant) },
  warehouse: {
    group: 'town',
    building: true,
    build: ({ style }) => warehouse(STYLE[style].roofs[0]!),
  },
  'market-hall': { group: 'town', building: true, build: marketHall },
  'lamp-post': { group: 'town', build: lampPost },
  crates: { group: 'town', build: ({ variant }) => crates(variant || 2) },
  'spire-church': { group: 'town', building: true, build: spireChurch },
  bakery: { group: 'town', building: true, build: bakery },
  paving: {
    group: 'town',
    edge: true,
    build: ({ R, length }) => [
      paint(
        new THREE.PlaneGeometry(R * (length ?? 0.28), R * 0.055)
          .rotateX(-Math.PI / 2)
          .translate(0, 0.015, 0),
        '#c1af7c',
      ),
    ],
  },
  'log-pile': { group: 'timber', build: logPile },
  sawmill: { group: 'timber', building: true, build: workingSawmill },
  'cutting-shed': { group: 'timber', building: true, build: () => timberWorkshop(false) },
  'lumber-store': { group: 'timber', building: true, build: () => timberWorkshop(true) },
  slipway: { group: 'timber', edge: true, build: () => workingSlip(false) },
  'slipway-hull': { group: 'timber', edge: true, build: () => workingSlip(true) },
  lumber: { group: 'timber', build: lumber },
  'drying-rack': { group: 'fish', build: dryingRack },
  smokehouse: { group: 'fish', building: true, build: smokehouse },
  'moored-boat': { group: 'fish', water: true, build: mooredBoat },
  field: { group: 'farm', fitRadius: 0.17, build: field },
  windmill: { group: 'farm', building: true, build: windmill },
  barn: { group: 'farm', building: true, build: barn },
  granary: { group: 'farm', building: true, build: granary },
  haystack: { group: 'farm', build: haystack },
  masons: { group: 'stone', building: true, build: masons },
  derrick: { group: 'stone', build: derrick },
  'stone-blocks': { group: 'stone', build: ({ variant }) => blocks(variant || 3) },
  rail: {
    group: 'stone',
    edge: true,
    build: ({ R, length }) => [box(R * (length ?? 0.32), 0.035, 0.035, 0, 0.03, 0, C.post)],
  },
  keep: { group: 'stone', building: true, build: keep },
  pine: { group: 'nature', build: ({ shape }) => pine(drawn(shape)) },
  broadleaf: { group: 'nature', build: ({ shape }) => broadleaf(drawn(shape)) },
  'woodland-pine': { group: 'nature', build: ({ shape }) => woodlandTree('timber', drawn(shape)) },
  'woodland-fir': { group: 'nature', build: ({ shape }) => woodlandTree('stone', drawn(shape)) },
  'woodland-broadleaf': {
    group: 'nature',
    build: ({ shape }) => woodlandTree('fish', drawn(shape)),
  },
  lighthouse: {
    group: 'landmarks',
    building: true,
    sizedInModel: true,
    build: landmark('lighthouse'),
  },
  ruins: { group: 'landmarks', building: true, sizedInModel: true, build: landmark('ruins') },
  beacon: { group: 'landmarks', sizedInModel: true, build: landmark('beacon') },
  wreck: { group: 'landmarks', sizedInModel: true, build: landmark('wreck') },
  /** A sandstone rock, half sunk (the ridges' rocks, decision 0110). */
  boulder: {
    group: 'nature',
    build: ({ variant }) => [
      paint(
        new THREE.DodecahedronGeometry(1, 0).scale(1, 0.7, 1).translate(0, 0.35, 0),
        variant % 2 ? '#c2ad8c' : '#d6c4a4',
      ),
    ],
  },
};

/** Woodland model preparers draw seeded size and colour without building rejected candidates. */
export const WOODLAND_TREES: Record<string, (rng: Rng) => () => Parts> = {
  'woodland-pine': (rng) => prepareWoodlandTree('timber', rng),
  'woodland-fir': (rng) => prepareWoodlandTree('stone', rng),
  'woodland-broadleaf': (rng) => prepareWoodlandTree('fish', rng),
};
