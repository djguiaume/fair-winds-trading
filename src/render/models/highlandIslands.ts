import * as THREE from 'three';
import type { IslandDef, MapDef } from '../../sim/map';
import { bearingTo } from '../../sim/math';
import { type Rng, createRng, range } from '../../sim/rng';
import { mergeAll, paint, vertexColorMaterial } from './geometry';
import type { IslandsBuilder } from './types';

/**
 * B2 "Bright highlands" islands (decision 0012), ported from the reference builder in
 * docs/art/src/lib.js (`kit('highlandLight')`, `island`): a beach, stacked sandstone layers and a
 * grass cap, with props that show what the island produces. Every island of the map is merged
 * into one vertex-coloured mesh (one draw call). The shallows glow is drawn by the ocean shader.
 */
export const B2 = {
  sand: '#f2d9a0',
  grass: '#7cc04f',
  rock: '#c2ad8c',
  rock2: '#d6c4a4',
  field: ['#e8c547', '#c9d65a', '#e2b53e'],
  furrow: '#8f7a30',
  leaves: ['#3f8f45', '#4aa04f', '#38833f'],
  trunk: '#5a3d24',
  walls: ['#f4ede0', '#ece2cf', '#f8f3ea'],
  roofs: ['#c8603e', '#3f74a8', '#c8603e'],
  chimney: '#8a8174',
  dock: '#9b6b3d',
  post: '#6b4a2a',
  rack: '#b08a5a',
  logs: '#a8703c',
  mill: '#fff3dc',
  millCap: '#8a4a2a',
  blade: '#f4ead2',
  cart: '#8a6a4a',
};

/**
 * Islands are designed in the reference sheet's units, where a sloop is 5 m long; the game draws
 * the sloop 2.2× bigger, so islands and props scale the same way to keep the sheet's proportions.
 */
export const ISLAND_SCALE = 2.2;

type Parts = THREE.BufferGeometry[];

/** Jittered closed outline of radius ~R, stretched by sx/sz. */
function blobShape(rng: Rng, R: number, n: number, jit: number, sx: number, sz: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = R * (1 + (rng() - 0.5) * jit);
    const x = Math.cos(a) * r * sx;
    const y = Math.sin(a) * r * sz;
    if (i) s.lineTo(x, y);
    else s.moveTo(x, y);
  }
  s.closePath();
  return s;
}

/** Shape extruded up from y = 0 to y = h, its top scaled by k (a tapered cliff layer). */
function slab(shape: THREE.Shape, h: number, k = 1) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const f = 1 + (k - 1) * (p.getY(i) / h);
    p.setX(i, p.getX(i) * f);
    p.setZ(i, p.getZ(i) * f);
  }
  return g;
}

/** Move a group of parts to (x, y, z), turned by rotY. */
function put(out: Parts, parts: Parts, x: number, y: number, z: number, rotY = 0, scale = 1) {
  for (const g of parts) {
    if (scale !== 1) g.scale(scale, scale, scale);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    out.push(g);
  }
}

function tree(rng: Rng): Parts {
  const parts = [
    paint(new THREE.CylinderGeometry(0.08, 0.12, 0.6, 5).translate(0, 0.3, 0), B2.trunk),
  ];
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.ConeGeometry(0.65 - i * 0.16, 0.9, 6).rotateY(rng() * 2);
    parts.push(paint(cone.translate(0, 0.75 + i * 0.45, 0), B2.leaves[i]!));
  }
  const sc = 0.8 + rng() * 0.5;
  for (const g of parts) g.scale(sc, sc, sc);
  return parts;
}

function house(i: number): Parts {
  const roof = new THREE.CylinderGeometry(0, 0.75, 0.6, 4, 1).rotateY(Math.PI / 4);
  roof.scale(1.15, 1, 0.85);
  return [
    paint(new THREE.BoxGeometry(1.2, 0.9, 0.9).translate(0, 0.45, 0), B2.walls[i % 3]!),
    paint(roof.translate(0, 1.2, 0), B2.roofs[i % 3]!),
    paint(new THREE.BoxGeometry(0.18, 0.5, 0.18).translate(0.35, 1.3, 0), B2.chimney),
  ];
}

function logPile(): Parts {
  const parts: Parts = [];
  for (let i = 0; i < 5; i++) {
    const layer = Math.floor(i / 3);
    const log = new THREE.CylinderGeometry(0.18, 0.18, 1.6, 6).rotateZ(Math.PI / 2);
    log.translate(0, 0.18 + layer * 0.3, (i % 3) * 0.37 - 0.37 + layer * 0.18);
    parts.push(paint(log, B2.logs));
  }
  return parts;
}

