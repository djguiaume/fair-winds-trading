import * as THREE from 'three';
import type { IslandDef, MapDef } from '../../sim/map';
import { bearingTo } from '../../sim/math';
import { type Rng, createRng, range } from '../../sim/rng';
import { PALETTE } from '../palette';
import { jitterRadial, mergeAll, paint, place, vertexColorMaterial } from './geometry';
import type { IslandsBuilder } from './types';

function jitter(rng: Rng, n: number, amount: number): number[] {
  return Array.from({ length: n }, () => 1 + (rng() - 0.5) * amount);
}

/** Trees and houses are drawn larger than life so they read next to the boats. */
const PROP_SCALE = 1.6;

/** Map position → three.js: sim north (+y) is -Z. */
const toScene = (x: number, y: number) => new THREE.Vector3(x, 0, -y);

function tree(rng: Rng, x: number, y: number, z: number, s: number): THREE.BufferGeometry[] {
  const h = range(rng, 0.85, 1.25) * s;
  return [
    paint(
      place(new THREE.CylinderGeometry(0.18, 0.28, 1.8, 5), x, y + 0.9 * h, z, 0, h),
      PALETTE.trunk,
    ),
    paint(
      place(new THREE.ConeGeometry(1.35, 1.7, 6), x, y + 2.2 * h, z, rng() * 6, h),
      PALETTE.leaves,
    ),
    paint(
      place(new THREE.ConeGeometry(1.0, 1.3, 6), x, y + 3.0 * h, z, rng() * 6, h),
      PALETTE.grassDark,
    ),
  ];
}

function house(
  rng: Rng,
  i: number,
  x: number,
  y: number,
  z: number,
  rot: number,
  s: number,
): THREE.BufferGeometry[] {
  const w = range(rng, 1.8, 2.5) * s;
  const d = range(rng, 1.8, 2.3) * s;
  const h = range(rng, 1.4, 2.0) * s;
  const walls = new THREE.BoxGeometry(w, h, d);
  walls.rotateY(rot);
  const roof = new THREE.ConeGeometry(Math.max(w, d) * 0.82, 1.3 * s, 4);
  roof.rotateY(Math.PI / 4 + rot);
  return [
    paint(place(walls, x, y + h / 2, z), PALETTE.walls[i % PALETTE.walls.length]!),
    paint(place(roof, x, y + h + 0.65 * s, z), PALETTE.roofs[i % PALETTE.roofs.length]!),
  ];
}

function islandParts(island: IslandDef, map: MapDef, seed: number): THREE.BufferGeometry[] {
  const rng = createRng(seed);
  const c = toScene(island.x, island.y);
  const R = island.radius;
  const look = island.look ?? {};
  const parts: THREE.BufferGeometry[] = [];

  // Beach: a jittered sand drum from below the waves to just above them.
  const sand = jitterRadial(
    new THREE.CylinderGeometry(R * 1.02, R * 1.25, 2.4, 18),
    jitter(rng, 18, 0.16),
  );
  parts.push(paint(place(sand, c.x, -0.6, c.z), PALETTE.sand));
  // Grass plateau, and a second tier on bigger islands.
  const grassR = R * 0.74;
  const grass = jitterRadial(
    new THREE.CylinderGeometry(grassR, grassR * 1.1, 1.4, 12),
    jitter(rng, 12, 0.22),
  );
  parts.push(paint(place(grass, c.x, 1.2, c.z), PALETTE.grass));
  const top = 1.9;
  if (R > 14) {
    const hill = jitterRadial(
      new THREE.CylinderGeometry(R * 0.4, R * 0.5, 1.6, 9),
      jitter(rng, 9, 0.3),
    );
    parts.push(paint(place(hill, c.x - R * 0.12, top + 0.8, c.z - R * 0.1), PALETTE.grassDark));
  }
  if (look.rock) {
    const rock = new THREE.DodecahedronGeometry(R * 0.42, 0);
    parts.push(
      paint(
        place(rock, c.x + R * 0.15, top + R * 0.2, c.z - R * 0.1, rng() * 6, [1, 1.3, 1]),
        PALETTE.rock,
      ),
    );
  }

  // Dock faces the course buoy named after this island, else a seeded direction.
  const wp = map.course.find((w) => w.label === island.name);
  const dockBearing = wp ? bearingTo(island, wp) : rng() * Math.PI * 2;
  const dockDir = new THREE.Vector3(Math.sin(dockBearing), 0, -Math.cos(dockBearing));
  const yaw = Math.atan2(dockDir.x, dockDir.z);
  if (look.dock) {
    const len = 8;
    const mid = c.clone().addScaledVector(dockDir, R * 0.95 + len / 2);
    parts.push(
      paint(place(new THREE.BoxGeometry(3, 0.4, len), mid.x, 0.9, mid.z, yaw), PALETTE.wood),
    );
    for (const s of [-1, 1]) {
      const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(s * 1.4);
      for (const t of [0.15, 0.85]) {
        const p = c
          .clone()
          .addScaledVector(dockDir, R * 0.95 + len * t)
          .add(side);
        parts.push(
          paint(place(new THREE.CylinderGeometry(0.16, 0.16, 2.2, 5), p.x, 0.2, p.z), PALETTE.mast),
        );
      }
    }
  }

  // Town: houses in a loose cluster on the dock side.
  const houses = look.houses ?? 0;
  for (let i = 0; i < houses; i++) {
    const a = dockBearing + (i - (houses - 1) / 2) * 0.42 + range(rng, -0.1, 0.1);
    const d = grassR * range(rng, 0.45, 0.72);
    const p = c.clone().add(new THREE.Vector3(Math.sin(a) * d, 0, -Math.cos(a) * d));
    parts.push(...house(rng, i, p.x, top, p.z, range(rng, -0.4, 0.4), PROP_SCALE));
  }

  // Trees anywhere on the plateau except right on the town.
  const trees = look.trees ?? 0;
  for (let i = 0; i < trees; i++) {
    let a = rng() * Math.PI * 2;
    if (houses && Math.abs(Math.atan2(Math.sin(a - dockBearing), Math.cos(a - dockBearing))) < 0.9)
      a += Math.PI;
    const d = grassR * Math.sqrt(rng()) * 0.8;
    parts.push(
      ...tree(
        rng,
        c.x + Math.sin(a) * d,
        top,
        c.z - Math.cos(a) * d,
        (R > 12 ? 1.25 : 1) * PROP_SCALE,
      ),
    );
  }
  return parts;
}

/** Placeholder islands in the mockup's style, all merged into one mesh (one draw call). */
export const buildPlaceholderIslands: IslandsBuilder = (map, { shadows }) => {
  const parts = map.islands.flatMap((island, i) => islandParts(island, map, map.seed * 1000 + i));
  const mesh = new THREE.Mesh(mergeAll(parts), vertexColorMaterial());
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  return mesh;
};
