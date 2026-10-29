import * as THREE from 'three';
import type { Heightfield } from '../../sim/heightfield';
import type { Region } from '../../sim/sculpt';

/** What colour a triangle of field ground takes: its highest corner's ground, steep or not. */
export type FieldColor = (ground: string, steep: boolean, height: number) => string;

/** Rise over run past which a field triangle reads as a cliff or slope side. */
const STEEP = 1.3;

/** The colours a field's triangles take, one `THREE.Color` per distinct name. */
class Colors {
  private readonly cache = new Map<string, THREE.Color>();
  constructor(public colorOf: FieldColor) {}

  /** The colour of a triangle between three samples. */
  of(field: Heightfield, a: number, b: number, c: number) {
    const ha = field.heights[a]!,
      hb = field.heights[b]!,
      hc = field.heights[c]!;
    const top = ha >= hb && ha >= hc ? a : hb >= hc ? b : c;
    const high = Math.max(ha, hb, hc);
    const steep = (high - Math.min(ha, hb, hc)) / field.cell > STEEP;
    const name = this.colorOf(field.grounds[field.ground[top]!]!, steep, high);
    let color = this.cache.get(name);
    if (!color) this.cache.set(name, (color = new THREE.Color(name)));
    return color;
  }

  clear() {
    this.cache.clear();
  }
}

/** The six samples of a cell's two triangles, wound to face up: +x, then -z (the map's +y). */
const cell = (a: number, w: number) => [a, a + 1, a + w, a + 1, a + w + 1, a + w];

/** A sample's place in the scene: the map's y is the scene's -z. */
function place(field: Heightfield, k: number, out: Float32Array | number[], at: number) {
  const i = k % field.w,
    j = (k - i) / field.w;
  out[at] = field.x0 + i * field.cell;
  out[at + 1] = field.heights[k]!;
  out[at + 2] = -(field.y0 + j * field.cell);
}

/**
 * The new look's ground (decision 0222): one triangle pair per cell of a height field, in scene
 * coordinates, flat shaded like the rest of the land. Open seabed cells are left out.
 */
export function fieldGround(field: Heightfield, colorOf: FieldColor): THREE.BufferGeometry {
  const { w, h, heights } = field;
  const positions: number[] = [],
    colors: number[] = [];
  const palette = new Colors(colorOf);
  const point = [0, 0, 0];
  for (let j = 0; j + 1 < h; j++)
    for (let i = 0; i + 1 < w; i++) {
      const k = cell(j * w + i, w);
      if ([k[0]!, k[1]!, k[2]!, k[4]!].every((s) => heights[s]! <= field.seabed)) continue;
      for (let t = 0; t < 6; t += 3) {
        const c = palette.of(field, k[t]!, k[t + 1]!, k[t + 2]!);
        for (let v = 0; v < 3; v++) {
          place(field, k[t + v]!, point, 0);
          positions.push(...point);
          colors.push(c.r, c.g, c.b);
        }
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * A height field's ground kept up to date as its samples change (the island builder's terrain
 * tools): every cell has its place in the buffers, so a sculpted region is rewritten in place and
 * only that part uploaded. Open seabed is drawn too, since a brush can raise it.
 */
export class FieldSurface {
  readonly geometry = new THREE.BufferGeometry();
  private readonly positions: THREE.BufferAttribute;
  private readonly colors: THREE.BufferAttribute;
  private readonly normals: THREE.BufferAttribute;
  private readonly palette: Colors;
  /** Scratch vectors for a triangle's normal, so a redraw allocates nothing. */
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly c = new THREE.Vector3();

  constructor(
    private readonly field: Heightfield,
    colorOf: FieldColor,
  ) {
    const count = (field.w - 1) * (field.h - 1) * 6;
    this.positions = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    this.colors = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    this.normals = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    this.palette = new Colors(colorOf);
    this.geometry.setAttribute('position', this.positions);
    this.geometry.setAttribute('color', this.colors);
    this.geometry.setAttribute('normal', this.normals);
    this.update({ i0: 0, j0: 0, i1: field.w - 1, j1: field.h - 1 });
  }

  /** Paints with another colour function (the depth overlay) and redraws everything. */
  recolor(colorOf: FieldColor) {
    this.palette.colorOf = colorOf;
    this.palette.clear();
    this.update({ i0: 0, j0: 0, i1: this.field.w - 1, j1: this.field.h - 1 });
  }

  /** Rewrites the cells touching the samples of a region, and uploads just their rows. */
  update(region: Region) {
    const { w, h } = this.field;
    const i0 = Math.max(0, region.i0 - 1),
      i1 = Math.min(w - 2, region.i1),
      j0 = Math.max(0, region.j0 - 1),
      j1 = Math.min(h - 2, region.j1);
    if (i0 > i1 || j0 > j1) return;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.writeCell(i, j);
    const first = (j0 * (w - 1) + i0) * 18,
      last = (j1 * (w - 1) + i1 + 1) * 18;
    for (const attribute of [this.positions, this.colors, this.normals]) {
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(first, last - first);
      attribute.needsUpdate = true;
    }
  }

  private writeCell(i: number, j: number) {
    const { field } = this;
    const corners = cell(j * field.w + i, field.w);
    const at = (j * (field.w - 1) + i) * 18;
    const positions = this.positions.array as Float32Array;
    for (let t = 0; t < 6; t += 3) {
      const color = this.palette.of(field, corners[t]!, corners[t + 1]!, corners[t + 2]!);
      for (let v = 0; v < 3; v++) {
        const o = at + (t + v) * 3;
        place(field, corners[t + v]!, positions, o);
        (this.colors.array as Float32Array).set([color.r, color.g, color.b], o);
      }
      const o = at + t * 3;
      this.a.fromArray(positions, o);
      this.b.fromArray(positions, o + 3).sub(this.a);
      this.c.fromArray(positions, o + 6).sub(this.a);
      this.b.cross(this.c).normalize();
      for (let v = 0; v < 3; v++) this.b.toArray(this.normals.array as Float32Array, o + v * 3);
    }
  }
}
