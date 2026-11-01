import * as THREE from 'three';
import glyphFile from '../../data/sail-glyphs.json';
import { RULES } from '../../sim/cosmetics';
import { BOAT_LOOK, type BoatLook } from './boatLook';
import { emblemTriangles } from './emblem';
import { patternPaint } from './sailPatterns';
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
  /** x, y pairs, three a triangle, counter-clockwise; one unit is `size` of the sail (see `size`). */
  tris: Float32Array;
  colour: string;
  /** Its centre: across the sail (0 luff, 1 leech) and up it (0 foot, 1 head). */
  u: number;
  v: number;
  /**
   * One mark unit as a share of the sail's width (luff to leech) at `v`, or of its height (foot to
   * head) at `u` where that is less, so a mark fits a short, wide square course.
   */
  size: number;
  /** A logo: it gets a canvas patch behind it where the pattern under it is too close in colour. */
  backed?: boolean;
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
 * else the look's logo (`rules.json` › `emblem`: centred, its width a share of the sail's;
 * higher on a square rigger's main course).
 */
export function mainsailMarks(look: BoatLook, sailNumber?: string, square = false): SailMark[] {
  if (sailNumber) return [sailNumberMark(sailNumber)];
  if (!look.sailLogo) return [];
  const { width, centreV, squareCentreV } = RULES.emblem;
  const { svg, colour } = look.sailLogo;
  const v = 1 - (square ? squareCentreV : centreV);
  return [{ tris: emblemMark(svg), colour, u: 0.5, v, size: width, backed: true }];
}

const PATCH = BOAT_LOOK.marks.patch;

/** WCAG relative luminance of a colour. */
function luminance(hex: string): number {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/** Contrast ratio of two colours, 1 (same) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** A box on the cloth in (u, v): from u0 to u1 across, v0 to v1 up. */
export type ClothBox = [number, number, number, number];

/**
 * Where the cloth keeps its plain canvas under a pattern: a box around each logo whose pattern
 * beneath is too close to it in colour (art director, #418). The panels there are sewn plain, so
 * the patch costs no triangle; a plain sail, or a pattern that contrasts, keeps a bare logo.
 */
export function canvasPatches(
  marks: readonly SailMark[],
  pattern: { kind: string; colours: string[] } | null,
  canvas: string,
  nu: number,
  nv: number,
): ClothBox[] {
  if (!pattern) return [];
  const steps = [-1, -0.5, 0, 0.5, 1];
  return marks
    .filter((m) => m.backed)
    .filter((m) => {
      const reach = (m.size * PATCH.scale) / 2;
      return steps.some((s) =>
        steps.some((t) => {
          const p = patternPaint(
            pattern.kind,
            (m.u + s * reach) * nu,
            (m.v + t * reach) * nv,
            nu,
            nv,
          );
          const under = p < 0 ? canvas : (pattern.colours[p] ?? pattern.colours[0]!);
          return contrast(under, m.colour) < PATCH.minContrast;
        }),
      );
    })
    .map((m) => {
      const reach = (m.size * PATCH.scale) / 2;
      return [m.u - reach, m.u + reach, m.v - reach, m.v + reach];
    });
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
 * corner over damage is left out. A flat triangle cuts under the curved belly between its
 * corners, so each mark is lifted one `marks.lift` plus that sag (the attribute's size, in lifts).
 */
export function paintMarks(f: Faces, cloth: MarkCloth, marks: readonly SailMark[]) {
  const glow = BOAT_LOOK.marks.glow;
  for (const m of marks) {
    const tris = [1, -1].map((side) => markTriangles(cloth, m, side));
    const lift = 1 + Math.max(0, ...tris.map((list) => sag(cloth, list))) / BOAT_LOOK.marks.lift;
    tris.forEach((list, k) => {
      for (const {
        at: [p, q, r],
      } of list)
        f.tri(p, q, r, m.colour, glow, (k ? -1 : 1) * lift);
    });
  }
}

type Tri = [THREE.Vector3, THREE.Vector3, THREE.Vector3];
type MarkTri = { at: Tri; uv: [number, number][] };

/** One copy of a mark laid on the cloth, wound to face `side`. */
function markTriangles(cloth: MarkCloth, m: SailMark, side: number): MarkTri[] {
  const { corners } = cloth;
  const centre = flat(corners, m.u, m.v, new THREE.Vector2());
  const luff = flat(corners, 0, m.v, new THREE.Vector2());
  const chord = flat(corners, 1, m.v, new THREE.Vector2()).sub(luff);
  const height = flat(corners, m.u, 1, new THREE.Vector2()).distanceTo(
    flat(corners, m.u, 0, new THREE.Vector2()),
  );
  const unit = Math.min(chord.length(), height) * m.size;
  // Across: along the chord; up: the mast's direction, square to it. Both as (y, z).
  const across = chord.clone().normalize();
  const up = new THREE.Vector2(1, 0).addScaledVector(across, -across.x).normalize();
  // Seen from +x, the viewer's right is -z; from -x, +z.
  const right = across.clone().multiplyScalar(Math.sign(-across.y * side) || side);
  const uv: [number, number][] = [];
  for (let i = 0; i < m.tris.length; i += 2) {
    const y = centre.x + right.x * m.tris[i]! * unit + up.x * m.tris[i + 1]! * unit;
    const z = centre.y + right.y * m.tris[i]! * unit + up.y * m.tris[i + 1]! * unit;
    uv.push(clothUv(corners, y, z, m.u, m.v));
  }
  const out: MarkTri[] = [];
  for (let i = 0; i < uv.length; i += 3) {
    const tri = uv.slice(i, i + 3);
    if (tri.some(([u, v]) => cloth.hidden(u, v))) continue;
    out.push({ at: tri.map(([u, v]) => cloth.at(u, v)) as Tri, uv: tri });
  }
  return out;
}

/** Barycentric points where a flat triangle strays most from the cloth: its middle and edges. */
const SAG_AT = [
  [1 / 3, 1 / 3, 1 / 3],
  [0.5, 0.5, 0],
  [0, 0.5, 0.5],
  [0.5, 0, 0.5],
] as const;

/** How far a mark's flat triangles stray from the curved cloth at most. */
function sag(cloth: MarkCloth, tris: MarkTri[]): number {
  const p = new THREE.Vector3();
  let most = 0;
  for (const { at, uv } of tris)
    for (const w of SAG_AT) {
      p.set(0, 0, 0);
      let [u, v] = [0, 0];
      at.forEach((c, k) => {
        p.addScaledVector(c, w[k]!);
        u += uv[k]![0] * w[k]!;
        v += uv[k]![1] * w[k]!;
      });
      most = Math.max(most, p.distanceTo(cloth.at(u, v)));
    }
  return most;
}