function windmill(): Parts {
  const parts = [
    paint(new THREE.CylinderGeometry(0.45, 0.65, 2.2, 8).translate(0, 1.1, 0), B2.mill),
    paint(new THREE.ConeGeometry(0.6, 0.7, 8).translate(0, 2.55, 0), B2.millCap),
  ];
  for (let k = 0; k < 4; k++) {
    const blade = new THREE.BoxGeometry(0.25, 1.8, 0.05).translate(0, 0.9, 0);
    blade.rotateZ((k * Math.PI) / 2 + 0.4);
    parts.push(paint(blade.translate(0, 2.2, 0.55), B2.blade));
  }
  return parts;
}

/**
 * One island in reference units around its own origin, with its harbour side toward +Z.
 * Returns the parts, already scaled, turned and moved to the island's place on the map.
 */
export function islandParts(island: IslandDef, map: MapDef, seed: number): Parts {
  const rng = createRng(seed);
  const look = island.look ?? {};
  const kind = look.kind ?? map.ports.find((p) => p.islandId === island.id)?.produces[0];
  const R = island.radius / ISLAND_SCALE;
  const sx = 1 + (rng() - 0.5) * 0.16;
  const sz = 1 + (rng() - 0.5) * 0.16;
  const out: Parts = [];

  // Beach: from under the waves to just above them; its waterline sits on the collision radius.
  out.push(
    paint(slab(blobShape(rng, R * 1.1, 14, 0.2, sx, sz), 1.45, 0.85).translate(0, -1, 0), B2.sand),
  );

  // Sandstone layers, each stepped back from the harbour so the dock side stays low.
  const layers = kind === 'stone' ? 4 : kind === 'grain' ? 2 : kind ? 3 : look.rock ? 2 : 1;
  let y = 0;
  let ox = 0;
  let oz = 0;
  for (let i = 0; i < layers; i++) {
    const h = kind === 'stone' ? range(rng, 1.1, 1.5) : range(rng, 1.2, 1.8);
    ox += (rng() - 0.5) * R * 0.08;
    oz -= R * 0.05;
    const layer = slab(blobShape(rng, R * (0.9 - i * 0.15), 11, 0.3, sx, sz), h, 0.9);
    out.push(paint(layer.translate(ox, y, oz), i % 2 ? B2.rock2 : B2.rock));
    y += h;
  }
  const capR = R * (0.92 - layers * 0.15);
  out.push(
    paint(slab(blobShape(rng, capR, 11, 0.2, sx, sz), 0.25, 0.95).translate(ox, y, oz), B2.grass),
  );
  const top = y + 0.25;
  // Props sit on the cap: angle 0 = +X, π/2 = harbour (+Z); d is a fraction of the cap radius.
  const HARBOUR = Math.PI / 2;
  const at = (parts: Parts, a: number, d: number, rotY = 0, yOff = 0) =>
    put(
      out,
      parts,
      ox + Math.cos(a) * d * capR * sx,
      top + yOff,
      oz + Math.sin(a) * d * capR * sz,
      rotY,
    );

  if (look.dock) {
    const len = Math.min(R * 0.75, 4.5);
    const z0 = R * 0.85;
    out.push(
      paint(new THREE.BoxGeometry(0.9, 0.2, len).translate(R * 0.08, 0.45, z0 + len / 2), B2.dock),
    );
    for (const k of [-1, 1]) {
      for (const t of [0.35, 0.95]) {
        const post = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 5);
        out.push(paint(post.translate(R * 0.08 + k * 0.4, 0, z0 + len * t), B2.post));
      }
    }
    if (kind === 'fish') {
      // Fish-drying racks on stilts beside the pier.
      for (const k of [-1, 1]) {
        const rack = new THREE.BoxGeometry(1.2, 0.5, 0.1).rotateY(Math.PI / 2);
        out.push(paint(rack.translate(R * 0.08 + k * 1.05, 0.8, z0 + len * 0.55), B2.rack));
        out.push(
          paint(
            new THREE.BoxGeometry(0.1, 0.9, 0.1).translate(
              R * 0.08 + k * 1.05,
              0.2,
              z0 + len * 0.55,
            ),
            B2.post,
          ),
        );
      }
    }
  }

  const houses = look.houses ?? 0;
  const trees = look.trees ?? 0;
  if (kind === 'fish') {
    for (let i = 0; i < houses; i++) {
      at(house(i), HARBOUR + (i - (houses - 1) / 2) * 0.6, i % 2 ? 0.4 : 0.72, rng() * 3);
    }
    for (let i = 0; i < trees; i++) at(tree(rng), -HARBOUR + (i - (trees - 1) / 2) * 0.7, 0.62);
  } else if (kind === 'timber') {
    for (let i = 0; i < Math.max(trees, 14); i++) {
      const a = rng() * Math.PI * 2;
      // Leave a clearing on the harbour side for the log pile and the hut.
      if (Math.abs(Math.atan2(Math.sin(a - HARBOUR), Math.cos(a - HARBOUR))) < 0.6) continue;
      at(tree(rng), a, Math.sqrt(rng()) * 0.85, rng() * 3);
    }
    at(logPile(), HARBOUR - 0.35, 0.55, 0.3);
    for (let i = 0; i < Math.max(1, houses); i++)
      at(house(i + 1), HARBOUR + 0.45 + i * 0.5, 0.6, 0.5);
  } else if (kind === 'grain') {
    const w = capR * 0.32;
    for (let i = 0; i < 4; i++) {
      const fx = ox + (i - 1.5) * capR * 0.34;
      const fz = oz - capR * 0.15;
      out.push(
        paint(
          new THREE.BoxGeometry(w, 0.12, capR * 0.6).translate(fx, top + 0.05, fz),
          B2.field[i % 3]!,
        ),
      );
      for (let k = 0; k < 3; k++) {
        const furrow = new THREE.BoxGeometry(w * 0.94, 0.05, 0.06);
        out.push(paint(furrow.translate(fx, top + 0.13, fz + (k - 1) * capR * 0.18), B2.furrow));
      }
    }
    at(windmill(), HARBOUR + 0.8, 0.62, 0.4);
    for (let i = 0; i < Math.max(1, houses); i++)
      at(house(i + 2), HARBOUR - 0.8 + i * 0.45, 0.6, rng() * 3);
    for (let i = 0; i < trees; i++) at(tree(rng), -HARBOUR + (i - (trees - 1) / 2) * 0.5, 0.88);
  } else if (kind === 'stone') {
    for (let i = 0; i < 3; i++) {
      const boulder = new THREE.DodecahedronGeometry(R * (0.24 - i * 0.05), 0).scale(1, 1.3, 1);
      at([paint(boulder, i % 2 ? B2.rock2 : B2.rock)], i * 2.1, 0.45 * i, rng() * 3, R * 0.1);
    }
    for (let i = 0; i < houses; i++) at(house(i), HARBOUR - 0.5 - i * 0.5, 0.55, rng() * 3);
    for (let i = 0; i < trees; i++) at(tree(rng), 3 + i * 0.5, 0.75);
    at(
      [paint(new THREE.BoxGeometry(0.8, 0.4, 0.6).translate(0, 0.2, 0), B2.cart)],
      HARBOUR + 0.3,
      0.5,
      0.4,
    );
  } else {
    if (look.rock) {
      const boulder = new THREE.DodecahedronGeometry(R * 0.3, 0).scale(1, 1.3, 1);
      at([paint(boulder, B2.rock2)], rng() * 6, 0.2, rng() * 3, R * 0.12);
    }
    for (let i = 0; i < houses; i++)
      at(house(i), HARBOUR + (i - (houses - 1) / 2) * 0.6, 0.6, rng() * 3);
    for (let i = 0; i < trees; i++)
      at(tree(rng), rng() * Math.PI * 2, 0.3 + rng() * 0.5, rng() * 3);
  }

  // The harbour (+Z) faces the course buoy named after this island, else a seeded direction.
  const wp = map.course.find((w) => w.label === island.name);
  const bearing = wp ? bearingTo(island, wp) : rng() * Math.PI * 2;
  // rotateY(π - bearing) turns +Z to (sin b, 0, -cos b), the bearing's direction in the scene.
  for (const g of out) {
    g.scale(ISLAND_SCALE, ISLAND_SCALE, ISLAND_SCALE);
    g.rotateY(Math.PI - bearing);
    g.translate(island.x, 0, -island.y);
  }
  return out;
}

