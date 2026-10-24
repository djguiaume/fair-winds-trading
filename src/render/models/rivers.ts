import * as THREE from 'three';
import type { RiverDef } from '../../data/islands';
import { type IslandLayout, fallsBetween, surfaceHeight } from '../../sim/islandLayout';
import { glowing, paint } from './geometry';

/**
 * Rivers of water and lava (decision 0167), in reference units round the island's origin: a
 * ribbon that lies on the land, falls as a sheet where the ground drops at a cliff, and ends in the
 * sea with foam (water) or steam (lava). Lava is drawn as glowing parts, so it shares the lit
 * windows' material: dull red by day, bright at night, with no extra draw call.
 */

/** Colours: water as the lake; lava's bright core, its dark crust and the steam. */
export const RIVER_COLORS = {
  water: '#319eae',
  white: '#e4f4f6',
  lava: '#ff6a2a',
  crust: '#4a1c14',
  steam: '#f4f2ee',
};

/** How far a river lies above the land. */
const LIFT = 0.05;
/** Samples per island-radius unit along the river. */
const SAMPLES = 90;

type Parts = THREE.BufferGeometry[];
type P3 = [number, number, number];

/** Triangles from a flat list of corners; `up` winds each to face up, else both faces. */
function mesh(tris: P3[], up: boolean) {
  const positions: number[] = [];
  for (let i = 0; i < tris.length; i += 3) {
    const [a, b, c] = [tris[i]!, tris[i + 1]!, tris[i + 2]!];
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (up) positions.push(...a, ...(ny >= 0 ? [...b, ...c] : [...c, ...b]));
    else positions.push(...a, ...b, ...c, ...a, ...c, ...b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return g;
}

/** Where a river runs, in island-radius units: points along it and the land's height there. */
export function riverSamples(layout: IslandLayout, river: RiverDef) {
  const pts = river.points.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve =
    pts.length > 2
      ? new THREE.CatmullRomCurve3(pts, false, 'centripetal')
      : new THREE.LineCurve3(pts[0]!, pts[1]!);
  const n = Math.max(2, Math.ceil(curve.getLength() * SAMPLES));
  const out: { x: number; z: number; h: number | null }[] = [];
  for (const p of curve.getSpacedPoints(n)) {
    const h = surfaceHeight(layout, p.x, p.z);
    out.push({ x: p.x, z: p.z, h });
    // The river ends where it first reaches the sea or the lake.
    if (h === null) break;
  }
  return out;
}

/** One river's parts at island radius R (reference units). */
export function riverParts(layout: IslandLayout, river: RiverDef, R: number): Parts {
  const samples = riverSamples(layout, river);
  if (samples.length < 2) return [];
  const lava = river.kind === 'lava';
  // Lava's crust shows as a dark edge either side of the glowing core.
  const bands = lava
    ? [
        { half: river.width * 0.75, lift: LIFT * 0.6, color: RIVER_COLORS.crust, glow: false },
        { half: river.width * 0.42, lift: LIFT, color: RIVER_COLORS.lava, glow: true },
      ]
    : [{ half: river.width * 0.5, lift: LIFT, color: RIVER_COLORS.water, glow: false }];
  const y = (h: number | null) => (h === null ? -0.15 : h * R);
  // Falls at cliff edges, and off the land into the sea when the ground meets the water high.
  const drops = samples.map((b, i) => {
    const a = samples[i - 1];
    if (!a) return false;
    if (b.h === null) return (a.h ?? 0) * R > 0.5;
    return a.h !== null && fallsBetween(layout, a.x, a.z, b.x, b.z);
  });
  const fallsAt = (i: number) => drops[i]!;
  const out: Parts = [];
  for (const band of bands) {
    const flat: P3[] = [];
    const falls: P3[] = [];
    const side = (i: number) => {
      const a = samples[Math.max(0, i - 1)]!,
        b = samples[Math.min(samples.length - 1, i + 1)]!;
      const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      return [(-(b.z - a.z) / l) * band.half * R, ((b.x - a.x) / l) * band.half * R] as const;
    };
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1]!,
        b = samples[i]!;
      const [ax, az] = side(i - 1),
        [bx, bz] = side(i);
      const ya = y(a.h) + band.lift,
        yb = y(b.h) + band.lift;
      const A = [a.x * R, a.z * R],
        B = [b.x * R, b.z * R];
      const quad = (p: number[], q: number[], yp: number, yq: number) => {
        const pl: P3 = [p[0]! + ax, yp, p[1]! + az],
          pr: P3 = [p[0]! - ax, yp, p[1]! - az],
          ql: P3 = [q[0]! + bx, yq, q[1]! + bz],
          qr: P3 = [q[0]! - bx, yq, q[1]! - bz];
        flat.push(pl, pr, qr, pl, qr, ql);
      };
      if (!fallsAt(i)) {
        quad(A, B, ya, yb);
        continue;
      }
      // A cliff between two samples: level to the edge, a falling sheet, level again.
      const M = [(A[0]! + B[0]!) / 2, (A[1]! + B[1]!) / 2];
      quad(A, M, ya, ya);
      quad(M, B, yb, yb);
      const [mx, mz] = [(ax + bx) / 2, (az + bz) / 2];
      const top = Math.max(ya, yb),
        bottom = Math.min(ya, yb);
      const l: P3 = [M[0]! + mx, top, M[1]! + mz],
        r: P3 = [M[0]! - mx, top, M[1]! - mz];
      const lb: P3 = [l[0], bottom, l[2]],
        rb: P3 = [r[0], bottom, r[2]];
      falls.push(l, r, rb, l, rb, lb);
      // Foam or steam where it lands.
      out.push(...splash(lava, B[0]!, bottom, B[1]!, river.width * R, band.glow));
    }
    const ribbon = paint(mesh(flat, true), band.color);
    out.push(band.glow ? glowing(ribbon) : ribbon);
    if (falls.length) {
      const sheet = paint(mesh(falls, false), lava ? band.color : RIVER_COLORS.white);
      out.push(band.glow ? glowing(sheet) : sheet);
    }
  }
  const mouth = samples[samples.length - 1]!;
  if (mouth.h === null)
    out.push(...splash(lava, mouth.x * R, 0, mouth.z * R, river.width * R, false, true));
  for (const g of out) if (!g.userData.window) g.userData.islandTerrain = true;
  return out;
}

/**
 * Where a river lands: a ring of foam for water, a few puffs of steam for lava (only once, on
 * the crust band, so the core does not double them). `sea` makes lava's steam taller.
 */
function splash(
  lava: boolean,
  x: number,
  y: number,
  z: number,
  width: number,
  core: boolean,
  sea = false,
): Parts {
  if (lava && core) return [];
  if (!lava) {
    const foam = new THREE.CircleGeometry(width * 0.9, 7).rotateX(-Math.PI / 2);
    return [paint(foam.translate(x, y + LIFT * 1.5, z), RIVER_COLORS.white)];
  }
  const puffs = sea ? 3 : 2;
  const out: Parts = [];
  for (let i = 0; i < puffs; i++) {
    const r = width * (0.45 + i * 0.15);
    const g = new THREE.IcosahedronGeometry(r, 0).translate(
      x + (i % 2 ? 0.3 : -0.25) * width,
      y + r * 0.8 + i * width * 0.9,
      z + (i % 3 ? 0.2 : -0.2) * width,
    );
    out.push(paint(g, RIVER_COLORS.steam));
  }
  return out;
}
