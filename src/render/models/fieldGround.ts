import * as THREE from 'three';
import { TUNING } from '../../data/tuning';
import { GROUNDS, STYLES, groundColors, styleColor } from '../../data/grounds';
import type { TerrainDef } from '../../sim/map';
import { type Heightfield, fieldLod } from '../../sim/heightfield';
import { valueNoise } from '../../sim/noise';
import { blurGrid } from '../../sim/smoothField';
import { B2 } from './highlandPalette';

/**
 * The new look's ground (decision 0222, issue #269): one smooth-shaded grid over a height field,
 * and textures at the field's own resolution that its shader (fieldGroundShader.ts, issue #373)
 * colours per pixel, as the art direction's biome table reads (docs/reviews/art-direction/new-look
 * §2): each ground's own colours on the flat, mottled a few units across, its slope colours in
 * bands on the slopes, the wet band at the waterline. Zone edges are jittered on the grid here and
 * drawn as thin smooth lines by the shader, so they stay crisp storybook shapes on every quality.
 */

/** A ground's colours in the new look: `top` on the flat, `side` on slopes (palette.json). */
export interface FieldGroundLook {
  top: readonly string[];
  side: readonly string[];
  /** Rock: its slope and zone edges drawn sharp (palette.json `sharp`). */
  sharp?: boolean;
}

/** An island's ground colours: each ground of its field, and the wet band at the waterline. */
export interface FieldPalette {
  look(ground: string): FieldGroundLook;
  wet: string;
}

/** The new look's ground colours of an island file: its style's grounds (palette.json). */
export function designPalette(style: string): FieldPalette {
  return {
    look: (ground) => {
      const look = groundColors(ground, style);
      // A beach stays sand where it slopes into the sea: no cliff colours on it.
      const def = GROUNDS[look.id];
      return { top: look.top, side: def?.beach ? look.top : look.slope, sharp: def?.sharp };
    },
    wet: STYLES[style]?.wet ?? groundColors('sand', style).side[0]!,
  };
}

/** The new look's ground colours of a terrain shape: the classic tiers' colours. */
export function featurePalette(feature: TerrainDef): FieldPalette {
  const sand = feature.look?.color ?? B2.sand;
  const looks: Record<string, FieldGroundLook> = {
    sand: { top: [sand], side: [sand] },
    rock: { top: [B2.rock2], side: [B2.rock, B2.rock2] },
    grass: { top: [B2.grass], side: [B2.rock, B2.rock2] },
  };
  return {
    look: (ground) => looks[ground] ?? looks.sand!,
    wet: styleColor('wetsand', '') as string,
  };
}

/**
 * Heights to draw: the field's own, except under faceted shapes (`smooth` 0), whose classic
 * pieces stand there; those samples take the ground round them, spread inward ring by ring, so
 * the smooth ground runs on under the piece instead of climbing its cliff.
 */
function drawnHeights(field: Heightfield) {
  const { w, h, heights, smooth } = field;
  const out = Float32Array.from(heights);
  let front: number[] = [];
  const done = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) if (smooth[k]! > 0) done[k] = 1;
  for (let k = 0; k < w * h; k++) if (!done[k]) front.push(k);
  while (front.length) {
    const next: number[] = [];
    const filled: number[] = [];
    for (const k of front) {
      const i = k % w;
      let sum = 0,
        count = 0;
      for (const n of [i > 0 ? k - 1 : -1, i < w - 1 ? k + 1 : -1, k - w, k + w])
        if (n >= 0 && n < w * h && done[n]) {
          sum += out[n]!;
          count++;
        }
      if (count) {
        // Never above the piece itself, so it never pokes through its top.
        out[k] = Math.min(sum / count, heights[k]! - 0.05);
        filled.push(k);
      } else next.push(k);
    }
    if (!filled.length) break;
    for (const k of filled) done[k] = 1;
    front = next;
  }
  return out;
}

/**
 * 1 on samples deep inside a faceted shape (they and their eight neighbours are faceted): the
 * ground there is hidden inside the classic piece, so its cells are not drawn.
 */