/** All islands of the map merged into one mesh. */
export const buildHighlandIslands: IslandsBuilder = (map, { shadows }) => {
  const parts = map.islands.flatMap((island, i) => islandParts(island, map, map.seed * 1000 + i));
  // Non-circular barriers use the very same outline as simulation collision.
  for (const feature of map.terrain ?? []) {
    const shape = new THREE.Shape(feature.outline.map(([x, y]) => new THREE.Vector2(x, y)));
    const bank = feature.kind === 'sandbank';
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: bank ? 1.2 : 3.6,
      bevelEnabled: false,
      curveSegments: 1,
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, -0.4, 0);
    const painted = paint(geometry, bank ? B2.sand : B2.rock);
    // Grass caps, sandstone sides. No overhanging visuals beyond the collision outline.
    if (!bank) {
      const normal = painted.attributes.normal!;
      const colors = painted.attributes.color!;
      const top = new THREE.Color(B2.grass);
      const side = new THREE.Color(B2.rock2);
      for (let i = 0; i < normal.count; i++) {
        const color = normal.getY(i) > 0.5 ? top : side;
        colors.setXYZ(i, color.r, color.g, color.b);
      }
    }
    parts.push(painted);
  }
  const mesh = new THREE.Mesh(mergeAll(parts), vertexColorMaterial());
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  return mesh;
};
