import * as THREE from 'three';
import { type Rng, range } from '../../sim/rng';
import { paint } from './geometry';

/**
 * Settlement growth (decision 0060): a port island's town grows in four steps, hamlet, village,
 * town and port town. Everything sits on a low waterfront shelf between the beach and the cliffs,
 * so the island keeps its collision outline and pier; only buildings and props are added.
 * House slots are seeded once per island and filled nearest the pier first, so a level-up adds
 * buildings without moving the ones already standing.
 */
export type TownLevel = 1 | 2 | 3 | 4;

type Parts = THREE.BufferGeometry[];

export const TOWN = {
  walls: ['#f4ede0', '#ece2cf', '#f8f3ea', '#f1e4c8'],
  roofs: ['#c8603e', '#3f74a8', '#c8603e', '#d98a4a'],
  timber: '#6b4a2a',
  chimney: '#8a8174',
  stone: '#d9cbb0',
  stoneDark: '#b49e7c',
  shed: '#9b6b3d',
  shedRoof: '#7a5a3a',
  slate: '#5f6f7d',
  awning: ['#c8603e', '#f4ead2'],
  crate: '#b08a5a',
  barrel: '#8a5a32',
  flag: '#c8603e',
  boat: '#3f74a8',
  path: '#e3cf9c',
};

/** Houses per level; the extra buildings come in at the level given below. */
export const TOWN_HOUSES: Record<TownLevel, number> = { 1: 2, 2: 4, 3: 7, 4: 10 };

const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: string) =>
  paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);

function roof(w: number, d: number, h: number, y: number, c: string) {
  const g = new THREE.CylinderGeometry(0, 0.72, h, 4, 1).rotateY(Math.PI / 4);
  g.scale(w / 1.02, 1, d / 1.02);
  return paint(g.translate(0, y + h / 2, 0), c);
}

/** A cottage; `storeys` 2 gives the taller town houses of level 3 and up. */
export function townHouse(i: number, storeys = 1): Parts {
  const h = storeys === 2 ? 1.5 : 0.9;
  const parts = [
    box(1.2, h, 0.9, 0, h / 2, 0, TOWN.walls[i % 4]!),
    roof(1.4, 1.05, 0.6, h, TOWN.roofs[i % 4]!),
    box(0.18, 0.5, 0.18, 0.35, h + 0.4, 0, TOWN.chimney),
  ];
  if (storeys === 2) parts.push(box(1.22, 0.08, 0.92, 0, 0.8, 0, TOWN.timber));
  return parts;
}

function warehouse(): Parts {
  return [
    box(2.2, 1.1, 1.3, 0, 0.55, 0, TOWN.shed),
    roof(2.5, 1.5, 0.55, 1.1, TOWN.shedRoof),
    box(0.7, 0.8, 0.05, 0, 0.4, 0.66, TOWN.timber),
  ];
}

function chapel(): Parts {
  return [
    box(1.0, 1.0, 1.9, 0, 0.5, 0, TOWN.stone),
    roof(1.15, 2.1, 0.6, 1.0, TOWN.slate),
    box(0.7, 2.2, 0.7, 0, 1.1, 1.1, TOWN.stone),
    roof(0.8, 0.8, 0.9, 2.2, TOWN.slate),
  ];
}

function townHall(): Parts {
  const parts = [
    box(2.4, 1.4, 1.5, 0, 0.7, 0, TOWN.stone),
    roof(2.7, 1.7, 0.6, 1.4, TOWN.roofs[1]!),
    box(0.8, 2.9, 0.8, 0, 1.45, 0, TOWN.stone),
    roof(0.95, 0.95, 0.8, 2.9, TOWN.roofs[1]!),
    box(0.5, 0.5, 0.06, 0, 2.5, 0.42, '#f8f3ea'),
    paint(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 4).translate(0, 4.2, 0), TOWN.timber),
    box(0.04, 0.35, 0.6, 0, 4.6, 0.3, TOWN.flag),
  ];
  return parts;
}

