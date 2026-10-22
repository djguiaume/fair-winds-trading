import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Rng } from '../../sim/rng';

/**
 * Helpers to build flat-shaded, vertex-colored low-poly meshes and merge them into one draw call.
 */

/** Non-indexed copy with a per-vertex color attribute and no UVs, ready for merging. */
export function paint(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (g !== geometry) geometry.dispose();
  g.deleteAttribute('uv');
  const c = new THREE.Color(color);
  const count = g.attributes.position!.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/** Window glass: most windows are lit at night, a few stay dark (decision 0068). */
const LIT_GLASS = '#ffd98a';
const DARK_GLASS = '#2e3a46';

/** Marks a part as glowing glass, drawn by the window mesh that lights up at night. */
export function glowing(geometry: THREE.BufferGeometry) {
  geometry.userData.window = true;
  return geometry;
}

export const isGlowing = (geometry: THREE.BufferGeometry) => geometry.userData.window === true;

/**
 * Window panes on the walls of a w × d house whose windows sit at height y, centred on (cx, cz):
 * `front` panes on the front (+Z) and back walls and `side` on each end. `seed` picks which stay
 * dark at night.
 */
export function windowPanes(
  w: number,
  d: number,
  y: number,
  front: number,
  side: number,
  seed: number,
  cx = 0,
  cz = 0,
): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  let k = 0;
  const pane = (rotY: number, x: number, z: number) => {
    const lit = (seed * 7 + k++ * 3) % 10 < 7;
    const g = new THREE.PlaneGeometry(0.2, 0.26).rotateY(rotY).translate(cx + x, y, cz + z);
    out.push(glowing(paint(g, lit ? LIT_GLASS : DARK_GLASS)));
  };
  const along = (n: number, len: number) =>
    Array.from({ length: n }, (_, i) => ((i + 1) / (n + 1) - 0.5) * len);
  const off = 0.012;
  for (const x of along(front, w)) {
    pane(0, x, d / 2 + off);
    pane(Math.PI, x, -d / 2 - off);
  }
  for (const z of along(side, d)) {
    pane(Math.PI / 2, w / 2 + off, z);
    pane(-Math.PI / 2, -w / 2 - off, z);
  }
  return out;
}

/** Jittered closed outline of radius ~R, stretched by sx/sz. */
export function blobShape(rng: Rng, R: number, n: number, jit: number, sx: number, sz: number) {
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
export function slab(shape: THREE.Shape, h: number, k = 1) {
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

/** Translate (and optionally rotate around Y and scale) a geometry in place. */
export function place(
  geometry: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  scale: number | [number, number, number] = 1,
) {
  const [sx, sy, sz] = typeof scale === 'number' ? [scale, scale, scale] : scale;
  geometry.scale(sx, sy, sz);
  if (rotY) geometry.rotateY(rotY);
  geometry.translate(x, y, z);
  return geometry;
}

/**
 * Push vertices of a cylinder-like geometry in or out by angle so its outline looks hand-cut.
 * `jitter[i]` is the radius factor for radial segment i; rings stay consistent top to bottom.
 */
export function jitterRadial(geometry: THREE.BufferGeometry, jitter: number[]) {
  const pos = geometry.attributes.position!;
  const n = jitter.length;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    if (x === 0 && z === 0) continue;
    const a = (Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2);
    const k = jitter[Math.round((a / (Math.PI * 2)) * n) % n]!;
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
  }
  pos.needsUpdate = true;
  return geometry;
}

export function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('mergeGeometries failed: attribute mismatch');
  for (const p of parts) p.dispose();
  return merged;
}

/** Material shared by all vertex-colored props: Lambert is cheaper than PBR on old GPUs. */
export function vertexColorMaterial() {
  return new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
}

/**
 * Vertex colors per geometry group, for shapes like ExtrudeGeometry whose caps (group 0) and
 * sides (group 1) should differ: e.g. a deck on top of a painted hull.
 */
export function paintGroups(geometry: THREE.BufferGeometry, colors: THREE.ColorRepresentation[]) {
  const g = paint(geometry, colors[0]!);
  const col = g.attributes.color!;
  for (const group of g.groups) {
    const c = new THREE.Color(colors[group.materialIndex ?? 0] ?? colors[0]!);
    for (let i = group.start; i < group.start + group.count; i++) col.setXYZ(i, c.r, c.g, c.b);
  }
  g.clearGroups();
  return g;
}

/** New non-indexed geometry holding only one group's triangles (e.g. an extrusion's sides). */
export function keepGroup(geometry: THREE.BufferGeometry, materialIndex: number) {
  const src = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = src.attributes.position!;
  const out: number[] = [];
  for (const group of src.groups) {
    if (group.materialIndex !== materialIndex) continue;
    for (let i = group.start; i < group.start + group.count; i++) {
      out.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    }
  }
  if (src !== geometry) src.dispose();
  geometry.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  return g;
}

/** Number of triangles in a geometry (indexed or not), for budget checks. */
export function triangleCount(geometry: THREE.BufferGeometry) {
  return (geometry.index ? geometry.index.count : geometry.attributes.position!.count) / 3;
}
