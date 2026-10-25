import * as THREE from 'three';
import type { RiverDef } from '../../data/islands';
import { type IslandLayout, fallsBetween, surfaceHeight } from '../../sim/islandLayout';
import { BEACH_TOP, molten, paint } from './geometry';

/**
 * Rivers of water and lava (decision 0176), in reference units round the island's origin: a
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
/** How much wider than the stream a waterfall's sheet is. */
const FALL_WIDE = 1.5;
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

/**
 * Where a river runs, in island-radius units: points along it, the land's height there and the
 * river's width (a point's own width, or the river's, eased between points along the curve).
 */
export function riverSamples(layout: IslandLayout, river: RiverDef) {
  // The width rides the curve as its y, so it eases smoothly from point to point.
  const pts = river.points.map(([x, z, w]) => new THREE.Vector3(x, w ?? river.width, z));
  const curve =
    pts.length > 2
      ? new THREE.CatmullRomCurve3(pts, false, 'centripetal')
      : new THREE.LineCurve3(pts[0]!, pts[1]!);
  const n = Math.max(2, Math.ceil(curve.getLength() * SAMPLES));
  const out: { x: number; z: number; h: number | null; w: number }[] = [];
  for (const p of curve.getSpacedPoints(n)) {
    const h = surfaceHeight(layout, p.x, p.z);
    out.push({ x: p.x, z: p.z, h, w: Math.max(0.002, p.y) });
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
  // Lava's crust shows as a dark edge either side of the glowing core. `half`: of the width.
  const bands = lava
    ? [
        { half: 0.75, lift: LIFT * 0.6, color: RIVER_COLORS.crust, glow: false },
        { half: 0.42, lift: LIFT, color: RIVER_COLORS.lava, glow: true },
      ]
    : [{ half: 0.5, lift: LIFT, color: RIVER_COLORS.water, glow: false }];
  // On the beach the land's top is the sand's, above the sea.
  const y = (h: number | null) => (h === null ? -0.15 : Math.max(h * R, BEACH_TOP));
  // Falls at cliff edges, and off the land into the sea when the ground meets the water high.
  const drops = samples.map((b, i) => {
    const a = samples[i - 1];
    if (!a) return false;
    if (b.h === null) return (a.h ?? 0) * R > 0.5;
    return a.h !== null && fallsBetween(layout, a.x, a.z, b.x, b.z);
  });
  const fallsAt = (i: number) => drops[i]!;
  // A water fall that lands on the beach just above the sea spills on over the shingle and off
  // its edge into the sea, so it never seems to stop in mid-air: from `spill` on, the river is
  // white foam on the beach, falls again at the water's edge, and its foam lies on the sea.
  let spill = samples.length;
  if (!lava && samples[samples.length - 1]!.h === null) {
    let k = samples.length - 1;
    while (k > 1 && samples[k - 1]!.h !== null && samples[k - 1]!.h! * R <= 0.01) k--;
    if (k < samples.length - 1 && fallsAt(k)) spill = k;
  }
  const out: Parts = [];
  for (const band of bands) {
    const flat: P3[] = [];
    const falls: P3[] = [];
    const lips: P3[] = [];
    const side = (i: number) => {
      const a = samples[Math.max(0, i - 1)]!,
        b = samples[Math.min(samples.length - 1, i + 1)]!;
      const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const half = samples[i]!.w * band.half * R;
      return [(-(b.z - a.z) / l) * half, ((b.x - a.x) / l) * half] as const;
    };
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1]!,
        b = samples[i]!;
      const [ax, az] = side(i - 1),
        [bx, bz] = side(i);
      let ya = y(a.h) + band.lift,
        yb = y(b.h) + band.lift;
      if (i > spill) ya = yb = BEACH_TOP + band.lift;
      const A = [a.x * R, a.z * R],
        B = [b.x * R, b.z * R];
      const quad = (p: number[], q: number[], yp: number, yq: number, to = flat, k = 1) => {
        const pl: P3 = [p[0]! + ax * k, yp, p[1]! + az * k],
          pr: P3 = [p[0]! - ax * k, yp, p[1]! - az * k],
          ql: P3 = [q[0]! + bx * k, yq, q[1]! + bz * k],
          qr: P3 = [q[0]! - bx * k, yq, q[1]! - bz * k];
        to.push(pl, pr, qr, pl, qr, ql);
      };
      if (i > spill && b.h !== null) {
        quad(A, B, ya, yb, lips);
        continue;
      }
      if (i > spill) {
        // Off the beach's edge into the sea.
        const M = [(A[0]! + B[0]!) / 2, (A[1]! + B[1]!) / 2];
        quad(A, M, ya, ya, lips);
        const [mx, mz] = [((ax + bx) / 2) * FALL_WIDE, ((az + bz) / 2) * FALL_WIDE];
        const l: P3 = [M[0]! + mx, ya, M[1]! + mz],
          r: P3 = [M[0]! - mx, ya, M[1]! - mz];
        falls.push(l, r, [r[0], 0, r[2]], l, [r[0], 0, r[2]], [l[0], 0, l[2]]);
        continue;
      }
      if (!fallsAt(i)) {
        quad(A, B, ya, yb);
        continue;
      }
      // A cliff between two samples: level to the edge, a falling sheet, level again.
      const M = [(A[0]! + B[0]!) / 2, (A[1]! + B[1]!) / 2];
      quad(A, M, ya, ya);
      quad(M, B, yb, yb);
      // Water falls as a sheet wider than the stream, with a white lip where it tips over.
      const wide = lava ? 1 : FALL_WIDE;
      const [mx, mz] = [((ax + bx) / 2) * wide, ((az + bz) / 2) * wide];
      const top = Math.max(ya, yb),
        bottom = Math.min(ya, yb);
      if (!lava) {
        const L = [A[0]! + (M[0]! - A[0]!) * 0.4, A[1]! + (M[1]! - A[1]!) * 0.4];
        quad(L, M, top + LIFT * 0.2, top + LIFT * 0.2, lips, wide);
      }
      const l: P3 = [M[0]! + mx, top, M[1]! + mz],
        r: P3 = [M[0]! - mx, top, M[1]! - mz];
      const lb: P3 = [l[0], bottom, l[2]],
        rb: P3 = [r[0], bottom, r[2]];
      falls.push(l, r, rb, l, rb, lb);
      // Foam or steam where it lands (a spill takes its foam down to the sea).
      if (i !== spill) out.push(...splash(lava, B[0]!, bottom, B[1]!, b.w * R, band.glow));
    }
    const ribbon = paint(mesh(flat, true), band.color);
    out.push(band.glow ? molten(ribbon) : ribbon);
    if (falls.length) {
      const sheet = paint(mesh(falls, false), lava ? band.color : RIVER_COLORS.white);
      out.push(band.glow ? molten(sheet) : sheet);
    }
    if (lips.length) out.push(paint(mesh(lips, true), RIVER_COLORS.white));
  }
  const mouth = samples[samples.length - 1]!;
  if (mouth.h === null)
    out.push(...splash(lava, mouth.x * R, 0, mouth.z * R, mouth.w * R, false, true));
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
    // A low spill on a ledge; on the sea, three ragged patches of foam lying on the water.
    if (!sea) {
      const foam = new THREE.CircleGeometry(width * 0.75, 7).rotateX(-Math.PI / 2);
      return [paint(foam.translate(x, y + LIFT * 1.1, z), RIVER_COLORS.white)];
    }
    return [
      [0, 0, 0.6, 0],
      [0.55, 0.35, 0.4, 1],
      [-0.45, 0.45, 0.35, 2],
    ].map(([dx, dz, r, turn]) => {
      const foam = new THREE.CircleGeometry(width * r!, 5, turn!).rotateX(-Math.PI / 2);
      return paint(
        foam.translate(x + dx! * width, y + LIFT * 1.5, z + dz! * width),
        RIVER_COLORS.white,
      );
    });
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