function stall(i: number): Parts {
  return [
    box(0.9, 0.5, 0.6, 0, 0.25, 0, TOWN.crate),
    box(1.0, 0.06, 0.8, 0, 0.95, 0.05, TOWN.awning[i % 2]!),
    box(0.06, 0.9, 0.06, -0.45, 0.45, 0.4, TOWN.timber),
    box(0.06, 0.9, 0.06, 0.45, 0.45, 0.4, TOWN.timber),
  ];
}

function crates(rng: Rng, n: number): Parts {
  const parts: Parts = [];
  for (let i = 0; i < n; i++) {
    const g =
      i % 3 === 2
        ? new THREE.CylinderGeometry(0.22, 0.22, 0.5, 6).translate(0, 0.25, 0)
        : new THREE.BoxGeometry(0.45, 0.45, 0.45).translate(0, 0.22, 0);
    g.rotateY(rng() * 2).translate((i % 3) * 0.5 - 0.5, i >= 3 ? 0.45 : 0, Math.floor(i / 3) * 0.1);
    parts.push(paint(g, i % 3 === 2 ? TOWN.barrel : TOWN.crate));
  }
  return parts;
}

/** A dockside crane: post, jib and a hanging load. */
function crane(): Parts {
  const jib = new THREE.BoxGeometry(0.14, 0.14, 2.2).rotateX(-0.5).translate(0, 2.6, 0.75);
  return [
    box(0.8, 0.3, 0.8, 0, 0.15, 0, TOWN.stoneDark),
    box(0.22, 2.6, 0.22, 0, 1.4, 0, TOWN.timber),
    paint(jib, TOWN.timber),
    box(0.03, 1.0, 0.03, 0, 2.6, 1.7, TOWN.timber),
    box(0.4, 0.35, 0.4, 0, 2.0, 1.7, TOWN.crate),
  ];
}

/** A rowing boat hauled up on the beach (out of the sea, so ships never sail through it). */
function rowboat(): Parts {
  const hull = new THREE.CylinderGeometry(0.42, 0.3, 1.6, 6, 1).rotateX(Math.PI / 2);
  hull.scale(1, 0.55, 1).translate(0, 0.18, 0);
  return [paint(hull, TOWN.boat), box(0.5, 0.06, 1.2, 0, 0.42, 0, TOWN.crate)];
}

export interface TownSite {
  rng: Rng;
  level: TownLevel;
  /** Island radius in reference units. */
  R: number;
  /** Radius (from the island centre) inside which the waterfront shelf is flat. */
  shelfR: number;
  /** Top of the shelf. */
  shelfY: number;
  /** Footprint of the lowest cliff layer, which the town must stay out of. */
  cliff: { x: number; z: number; r: number };
  /** Pier root on the beach (+Z is the harbour). */
  pierX: number;
  /** Cap of the cliffs, for the chapel or town hall. */
  cap: { x: number; y: number; z: number; r: number };
  /** Already taken ground on the shelf (producer props). */
  occupied: { x: number; z: number; r: number }[];
}

/**
 * Seeded slots on the shelf, nearest the pier first. The same site always gives the same slots,
 * whatever the level, so growing only adds buildings.
 */
function slots(site: TownSite, count: number, r: number) {
  const { R, rng, shelfR, cliff, pierX, occupied } = site;
  const out: { x: number; z: number }[] = [];
  const pier = { x: pierX, z: R * 0.85 };
  const candidates: { x: number; z: number }[] = [];
  for (let attempt = 0; attempt < 400; attempt++) {
    const a = range(rng, -Math.PI * 0.15, Math.PI * 1.15);
    const d = Math.sqrt(rng()) * shelfR;
    candidates.push({ x: Math.cos(a) * d, z: Math.sin(a) * d });
  }
  candidates.sort(
    (p, q) => Math.hypot(p.x - pier.x, p.z - pier.z) - Math.hypot(q.x - pier.x, q.z - pier.z),
  );
  for (const p of candidates) {
    if (out.length >= count) break;
    if (Math.hypot(p.x, p.z) > shelfR - r) continue;
    if (Math.hypot(p.x - cliff.x, p.z - cliff.z) < cliff.r + r) continue;
    // Keep a lane open up the pier.
    if (Math.abs(p.x - pierX) < 0.6 + r && p.z > R * 0.3) continue;
    if (Math.abs(p.z - R * 0.44) < 0.5 + r && Math.abs(p.x - pierX) < R * 0.5) continue;
    if (occupied.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < o.r + r)) continue;
    if (out.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < r * 2)) continue;
    out.push(p);
  }
  return out;
}

