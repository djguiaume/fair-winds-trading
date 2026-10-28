import { type Heightfield, SEA_LEVEL } from '../sim/heightfield';
import type { TerrainDef } from '../sim/map';
import { insideOutline } from '../sim/fog';
import { TUNING } from '../data/tuning';

/**
 * The depth of the sea over the whole map (issue #274), baked once from the islands' height fields
 * and the terrain shapes: the highest ground in each cell, a soft shelf blurred out from the coast,
 * then the depth as a share of `fullDepth` (0 at the coast, 1 for deep water). Plain TypeScript,
 * no three.js, so it is tested without a renderer.
 *
 * The grid is in scene coordinates (x east, z = -y south), like the shore bake: cell (i, j) covers
 * x0 + i·cell to x0 + (i + 1)·cell, and the same along z.
 */
export interface SeabedDepth {
  x0: number;
  z0: number;
  cell: number;
  w: number;
  h: number;
  /** 0 (shallow) to 255 (deep) per cell, row by row along z. */
  depth: Uint8Array;
}

export type DepthTuning = typeof TUNING.graphics.water.depth;

/** Terrain kinds with a bed in `water.depth.beds`; bergs drift over open water and have none. */
type BedKind = keyof DepthTuning['beds'];
const hasBed = (kind: string): kind is BedKind => kind in TUNING.graphics.water.depth.beds;

export function bakeSeabedDepth(
  fields: readonly Heightfield[],
  terrain: readonly TerrainDef[],
  tune: DepthTuning = TUNING.graphics.water.depth,
): SeabedDepth {
  const shapes = terrain.filter((t) => hasBed(t.kind));
  const pad = tune.blur * tune.cell * 3 + tune.fullDepth;
  const box = boundsOf(fields, shapes, pad);
  // Same sharpness on any map, within the memory cap: a bigger map gets coarser cells. The grid
  // is snapped to whole cells so an edit elsewhere never shifts the cells under a coast.
  const fit = tune.maxTexels - 2;
  const cell = Math.max(tune.cell, (box[2] - box[0]) / fit, (box[3] - box[1]) / fit);
  const x0 = Math.floor(box[0] / cell) * cell,
    z0 = Math.floor(box[1] / cell) * cell;
  const w = Math.max(1, Math.ceil((box[2] - x0) / cell));
  const h = Math.max(1, Math.ceil((box[3] - z0) / cell));
  const grid = { x0, z0, cell, w, h };
  const beds = new Float32Array(w * h).fill(tune.deepBed);
  for (const field of fields) splatField(beds, grid, field, tune.land);
  for (const shape of shapes) fillShape(beds, grid, shape, tune.beds[shape.kind as BedKind]);
  blur(beds, w, h, tune.blur);
  const depth = new Uint8Array(w * h);
  for (let k = 0; k < depth.length; k++)
    depth[k] = Math.round(Math.min(1, Math.max(0, -beds[k]! / tune.fullDepth)) * 255);
  return { ...grid, depth };
}

type Grid = Omit<SeabedDepth, 'depth'>;
type Box = [x0: number, z0: number, x1: number, z1: number];

/** The scene box holding every field and shape, padded for the shelf; a small box when empty. */
function boundsOf(fields: readonly Heightfield[], shapes: readonly TerrainDef[], pad: number): Box {
  const box: Box = [Infinity, Infinity, -Infinity, -Infinity];
  const add = (x: number, y: number) => {
    box[0] = Math.min(box[0], x - pad);
    box[1] = Math.min(box[1], -y - pad);
    box[2] = Math.max(box[2], x + pad);
    box[3] = Math.max(box[3], -y + pad);
  };
  for (const f of fields) {
    add(f.x0, f.y0);
    add(f.x0 + (f.w - 1) * f.cell, f.y0 + (f.h - 1) * f.cell);
  }
  for (const s of shapes) for (const [x, y] of s.outline) add(x, y);
  return box[0] < box[2] ? box : [-1, -1, 1, 1];
}

/**
 * The highest ground of a field in each depth cell, any land counting as `land` so the shelf's
 * slope does not depend on how high the coast is. The flat open seabed a field keeps round its
 * island is left out: its box is a rectangle, and the shelf should follow the coast.
 */
function splatField(beds: Float32Array, grid: Grid, field: Heightfield, land: number) {
  const { heights, w, h, cell, x0, y0, seabed } = field;
  for (let j = 0; j < h; j++) {
    const z = -(y0 + j * cell);
    const row = Math.floor((z - grid.z0) / grid.cell);
    if (row < 0 || row >= grid.h) continue;
    for (let i = 0; i < w; i++) {
      const height = heights[j * w + i]!;
      if (height <= seabed) continue;
      const col = Math.floor((x0 + i * cell - grid.x0) / grid.cell);
      if (col < 0 || col >= grid.w) continue;
      const k = row * grid.w + col;
      beds[k] = Math.max(beds[k]!, height > SEA_LEVEL ? land : height);
    }
  }
}

/** A terrain shape's bed in every cell whose middle lies inside its outline. */
function fillShape(beds: Float32Array, grid: Grid, shape: TerrainDef, bed: number) {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const [x, y] of shape.outline) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const ia = Math.max(0, Math.floor((minX - grid.x0) / grid.cell)),
    ib = Math.min(grid.w - 1, Math.floor((maxX - grid.x0) / grid.cell));
  const ja = Math.max(0, Math.floor((-maxY - grid.z0) / grid.cell)),
    jb = Math.min(grid.h - 1, Math.floor((-minY - grid.z0) / grid.cell));
  for (let j = ja; j <= jb; j++)
    for (let i = ia; i <= ib; i++) {
      const x = grid.x0 + (i + 0.5) * grid.cell,
        y = -(grid.z0 + (j + 0.5) * grid.cell);
      const k = j * grid.w + i;
      if (beds[k]! < bed && insideOutline(x, y, shape.outline)) beds[k] = bed;
    }
}

/** Gaussian blur in place, rows then columns; `sigma` in cells, 0 leaves the grid as it is. */
function blur(values: Float32Array, w: number, h: number, sigma: number) {
  if (sigma <= 0) return;
  const radius = Math.ceil(sigma * 3);
  const kernel = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let k = -radius; k <= radius; k++)
    sum += kernel[k + radius] = Math.exp(-(k * k) / (2 * sigma * sigma));
  kernel.forEach((v, k) => (kernel[k] = v / sum));
  // One line at a time, padded with its edge cells: off the grid counts as the nearest edge cell,
  // so the open sea stays at its depth, and the inner loop needs no bounds checks.
  const line = new Float32Array(Math.max(w, h) + radius * 2);
  const pass = (count: number, length: number, stride: number, step: number) => {
    for (let l = 0; l < count; l++) {
      const base = l * stride;
      for (let a = 0; a < length; a++) line[a + radius] = values[base + a * step]!;
      line.fill(line[radius]!, 0, radius);
      line.fill(line[radius + length - 1]!, radius + length, length + radius * 2);
      for (let a = 0; a < length; a++) {
        let v = 0;
        for (let k = 0; k < kernel.length; k++) v += line[a + k]! * kernel[k]!;
        values[base + a * step] = v;
      }
    }
  };
  pass(h, w, w, 1);
  pass(w, h, 1, w);
}
