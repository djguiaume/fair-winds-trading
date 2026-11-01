import * as THREE from 'three';
import glyphFile from '../../data/sail-glyphs.json';
import { RULES } from '../../sim/cosmetics';
import { BOAT_LOOK, type BoatLook } from './boatLook';
import { emblemTriangles } from './emblem';
import type { Faces } from './hullGeometry';

/**
 * Marks painted on a sail (docs/v1.4/customisation.md, issue #418): a logo and the racing number
 * (decision 0217). Each is flat triangles laid out on the cloth's own (u, v) and lifted by the same
 * belly, merged into the sail mesh (no draw call), so it stays on the cloth as the sail fills,
 * swings and furls. It is drawn twice, once readable from each side; the sail material shows each
 * copy only from its own side and draws it a little toward the camera (sailCanvas.ts), so the
 * curved cloth never covers it.
 */
export interface SailMark {
  /** x, y pairs, three a triangle, counter-clockwise; one unit is `size` of the sail's width. */
  tris: Float32Array;
  colour: string;
  /** Its centre: across the sail (0 luff, 1 leech) and up it (0 foot, 1 head). */
  u: number;
  v: number;
  /** One mark unit as a share of the sail's width (luff to leech) at `v`. */
  size: number;
}

/** The cloth a mark is laid on: its corners (foot luff, foot leech, head luff, head leech). */
export interface MarkCloth {
  corners: readonly [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];
  /** The cloth's point at (u, v), belly included. */
  at: (u: number, v: number) => THREE.Vector3;
  /** True where the cloth is torn or patched: damage draws above a mark, so it is left out there. */
  hidden: (u: number, v: number) => boolean;
}

const GLYPHS = glyphFile.glyphs as Record<string, number[][]>;
const NUMBER = BOAT_LOOK.marks.number;
const emblems = new Map<string, Float32Array>();

/** A logo's triangles, parsed once per SVG text. */
export function emblemMark(svg: string): Float32Array {
  let tris = emblems.get(svg);
  if (!tris) emblems.set(svg, (tris = emblemTriangles(svg)));
  return tris;
}

/**
 * A racing number's block strokes as triangles, one unit tall, centred: each stroke is a bar of
 * `stroke` width running past its ends by half that, so corners close.
 */
export function numberMark(text: string): Float32Array {
  const { width: w, gap, stroke } = NUMBER;
  const chars = [...text];
  const total = chars.reduce((s, ch) => s + (ch === ' ' ? gap : w + gap), -gap);
  const out: number[] = [];
  let x0 = -total / 2;
  for (const ch of chars) {
    if (ch === ' ') {
      x0 += gap;
      continue;
    }
    for (const [u0, v0, u1, v1] of GLYPHS[ch] ?? []) {
      const [ax, ay, bx, by] = [x0 + u0! * w, v0! - 0.5, x0 + u1! * w, v1! - 0.5];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const [dx, dy] = [((bx - ax) / len) * (stroke / 2), ((by - ay) / len) * (stroke / 2)];
      // Corners: back-left, back-right, front-right, front-left of the bar (counter-clockwise).
      const p = [
        [ax - dx + dy, ay - dy - dx],
        [ax - dx - dy, ay - dy + dx],
        [bx + dx - dy, by + dy + dx],
        [bx + dx + dy, by + dy - dx],
      ];
      for (const k of [0, 2, 1, 0, 3, 2]) out.push(p[k]![0]!, p[k]![1]!);
    }
    x0 += w + gap;
  }
  return ccw(new Float32Array(out));
}

/** The racing number as a mark on a sail. */
export function sailNumberMark(text: string): SailMark {
  return {
    tris: numberMark(text),
    colour: NUMBER.colour,
    u: 0.5,
    v: NUMBER.centreV,
    size: NUMBER.height,
  };
}

/**
 * What the mainsail carries: the racing number while racing (it hides the logo, issue #418),
 * else the look's logo (`rules.json` › `emblem`: centred, its width a share of the sail's).
 */
export function mainsailMarks(look: BoatLook, sailNumber?: string): SailMark[] {
  if (sailNumber) return [sailNumberMark(sailNumber)];
  if (!look.sailLogo) return [];
  const { width, centreV } = RULES.emblem;
  const { svg, colour } = look.sailLogo;
  return [{ tris: emblemMark(svg), colour, u: 0.5, v: 1 - centreV, size: width }];
}

