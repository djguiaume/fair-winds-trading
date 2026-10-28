import * as THREE from 'three';
import { TUNING } from '../../data/tuning';
import { STYLES, groundColors, styleColor } from '../../data/grounds';
import type { TerrainDef } from '../../sim/map';
import type { Heightfield } from '../../sim/heightfield';
import { valueNoise } from '../../sim/noise';
import { blurGrid } from '../../sim/smoothField';
import { B2 } from './highlandPalette';

/**
 * The new look's ground mesh (decision 0222, issue #269): one smooth-shaded grid over a height
 * field, coloured by zone from height and slope, the way the art direction's biome table reads
 * (docs/reviews/art-direction/new-look §2): the wet band at the waterline, each ground's own
 * colours on the flat, mottled a few units across, its cliff colours in bands on the slopes.
 * Ground zones blend over `terrain.json › draw.blend` units with a little jitter, so they stay
 * crisp storybook shapes rather than smears.
 */

/** A ground's colours in the new look: `top` on the flat, `side` on slopes (palette.json). */
export interface FieldGroundLook {
  top: readonly string[];
  side: readonly string[];
}

/** An island's ground colours: each ground of its field, and the wet band at the waterline. */
export interface FieldPalette {
  look(ground: string): FieldGroundLook;
  wet: string;
}

/** The new look's ground colours of an island file: its style's grounds (palette.json). */
export function designPalette(style: string): FieldPalette {
  return {
    look: (ground) => groundColors(ground, style),
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

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

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

/** Each vertex's ground, read a jittered step away so zone edges don't follow the grid. */
function jitteredGrounds(field: Heightfield) {
  const { w, h, cell, ground, seed } = field;
  const { jitter } = TUNING.terrain.draw;
  const out = new Uint8Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const x = field.x0 + i * cell,
        y = field.y0 + j * cell;
      const di = Math.round((valueNoise(x * 0.4, y * 0.4, seed + 11) * jitter) / cell),
        dj = Math.round((valueNoise(x * 0.4, y * 0.4, seed + 23) * jitter) / cell);
      const ii = Math.min(w - 1, Math.max(0, i + di)),
        jj = Math.min(h - 1, Math.max(0, j + dj));
      const k = j * w + i;
      // Land stays land and sea stays sea: the jitter only moves edges between grounds.
      const near = ground[jj * w + ii]!;
      out[k] = !ground[k] === !near ? near : ground[k]!;
    }
  return out;
}

/** One colour of a list, eased between neighbours by a noise in [-1, 1]: gentle mottling. */
function mottled(list: readonly THREE.Color[], noise: number, out: THREE.Color) {
  if (list.length === 1) return out.copy(list[0]!);
  const t = ((noise + 1) / 2) * (list.length - 1);
  const a = Math.min(list.length - 2, Math.floor(t));
  return out.copy(list[a]!).lerp(list[a + 1]!, t - a);
}

/**
 * The ground of a height field as one indexed, smooth-shaded mesh in scene coordinates, with
 * vertex colours. Cells wholly under `draw.hideBelow` (deep under the opaque sea) are left out.
 */
export function fieldGround(field: Heightfield, palette: FieldPalette): THREE.BufferGeometry {
  const { w, h, cell, seed } = field;
  const draw = TUNING.terrain.draw;
  const n = w * h;
  const heights = drawnHeights(field);
  const normals = gridNormals(heights, w, h, cell);
  const grounds = jitteredGrounds(field);
  const looks = field.grounds.map((g) => {
    const look = palette.look(g === '' || g === 'lake' ? 'sand' : g);
    return {
      top: look.top.map((c) => new THREE.Color(c)),
      side: look.side.map((c) => new THREE.Color(c)),
    };
  });
  const wet = new THREE.Color(palette.wet);
  // Flat colours first, blended across ground edges; slopes and the wet band go on after.
  const flat = [new Float32Array(n), new Float32Array(n), new Float32Array(n)] as const;
  const c = new THREE.Color();
  for (let k = 0; k < n; k++) {
    const x = field.x0 + (k % w) * cell,
      y = field.y0 + Math.floor(k / w) * cell;
    mottled(looks[grounds[k]!]!.top, valueNoise(x * draw.mottle, y * draw.mottle, seed + 5), c);
    flat[0][k] = c.r;
    flat[1][k] = c.g;
    flat[2][k] = c.b;
  }
  for (const channel of flat) blurGrid(channel, w, h, draw.blend / 2 / cell);
  const positions = new Float32Array(n * 3),
    colors = new Float32Array(n * 3);
  const side = new THREE.Color();
  for (let k = 0; k < n; k++) {
    const i = k % w,
      j = (k - i) / w;
    const x = field.x0 + i * cell,
      y = field.y0 + j * cell,
      height = heights[k]!;
    positions[k * 3] = x;
    positions[k * 3 + 1] = height;
    positions[k * 3 + 2] = -y;
    c.setRGB(flat[0][k]!, flat[1][k]!, flat[2][k]!);
    // Cliff colours in level bands, each a little wavy, like the classic tiers' layers.
    const bands = looks[grounds[k]!]!.side;
    const band = Math.floor(height / draw.bands + valueNoise(x * 0.1, y * 0.1, seed + 7) * 0.4);
    side.copy(bands[((band % bands.length) + bands.length) % bands.length]!);
    c.lerp(side, smoothstep(draw.slope[0]!, draw.slope[1]!, 1 - normals[k * 3 + 1]!));
    c.lerp(wet, 1 - smoothstep(draw.wet[0]!, draw.wet[1]!, height));
    colors[k * 3] = c.r;
    colors[k * 3 + 1] = c.g;
    colors[k * 3 + 2] = c.b;
  }
  const index: number[] = [];
  for (let j = 0; j + 1 < h; j++)
    for (let i = 0; i + 1 < w; i++) {
      const a = j * w + i,
        b = a + 1,
        d = a + w,
        e = a + w + 1;
      if (Math.max(heights[a]!, heights[b]!, heights[d]!, heights[e]!) < draw.hideBelow) continue;
      // Wound to face up: +x, then -z (the map's +y).
      index.push(a, b, d, b, e, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setIndex(index);
  return g;
}