function insideFaceted(field: Heightfield) {
  const { w, h, smooth } = field;
  const out = new Uint8Array(w * h);
  for (let j = 1; j + 1 < h; j++)
    for (let i = 1; i + 1 < w; i++) {
      let all = true;
      for (let dj = -1; dj <= 1 && all; dj++)
        for (let di = -1; di <= 1 && all; di++) all = smooth[(j + dj) * w + i + di] === 0;
      if (all) out[j * w + i] = 1;
    }
  return out;
}

/** Per-vertex normals of a grid of heights (scene axes: x east, z = -map y). */
function gridNormals(heights: Float32Array, w: number, h: number, cell: number) {
  const normals = new Float32Array(w * h * 3);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const dx =
        (heights[j * w + Math.min(w - 1, i + 1)]! - heights[j * w + Math.max(0, i - 1)]!) /
        (cell * (i > 0 && i < w - 1 ? 2 : 1));
      const dy =
        (heights[Math.min(h - 1, j + 1) * w + i]! - heights[Math.max(0, j - 1) * w + i]!) /
        (cell * (j > 0 && j < h - 1 ? 2 : 1));
      // Up the map's y is down the scene's z.
      const l = Math.hypot(dx, 1, dy);
      normals[k * 3] = -dx / l;
      normals[k * 3 + 1] = 1 / l;
      normals[k * 3 + 2] = dy / l;
    }
  return normals;
}

/**
 * One colour of a list, eased along it by a noise in [-1, 1]: gentle mottling. The first colour,
 * the ground's own, holds most of the ground; `draw.mottleAmount` is how far along the rest go.
 */
function mottled(list: readonly THREE.Color[], noise: number, out: THREE.Color) {
  if (list.length === 1) return out.copy(list[0]!);
  const t = Math.abs(noise) * TUNING.terrain.draw.mottleAmount * (list.length - 1);
  const a = Math.min(list.length - 2, Math.floor(t));
  return out.copy(list[a]!).lerp(list[a + 1]!, t - a);
}

/**
 * Texels per field sample in the ground's colour texture: a small island, seen close, gets a finer
 * one so its zone edges stay crisp (issue #277), up to `draw.fineTexels` across.
 */
export function groundTexels(field: Heightfield) {
  const { fineTexels, fineMax } = TUNING.terrain.draw;
  return Math.max(1, Math.min(fineMax, Math.floor(fineTexels / Math.max(field.w, field.h))));
}

/** A grid's value between its samples, at (u, v) in samples. */
function bilinear(values: ArrayLike<number>, w: number, u: number, v: number, stride = 1, at = 0) {
  const i = Math.floor(u),
    j = Math.floor(v);
  const fu = u - i,
    fv = v - j;
  const k = j * w + i;
  const i1 = fu > 0 ? 1 : 0,
    j1 = fv > 0 ? w : 0;
  const a = values[k * stride + at]!,
    b = values[(k + i1) * stride + at]!,
    c = values[(k + j1) * stride + at]!,
    d = values[(k + j1 + i1) * stride + at]!;
  return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv;
}

/**
 * The samples the textures are painted from: the field's own, or a finer grid between them
 * (`groundTexels`), its heights and slopes read between samples and each point's ground the one
 * whose share is largest a jittered step aside, so a zone's edge wanders smoothly instead of in
 * steps (rounding the jitter to whole samples made teeth that the shader's crisp edges show).
 */