/** Turns every triangle counter-clockwise. */
function ccw(t: Float32Array): Float32Array {
  for (let i = 0; i < t.length; i += 6) {
    const cross =
      (t[i + 2]! - t[i]!) * (t[i + 5]! - t[i + 1]!) - (t[i + 3]! - t[i + 1]!) * (t[i + 4]! - t[i]!);
    if (cross < 0) {
      [t[i + 2], t[i + 4]] = [t[i + 4]!, t[i + 2]!];
      [t[i + 3], t[i + 5]] = [t[i + 5]!, t[i + 3]!];
    }
  }
  return t;
}

/** The flat sail (no belly) at (u, v): the cloth's y and z, as (y, z). */
function flat(c: MarkCloth['corners'], u: number, v: number, out: THREE.Vector2) {
  const [a, b, d, e] = c;
  const lerp = (k: 'y' | 'z') =>
    (a[k] * (1 - u) + b[k] * u) * (1 - v) + (d[k] * (1 - u) + e[k] * u) * v;
  return out.set(lerp('y'), lerp('z'));
}

const tmp = new THREE.Vector2();
const du = new THREE.Vector2();
const dv = new THREE.Vector2();

/** The (u, v) of a flat sail point (y, z), by Newton steps from a nearby guess. */
export function clothUv(
  c: MarkCloth['corners'],
  y: number,
  z: number,
  u = 0.5,
  v = 0.5,
): [number, number] {
  const [a, b, d, e] = c;
  for (let i = 0; i < 8; i++) {
    flat(c, u, v, tmp);
    const [fy, fz] = [tmp.x - y, tmp.y - z];
    if (Math.abs(fy) + Math.abs(fz) < 1e-7) break;
    du.set((b.y - a.y) * (1 - v) + (e.y - d.y) * v, (b.z - a.z) * (1 - v) + (e.z - d.z) * v);
    dv.set(
      d.y * (1 - u) + e.y * u - (a.y * (1 - u) + b.y * u),
      d.z * (1 - u) + e.z * u - (a.z * (1 - u) + b.z * u),
    );
    const det = du.x * dv.y - du.y * dv.x;
    if (Math.abs(det) < 1e-12) break;
    u -= (fy * dv.y - fz * dv.x) / det;
    v -= (du.x * fz - du.y * fy) / det;
  }
  return [THREE.MathUtils.clamp(u, 0, 1), THREE.MathUtils.clamp(v, 0, 1)];
}

/**
 * Paints marks onto a cloth: each upright (its y up the mast), centred at its (u, v), one copy per
 * face, each readable from its own side (`mark` +1 seen from +x, -1 from -x). A triangle with a
 * corner over damage is left out.
 */
export function paintMarks(f: Faces, cloth: MarkCloth, marks: readonly SailMark[]) {
  const { corners } = cloth;
  const glow = BOAT_LOOK.marks.glow;
  const centre = new THREE.Vector2();
  const luff = new THREE.Vector2();
  const leech = new THREE.Vector2();
  for (const m of marks) {
    flat(corners, m.u, m.v, centre);
    const chord = flat(corners, 1, m.v, leech).sub(flat(corners, 0, m.v, luff));
    const unit = chord.length() * m.size;
    // Across: along the chord; up: the mast's direction, square to it. Both as (y, z).
    const across = chord.clone().normalize();
    const up = new THREE.Vector2(1, 0).addScaledVector(across, -across.x).normalize();
    for (const side of [1, -1]) {
      // Seen from +x, the viewer's right is -z; from -x, +z.
      const right = across.clone().multiplyScalar(Math.sign(-across.y * side) || side);
      const uv: [number, number][] = [];
      for (let i = 0; i < m.tris.length; i += 2) {
        const y = centre.x + right.x * m.tris[i]! * unit + up.x * m.tris[i + 1]! * unit;
        const z = centre.y + right.y * m.tris[i]! * unit + up.y * m.tris[i + 1]! * unit;
        uv.push(clothUv(corners, y, z, m.u, m.v));
      }
      for (let i = 0; i < uv.length; i += 3) {
        const tri = uv.slice(i, i + 3);
        if (tri.some(([u, v]) => cloth.hidden(u, v))) continue;
        const [p, q, r] = tri.map(([u, v]) => cloth.at(u, v)) as [
          THREE.Vector3,
          THREE.Vector3,
          THREE.Vector3,
        ];
        f.tri(p, q, r, m.colour, glow, side);
      }
    }
  }
}
