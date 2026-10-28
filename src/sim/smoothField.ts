import { TUNING } from '../data/tuning';
import { atLevel, type IslandDesign } from '../data/islands';
import type { Heightfield } from './heightfield';
import { fbm } from './noise';
import { coastDistance } from './coast';
import type { Outline } from './islandLayout';

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The new look's rolling ground (decision 0222, issue #269): the height field's classic tiers
 * blurred into slopes, a little relief on the land, the town kept on its terraces, and the
 * waterline kept on the sim's coast. Numbers in `terrain.json › smooth`. Each sample's `smooth`
 * (its shape's `smooth` in the island file) sets how much of this it takes: 0 keeps it exactly
 * as built and leaves it out of its neighbours' blur, so a sea stack or a crater rim stays sharp
 * without raising a skirt round it.
 */

/** A circle of ground that keeps its terrace (a house, a build spot, a ramp): map units. */
export interface KeepArea {
  x: number;
  y: number;
  r: number;
}

/** A Gaussian kernel's taps from the centre out, for a sigma in cells. */
function kernel(sigma: number) {
  const reach = Math.max(1, Math.ceil(sigma * 3));
  const taps = new Float32Array(reach + 1);
  for (let i = 0; i <= reach; i++) taps[i] = Math.exp(-(i * i) / (2 * sigma * sigma));
  return taps;
}

/** One pass of a weighted blur along x (`stride` 1) or y (`stride` w), from `src` into `out`. */
function pass(
  src: Float32Array,
  out: Float32Array,
  taps: Float32Array,
  w: number,
  h: number,
  alongX: boolean,
) {
  const reach = taps.length - 1;
  const [lines, length, stride, step] = alongX ? [h, w, w, 1] : [w, h, 1, w];
  for (let line = 0; line < lines; line++) {
    const start = line * stride;
    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (let d = -reach; d <= reach; d++) {
        const at = i + d;
        if (at >= 0 && at < length) sum += src[start + at * step]! * taps[Math.abs(d)]!;
      }
      out[start + i * step] = sum;
    }
  }
}

/**
 * Blurs `values` in place, each sample counting by its `weight`: a normalised convolution, so a
 * weight-0 sample neither moves nor pulls on its neighbours.
 */
function weightedBlur(
  values: Float32Array,
  weight: Float32Array,
  w: number,
  h: number,
  sigma: number,
) {
  if (sigma <= 0) return;
  const taps = kernel(sigma);
  const n = values.length;
  const num = new Float32Array(n),
    den = new Float32Array(n),
    tmp = new Float32Array(n);
  for (let k = 0; k < n; k++) num[k] = values[k]! * weight[k]!;
  pass(num, tmp, taps, w, h, true);
  pass(tmp, num, taps, w, h, false);
  pass(weight, tmp, taps, w, h, true);
  pass(tmp, den, taps, w, h, false);
  for (let k = 0; k < n; k++) if (weight[k]! > 0 && den[k]! > 1e-6) values[k] = num[k]! / den[k]!;
}

/** A plain Gaussian blur of a grid of values in place (sigma in cells): colour blends. */
export function blurGrid(values: Float32Array, w: number, h: number, sigma: number) {
  weightedBlur(values, new Float32Array(values.length).fill(1), w, h, sigma);
}

/** 1 on samples inside any keep area. */
function keepMask(field: Heightfield, areas: readonly KeepArea[], margin: number) {
  const { w, h, x0, y0, cell } = field;
  const mask = new Uint8Array(w * h);
  for (const a of areas) {
    const r = a.r + margin;
    const i0 = Math.max(0, Math.floor((a.x - r - x0) / cell)),
      i1 = Math.min(w - 1, Math.ceil((a.x + r - x0) / cell)),
      j0 = Math.max(0, Math.floor((a.y - r - y0) / cell)),
      j1 = Math.min(h - 1, Math.ceil((a.y + r - y0) / cell));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++)
        if (Math.hypot(x0 + i * cell - a.x, y0 + j * cell - a.y) <= r) mask[j * w + i] = 1;
  }
  return mask;
}

/** 1 on samples within `reach` map units of a change between land and sea. */
function nearShore(field: Heightfield, reach: number) {
  const { w, h, ground, cell } = field;
  const near = new Uint8Array(w * h);
  const r = Math.ceil(reach / cell);
  const mark = (i: number, j: number) => {
    for (let jj = Math.max(0, j - r); jj <= Math.min(h - 1, j + r); jj++)
      near.fill(1, jj * w + Math.max(0, i - r), jj * w + Math.min(w - 1, i + r) + 1);
  };
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = j * w + i,
        land = !ground[k];
      if ((i + 1 < w && !ground[k + 1] !== land) || (j + 1 < h && !ground[k + w] !== land))
        mark(i, j);
    }
  return near;
}