function textureSamples(field: Heightfield) {
  const heights = drawnHeights(field);
  const normals = gridNormals(heights, field.w, field.h, field.cell);
  const f = groundTexels(field);
  const sample = { w: field.w, h: field.h, cell: field.cell, x0: field.x0, y0: field.y0 };
  const w = (field.w - 1) * f + 1,
    h = (field.h - 1) * f + 1;
  const shares = field.grounds.map((_, g) => {
    const share = Float32Array.from(field.ground, (v) => (v === g ? 1 : 0));
    blurGrid(share, field.w, field.h, TUNING.terrain.draw.edgeSmooth / field.cell);
    return share;
  });
  const fine = {
    heights: new Float32Array(w * h),
    up: new Float32Array(w * h),
    grounds: new Uint8Array(w * h),
  };
  const { jitter } = TUNING.terrain.draw;
  const clamp = (t: number, max: number) => Math.min(max, Math.max(0, t));
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = j * w + i,
        u = i / f,
        v = j / f;
      fine.heights[k] = bilinear(heights, field.w, u, v);
      fine.up[k] = bilinear(normals, field.w, u, v, 3, 1);
      // The ground's share read a little aside, between the field's samples.
      const x = field.x0 + u * field.cell,
        y = field.y0 + v * field.cell;
      const gu = clamp(
          u + (valueNoise(x * 0.4, y * 0.4, field.seed + 11) * jitter) / field.cell,
          field.w - 1,
        ),
        gv = clamp(
          v + (valueNoise(x * 0.4, y * 0.4, field.seed + 23) * jitter) / field.cell,
          field.h - 1,
        );
      // Land stays land and sea stays sea: the jitter only moves edges between grounds.
      const sea = bilinear(shares[0]!, field.w, u, v) > 0.5;
      let best = -1;
      for (let g = 0; g < shares.length; g++) {
        if (sea !== (g === 0)) continue;
        const share = bilinear(shares[g]!, field.w, gu, gv);
        if (share <= best) continue;
        best = share;
        fine.grounds[k] = g;
      }
    }
  return { ...sample, w, h, cell: field.cell / f, ...fine };
}

/** A field's textures for its ground shader (`fieldGroundMaterial`). */
export interface FieldGroundTextures {
  /** Each texel's flat colour (its ground's, mottled), and in alpha how level it is (normal.y). */
  colour: THREE.DataTexture;
  /**
   * Each texel's ground (its index in the field's grounds) in red, and its height smoothed over
   * `draw.bandSmooth` in green and blue (16 bits over `heights`): the shader's cliff bands. Alpha
   * 1 where the ground is sharp (rock): narrower slope and zone edges.
   */
  shape: THREE.DataTexture;
  /** The lowest height and the span the shape texture's 16 bits cover. */
  heights: [number, number];
  /** A row per ground: its cliff band colours, repeated to the width every row can share. */
  sides: THREE.DataTexture;
  /** The wet band's colour. */
  wet: string;
  /** World units per texel. */
  texel: number;
  /** The field's centre in scene x and z, where the shader's noises are measured from. */
  centre: [number, number];
}

