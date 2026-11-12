import * as THREE from 'three';
import type { LaneDef } from '../../data/islands';
import { paint } from './geometry';
import { C, blocks, box, derrick, put, type Parts } from './props';
import type { TownLevel } from './towns';

/** Pieces of a town's build, kept apart so towns.ts stays readable. */

/** A walkable tier top of a classic town island. */
export interface Disc {
  x: number;
  z: number;
  r: number;
  y: number;
}

/** Stairs over a cliff: treads on full masonry down to `base`, a landing at each bend. */
export function stairs(out: Parts, lane: LaneDef, R: number) {
  const base = lane.base ?? 0;
  for (let k = 1; k < lane.points.length; k++) {
    const a = lane.points[k - 1]!,
      b = lane.points[k]!;
    for (let i = 0; i < 12; i++) {
      const t = (i + 0.5) / 12,
        x = a[0]! + (b[0]! - a[0]!) * t,
        z = a[1]! + (b[1]! - a[1]!) * t;
      const y = a[2]! + (b[2]! - a[2]!) * t;
      const length = (Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!) * R) / 12;
      // Full masonry beneath each tread bears on the dry lower terrace.
      const supportHeight = (y - base) * R;
      const step = box(
        length + 0.02,
        supportHeight + 0.03,
        R * 0.085,
        0,
        -supportHeight / 2,
        0,
        C.cut,
      );
      put(out, [step], x * R, y * R, z * R, -Math.atan2(b[1]! - a[1]!, b[0]! - a[0]!));
    }
  }
  for (const p of lane.points.slice(1, -1))
    put(out, [box(R * 0.13, 0.12, R * 0.12, 0, 0, 0, C.cut)], p[0]! * R, p[2]! * R, p[1]! * R);
}

/** Omit horizontal undersides: every island is viewed from above the sea. */
export function withoutUndersides(g: THREE.BufferGeometry) {
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

/**
 * Quarry terraces cut into the seaward cliff, from the top tier down: each level cuts one more
 * pale step, with cut blocks and, from the second cut, a derrick crane.
 */
export function quarry(
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