/** Faces a building toward the harbour (+Z) with a little seeded variety. */
const facing = (rng: Rng, x: number, z: number) => Math.atan2(x, z) * 0.6 + (rng() - 0.5) * 0.4;

/** Town buildings are drawn a little larger than the old fixed houses so they read at sea. */
const TOWN_SCALE = 1.3;

function put(out: Parts, parts: Parts, x: number, y: number, z: number, rotY: number) {
  for (const g of parts)
    out.push(g.scale(TOWN_SCALE, TOWN_SCALE, TOWN_SCALE).rotateY(rotY).translate(x, y, z));
}

/** The town at its level, in the island's reference units, harbour toward +Z. */
export function townParts(site: TownSite): Parts {
  const { level, R, rng, shelfY, pierX, cap, occupied } = site;
  const out: Parts = [];
  const quayZ = R * 0.86;

  // Landmark plots are reserved at every level so later buildings never move the houses.
  const hallAt = { x: pierX - R * 0.4, z: R * 0.46, r: 2.0 };
  const storeAt = { x: pierX + 2.3, z: R * 0.66, r: 1.7 };
  const stallsAt = { x: pierX - 2.0, z: R * 0.7, r: 1.3 };
  occupied.push(hallAt, storeAt, stallsAt);
  const homes = slots(site, TOWN_HOUSES[4], 0.9);

  for (let i = 0; i < Math.min(TOWN_HOUSES[level], homes.length); i++) {
    const p = homes[i]!;
    const tall = level >= 3 && i % 3 === 0;
    put(out, townHouse(i, tall ? 2 : 1), p.x, shelfY, p.z, facing(rng, p.x, p.z));
  }
  // A sandy street runs up from the pier; from level 3 a cross street joins it.
  const street = (w: number, d: number, x: number, z: number) =>
    out.push(box(w, 0.04, d, x, shelfY + 0.02, z, TOWN.path));
  if (level >= 2) street(0.9, R * 0.42, pierX, R * 0.62);
  if (level >= 3) street(R * 0.9, 0.8, pierX - R * 0.05, R * 0.44);
  if (level >= 2) {
    put(out, warehouse(), storeAt.x, shelfY, storeAt.z, 0.15);
    put(out, crates(rng, 4), storeAt.x - 0.6, shelfY, storeAt.z + 1.1, 0.1);
    put(out, rowboat(), pierX + R * 0.34, 0.4, R * 0.88, 0.5);
  }
  if (level >= 3) {
    // A stone quay along the shore either side of the pier, market stalls and a chapel.
    const half = R * 0.36;
    out.push(box(half * 2, 0.5, 0.7, pierX, shelfY - 0.2, quayZ, TOWN.stoneDark));
    out.push(box(half * 2, 0.06, 0.72, pierX, shelfY + 0.06, quayZ, TOWN.stone));
    for (let i = 0; i < 2; i++)
      put(out, stall(i), stallsAt.x + i * 1.1 - 0.5, shelfY, stallsAt.z, 0.1);
    put(out, chapel(), cap.x - cap.r * 0.35, cap.y, cap.z + cap.r * 0.45, 0.3);
    put(out, rowboat(), pierX - R * 0.4, 0.4, R * 0.86, -0.6);
  }
  if (level >= 4) {
    put(out, townHall(), hallAt.x, shelfY, hallAt.z, 0.2);
    put(out, crane(), pierX + R * 0.3, shelfY, quayZ - 0.1, 0);
    put(out, warehouse(), storeAt.x + 0.2, shelfY, storeAt.z - 1.7, 0.15);
    put(out, crates(rng, 6), pierX - R * 0.22, shelfY, quayZ - 0.5, 0);
  }
  return out;
}