function dataTexture(
  data: Uint8Array,
  w: number,
  h: number,
  colorSpace: THREE.ColorSpace,
  filtered: boolean,
) {
  const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  texture.colorSpace = colorSpace;
  texture.magFilter = filtered ? THREE.LinearFilter : THREE.NearestFilter;
  texture.minFilter = filtered ? THREE.LinearMipmapLinearFilter : THREE.NearestFilter;
  texture.generateMipmaps = filtered;
  texture.needsUpdate = true;
  return texture;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/**
 * Each ground's cliff colours as a row, repeated to the least common width of all rows, so the
 * shader picks band `b` of any ground at column `b mod width` without knowing its count.
 */
function sidesTexture(sides: readonly (readonly string[])[]) {
  const width = sides.reduce((w, list) => (w * list.length) / gcd(w, list.length), 1);
  const data = new Uint8Array(width * sides.length * 4);
  sides.forEach((list, g) => {
    for (let b = 0; b < width; b++) {
      const hex = new THREE.Color(list[b % list.length]).getHex();
      data.set([hex >> 16, (hex >> 8) & 255, hex & 255, 255], (g * width + b) * 4);
    }
  });
  return dataTexture(data, width, sides.length, THREE.SRGBColorSpace, false);
}

/**
 * The ground textures of a height field, `groundTexels` texels per sample of the canonical grid
 * (decision 0230), so every quality level shows the same crisp zones however coarse its mesh.
 */
export function fieldGroundTextures(
  field: Heightfield,
  palette: FieldPalette,
): FieldGroundTextures {
  const { w, h, cell, x0, y0, heights, up, grounds } = textureSamples(field);
  const draw = TUNING.terrain.draw;
  const looks = field.grounds.map((g) => palette.look(g === '' || g === 'lake' ? 'sand' : g));
  const tops = looks.map((look) => look.top.map((c) => new THREE.Color(c)));
  const n = w * h;
  const texels = new Uint8Array(n * 4);
  const c = new THREE.Color();
  for (let k = 0; k < n; k++) {
    const x = x0 + (k % w) * cell,
      y = y0 + Math.floor(k / w) * cell;
    const noise = valueNoise(x * draw.mottle, y * draw.mottle, field.seed + 5);
    const hex = mottled(tops[grounds[k]!]!, noise, c).getHex();
    texels.set([hex >> 16, (hex >> 8) & 255, hex & 255, Math.round(up[k]! * 255)], k * 4);
  }
  // The bands' height, smoothed so their edges don't trace the field's grid ripples.
  const level = Float32Array.from(heights);
  blurGrid(level, w, h, draw.bandSmooth / cell);
  let low = Infinity,
    high = -Infinity;
  for (const height of level) {
    low = Math.min(low, height);
    high = Math.max(high, height);
  }
  const span = Math.max(high - low, 1e-3);
  const shape = new Uint8Array(n * 4);
  for (let k = 0; k < n; k++) {
    const bits = Math.round(((level[k]! - low) / span) * 65535);
    shape.set([grounds[k]!, bits >> 8, bits & 255, looks[grounds[k]!]!.sharp ? 255 : 0], k * 4);
  }
  return {
    colour: dataTexture(texels, w, h, THREE.SRGBColorSpace, true),
    shape: dataTexture(shape, w, h, THREE.NoColorSpace, false),
    heights: [low, span],
    sides: sidesTexture(looks.map((look) => look.side)),
    wet: palette.wet,
    texel: cell,
    centre: [
      field.x0 + ((field.w - 1) * field.cell) / 2,
      -(field.y0 + ((field.h - 1) * field.cell) / 2),
    ],
  };
}

/**
 * The ground of a height field as one indexed, smooth-shaded mesh in scene coordinates, one
 * vertex every `step` samples, its texture coordinates on the field's colour texture. Cells
 * wholly under `draw.hideBelow` (deep under the opaque sea) or deep inside a faceted shape are
 * left out.
 */
export function fieldGround(full: Heightfield, step = 1): THREE.BufferGeometry {
  const field = fieldLod(full, step);
  const { w, h, cell } = field;
  const draw = TUNING.terrain.draw;
  const texels = groundTexels(full);
  const tw = (full.w - 1) * texels + 1,
    th = (full.h - 1) * texels + 1;
  const n = w * h;
  const heights = drawnHeights(field);
  const normals = gridNormals(heights, w, h, cell);
  const positions = new Float32Array(n * 3),
    uvs = new Float32Array(n * 2);
  for (let k = 0; k < n; k++) {
    const i = k % w,
      j = (k - i) / w;
    positions[k * 3] = field.x0 + i * cell;
    positions[k * 3 + 1] = heights[k]!;
    positions[k * 3 + 2] = -(field.y0 + j * cell);
    // On the centre of the texture's texel under it.
    uvs[k * 2] = (Math.min(full.w - 1, i * step) * texels + 0.5) / tw;
    uvs[k * 2 + 1] = (Math.min(full.h - 1, j * step) * texels + 0.5) / th;
  }
  const hidden = insideFaceted(field);
  const index: number[] = [];
  for (let j = 0; j + 1 < h; j++)
    for (let i = 0; i + 1 < w; i++) {
      const a = j * w + i,
        b = a + 1,
        d = a + w,
        e = a + w + 1;
      if (Math.max(heights[a]!, heights[b]!, heights[d]!, heights[e]!) < draw.hideBelow) continue;
      if (hidden[a] && hidden[b] && hidden[d] && hidden[e]) continue;
      // Wound to face up: +x, then -z (the map's +y).
      index.push(a, b, d, b, e, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(index);
  return g;
}