/**
 * Smooths a freshly rasterised field in place and returns it. Near the coast the ground follows
 * a gentle shore profile from the true outline (`coasts`, map units), so the waterline runs on
 * the sim's coast, not on the grid's steps; under water the blurred shore deepens to the seabed.
 */
export function smoothField(
  field: Heightfield,
  keep: readonly KeepArea[] = [],
  coasts: readonly Outline[] = [],
): Heightfield {
  const t = TUNING.terrain.smooth;
  if (t.amount <= 0) return field;
  const { w, h, cell, ground, seabed } = field;
  const n = w * h;
  const raw = Float32Array.from(field.heights);
  const weight = new Float32Array(n);
  const work = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const land = ground[k] !== 0;
    weight[k] = land ? Math.min(1, field.smooth[k]! * t.amount) : 1;
    // The sea at the beach's height below the water: the blur's midpoint stays on the coast.
    work[k] = land ? raw[k]! : t.shoreSea;
  }
  weightedBlur(work, weight, w, h, t.blur / cell);
  const { scale, height, fadeIn, octaves } = t.relief;
  for (let k = 0; k < n; k++) {
    if (!ground[k] || !weight[k]) continue;
    const i = k % w,
      j = (k - i) / w;
    const x = field.x0 + i * cell,
      y = field.y0 + j * cell;
    const fade = Math.min(1, Math.max(0, work[k]! / fadeIn));
    work[k] = work[k]! + fbm(x * scale, y * scale, field.seed, octaves) * height * fade;
  }
  const kept = keepMask(field, keep, t.town.radius);
  for (let k = 0; k < n; k++)
    if (kept[k] && ground[k]) work[k] = work[k]! + (raw[k]! - work[k]!) * t.town.keep;
  weightedBlur(work, weight, w, h, t.seamBlur / cell);
  const deepen = seabed / t.shoreSea;
  const { band, slope } = t.shore;
  const near = coasts.length ? nearShore(field, band) : null;
  for (let k = 0; k < n; k++) {
    const land = ground[k] !== 0,
      s = weight[k]!;
    let height = land ? raw[k]! + (work[k]! - raw[k]!) * s : work[k]!;
    // How far out of the shore's band: 0 on the coast, 1 past it.
    let out = 1;
    if (near?.[k] && s > 0) {
      const x = field.x0 + (k % w) * cell,
        y = field.y0 + Math.floor(k / w) * cell;
      // Signed distance inland from the nearest coast (negative at sea).
      let inland = -Infinity;
      for (const c of coasts) inland = Math.max(inland, -coastDistance(x, y, c).distance);
      out = smoothstep(0, band, Math.abs(inland));
      height = inland * slope * (1 - out) + height * out;
    }
    if (land) field.heights[k] = Math.max(out < 1 ? 0.01 : t.landMin, height);
    else {
      // Deepened only past the shore's band, so the slope has no kink at the waterline.
      const under = Math.min(out < 1 ? -0.01 : t.seaMax, height) * (1 + (deepen - 1) * out);
      field.heights[k] = under <= seabed + 0.02 ? seabed : under;
    }
  }
  return field;
}

/**
 * Where an island file's town keeps its terraces at a level: its props, build spots, pier roots
 * and ramps, turned to map units by `toMap` (radius units in, as `islandPoint`).
 */
export function townKeepAreas(
  design: IslandDesign,
  level: number,
  radius: number,
  toMap: (x: number, z: number) => { x: number; y: number },
): KeepArea[] {
  const at = (x: number, z: number, r: number) => ({ ...toMap(x, z), r });
  const areas: KeepArea[] = [
    ...design.props.filter((p) => atLevel(p, level)).map((p) => at(p.x, p.z, 0)),
    ...(design.homeSpots ?? []).map((s) => at(s.x, s.z, 0)),
    ...design.piers.filter((p) => atLevel(p, level)).map((p) => at(p.x, p.z, 0)),
  ];
  // Ramps lead up to the terraces: kept along their whole length, as wide as they are.
  for (const ramp of design.ramps ?? []) {
    if (!atLevel(ramp, level)) continue;
    const half = (ramp.width / 2) * radius;
    for (let i = 1; i < ramp.points.length; i++) {
      const [ax, az] = ramp.points[i - 1]!,
        [bx, bz] = ramp.points[i]!;
      const steps = Math.max(1, Math.ceil((Math.hypot(bx - ax, bz - az) * radius) / half));
      for (let s = 0; s <= steps; s++)
        areas.push(at(ax + ((bx - ax) * s) / steps, az + ((bz - az) * s) / steps, half));
    }
  }
  return areas;
}
