import { TUNING } from '../data/tuning';
import { designOf, type IslandDesign } from '../data/islands';
import type { IslandDef, TerrainDef } from './map';
import { insetOutline } from './coast';
import { insideOutline } from './flowShapes';
import {
  edgeDistance,
  flatLayout,
  islandBearing,
  islandLayout,
  islandPoint,
  isSloped,
  layoutGround,
  peakHeight,
  rampAt,
  type IslandLayout,
} from './islandLayout';
import { BEACH_TOP, ISLAND_SCALE } from './islandUnits';
import { sculptField } from './sculpt';

/**
 * The islands' ground as one grid of heights (decision 0222, issue #268): built from the island
 * files and terrain shapes alone, with no renderer, so the models, sim, editors and CLIs all read
 * the same ground. Samples sit on a world grid at the canonical spacing `terrain.json › cell`,
 * whatever the quality level; the renderer draws coarser copies (`fieldLod`), never another field.
 *
 * Coordinates are the sim's map plane: x east, y north (the scene's z is -y). Heights are world
 * units above the sea, which lies at `SEA_LEVEL`.
 */
export interface Heightfield {
  /** Map point of the first sample. */
  x0: number;
  y0: number;
  /** Spacing of the samples in map units. */
  cell: number;
  /** Samples along x and along y; sample (i, j) is at index j * w + i. */
  w: number;
  h: number;
  heights: Float32Array;
  /** 1 on level terrace ground (a raised surface's top, the beach), where buildings stand. */
  terrace: Uint8Array;
  /** Index into `grounds` per sample: the ground material there; 0 is open water. */
  ground: Uint8Array;
  grounds: string[];
  /** Height off the grid: the open seabed. */
  seabed: number;
  /** The island's seed, for the seeded passes that build on the field (relief, sculpting). */
  seed: number;
}

export const SEA_LEVEL = 0;
/** `grounds[0]`: no land, the sea (or a lake's water). */
const WATER = '';

/** One sample as a sampler writes it; reused, so building a field allocates no object per sample. */
interface Sample {
  height: number;
  ground: string;
  terrace: boolean;
}
/** Writes the ground at a map point into `out`; false where it is open sea. */
type Sampler = (x: number, y: number, out: Sample) => boolean;

/** The ground height at a map point, between samples linearly; the seabed off the grid. */
export function heightAt(field: Heightfield, x: number, y: number): number {
  const u = (x - field.x0) / field.cell,
    v = (y - field.y0) / field.cell;
  if (!(u >= 0 && v >= 0 && u <= field.w - 1 && v <= field.h - 1)) return field.seabed;
  const i = Math.min(Math.floor(u), field.w - 2),
    j = Math.min(Math.floor(v), field.h - 2);
  const s = u - i,
    t = v - j;
  const k = j * field.w + i,
    hs = field.heights;
  const near = hs[k]! + (hs[k + 1]! - hs[k]!) * s;
  const far = hs[k + field.w]! + (hs[k + field.w + 1]! - hs[k + field.w]!) * s;
  return near + (far - near) * t;
}

/** The nearest sample's index, or -1 off the grid. */
export function sampleIndex(field: Heightfield, x: number, y: number): number {
  const i = Math.round((x - field.x0) / field.cell),
    j = Math.round((y - field.y0) / field.cell);
  return i < 0 || j < 0 || i >= field.w || j >= field.h ? -1 : j * field.w + i;
}

/**
 * A coarser copy for drawing: one sample every `step` cells, read from the field itself, so
 * what stands on the ground and where the coast runs never depend on the quality level.
 */
export function fieldLod(field: Heightfield, step: number): Heightfield {
  if (step <= 1) return field;
  const cell = field.cell * step;
  const w = Math.ceil((field.w - 1) / step) + 1,
    h = Math.ceil((field.h - 1) / step) + 1;
  const lod: Heightfield = {
    ...field,
    cell,
    w,
    h,
    heights: new Float32Array(w * h),
    terrace: new Uint8Array(w * h),
    ground: new Uint8Array(w * h),
  };
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const x = field.x0 + i * cell,
        y = field.y0 + j * cell;
      const k = j * w + i,
        near = sampleIndex(field, x, y);
      lod.heights[k] = heightAt(field, x, y);
      if (near < 0) continue;
      lod.terrace[k] = field.terrace[near]!;
      lod.ground[k] = field.ground[near]!;
    }
  return lod;
}

/** A grid over a box (map units), snapped to the world grid, filled by a sampler. */
function rasterise(
  [minX, minY, maxX, maxY]: readonly [number, number, number, number],
  seed: number,
  sample: Sampler,
): Heightfield {
  const { cell, margin, seabed } = TUNING.terrain;
  const x0 = Math.floor((minX - margin) / cell) * cell,
    y0 = Math.floor((minY - margin) / cell) * cell;
  const w = Math.ceil((maxX + margin - x0) / cell) + 1,
    h = Math.ceil((maxY + margin - y0) / cell) + 1;
  const field: Heightfield = {
    x0,
    y0,
    cell,
    w,
    h,
    heights: new Float32Array(w * h),
    terrace: new Uint8Array(w * h),
    ground: new Uint8Array(w * h),
    grounds: [WATER],
    seabed,
    seed,
  };
  const out: Sample = { height: 0, ground: WATER, terrace: false };
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      if (!sample(x0 + i * cell, y0 + j * cell, out)) {
        field.heights[k] = seabed;
        continue;
      }
      field.heights[k] = out.height;
      field.terrace[k] = out.terrace ? 1 : 0;
      let g = field.grounds.indexOf(out.ground);
      if (g < 0) g = field.grounds.push(out.ground) - 1;
      field.ground[k] = g;
    }
  return field;
}

type Box = [number, number, number, number];

function boxOf(outlines: readonly TerrainDef['outline'][], pad = 0) {
  const box: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const outline of outlines)
    for (const [x, y] of outline) {
      box[0] = Math.min(box[0], x - pad);
      box[1] = Math.min(box[1], y - pad);
      box[2] = Math.max(box[2], x + pad);
      box[3] = Math.max(box[3], y + pad);
    }
  return box;
}

const inBox = (b: Box, x: number, y: number) => x >= b[0] && y >= b[1] && x <= b[2] && y <= b[3];

const outlineBoxes = new WeakMap<TerrainDef['outline'], Box>();
function outlineBox(outline: TerrainDef['outline']) {
  let box = outlineBoxes.get(outline);
  if (!box) outlineBoxes.set(outline, (box = boxOf([outline])));
  return box;
}
/** Inside an outline, its box tested first: most samples are far from most outlines. */
const inside = (outline: TerrainDef['outline'], x: number, y: number) =>
  inBox(outlineBox(outline), x, y) && insideOutline(x, y, outline);

const raisedBoxes = new WeakMap<IslandLayout, Box[]>();
/** Where ramps and sloped edges may lift the ground above the flat surfaces. */
function raisedAreas(layout: IslandLayout) {
  let boxes = raisedBoxes.get(layout);
  if (!boxes) {
    boxes = [
      ...layout.ramps.map((r) => boxOf([r.points], r.width / 2)),
      ...layout.surfaces
        .filter((s) => s.slope && s.shape !== 'peak')
        .map((s) => boxOf([s.outline], s.slope)),
    ];
    raisedBoxes.set(layout, boxes);
  }
  return boxes;
}

/** The material of a ramp or sloped edge that lifts the ground to `height`, if any. */
function raisedGround(layout: IslandLayout, x: number, z: number, height: number) {
  for (const r of layout.ramps) {
    const at = rampAt(r, x, z);
    if (at.distance <= r.width / 2 && Math.abs(at.height - height) < 1e-9) return r.material;
  }
  let best: { height: number; material: string } | null = null;
  for (const s of layout.surfaces) {
    if (!s.slope || s.shape === 'peak' || (best && best.height >= s.height)) continue;
    if (edgeDistance(s.outline, x, z, (i) => isSloped(s, i)) < s.slope) best = s;
  }
  return best?.material;
}

/**
 * The ground of an island file at a point in the island's own frame (radius units), as the
 * classic models build it: the beach, raised surfaces, their ramps and slopes, and mountains.
 */
function designedSample(layout: IslandLayout, x: number, z: number, out: Sample): boolean {
  if (!layout.coasts.some((c) => inside(c, x, z))) return false;
  if (layout.lake && inside(layout.lake, x, z)) {
    out.height = TUNING.terrain.lakeBed;
    out.ground = 'lake';
    out.terrace = false;
    return true;
  }
  let top = 0,
    ground = 'sand';
  for (const s of layout.surfaces)
    if (
      s.shape !== 'peak' &&
      s.height > top &&
      inside(s.outline, x, z) &&
      !s.holes?.some((h) => inside(h, x, z))
    ) {
      top = s.height;
      ground = s.material;
    }
  const raised = raisedAreas(layout).some((b) => inBox(b, x, z));
  let height = raised ? Math.max(top, layoutGround(flatLayout(layout), x, z, 0) ?? 0) : top;
  let terrace = height <= top;
  if (!terrace) ground = raisedGround(layout, x, z, height) ?? ground;
  for (const s of layout.surfaces) {
    // A mountain's cone stands on the box round its outline (peakBox).
    if (s.shape !== 'peak' || !inBox(outlineBox(s.outline), x, z)) continue;
    const peak = peakHeight(s, x, z);
    if (peak === null || peak <= height) continue;
    height = peak;
    ground = s.material;
    terrace = false;
  }
  out.height = height;
  out.ground = ground;
  out.terrace = terrace;
  return true;
}

const BEACH_HEIGHT = BEACH_TOP * ISLAND_SCALE;

/** An island file's sampler in map units: its frame turned to the harbour bearing (islandPoint). */
function designSampler(island: IslandDef, design: IslandDesign, level: number): Sampler {
  const layout = islandLayout(design, level);
  const a = Math.PI - islandBearing(island);
  const c = Math.cos(a),
    s = Math.sin(a);
  return (x, y, out) => {
    const dx = (x - island.x) / island.radius,
      dy = (y - island.y) / island.radius;
    if (!designedSample(layout, c * dx + s * dy, s * dx - c * dy, out)) return false;
    // Radius units to world: R = radius / ISLAND_SCALE reference units, drawn ISLAND_SCALE bigger.
    if (out.ground !== 'lake') out.height = Math.max(BEACH_HEIGHT, out.height * island.radius);
    return true;
  };
}

const fieldCache = new WeakMap<
  IslandDef,
  { design: IslandDesign | null; fields: Map<string, Heightfield> }
>();

/**
 * The height field of an island at a settlement level (its file's ground at that level). An
 * island without a file is its collision circle at beach height. Cached; never change the result.
 */
export function islandHeightfield(island: IslandDef, level = 4): Heightfield {
  const design = designOf(island);
  const { cell, margin, seabed, lakeBed } = TUNING.terrain;
  const key = [
    level,
    island.x,
    island.y,
    island.radius,
    islandBearing(island),
    cell,
    margin,
    seabed,
    lakeBed,
  ].join('/');
  let cached = fieldCache.get(island);
  // The island builder replaces a design with an edited copy: the cache follows it.
  if (cached?.design !== design) fieldCache.set(island, (cached = { design, fields: new Map() }));
  let field = cached.fields.get(key);
  if (!field) {
    field = design ? designHeightfield(island, design, level) : legacyField(island);
    cached.fields.set(key, field);
  }
  return field;
}

/**
 * An island file's field placed as `island`, built afresh: its generated ground, then its hand
 * edits (decision 0230). For a file that is not the map's own, as the island checks and the
 * sculpting session use.
 */
export function designHeightfield(island: IslandDef, design: IslandDesign, level = 4): Heightfield {
  const coasts = design.coasts.map((c) =>
    c.map(([x, z]): [number, number] => {
      const p = islandPoint(island, x, z);
      return [p.x, p.y];
    }),
  );
  const field = rasterise(boxOf(coasts), design.seed, designSampler(island, design, level));
  return sculptField(field, island, design);
}

function legacyField(island: IslandDef): Heightfield {
  const r = island.radius;
  return rasterise([island.x - r, island.y - r, island.x + r, island.y + r], 0, (x, y, out) => {
    if (Math.hypot(x - island.x, y - island.y) > r) return false;
    out.height = BEACH_HEIGHT;
    out.ground = 'sand';
    out.terrace = true;
    return true;
  });
}

/** Grounds of a barrier island's tiers, beach first (`terrain.json › ridge`). */
const RIDGE_GROUNDS = ['sand', 'rock', 'rock', 'grass'];

/**
 * The height field of a terrain shape that stands above the sea: a barrier island's tiers
 * (decision 0031) or a sandbank. Reefs, ice, shallows and bergs have no ground here: null.
 */
export function terrainHeightfield(feature: TerrainDef, seed: number): Heightfield | null {
  const box = boxOf([feature.outline]);
  if (feature.kind === 'sandbank') {
    const top = TUNING.terrain.sandbankTop;
    return rasterise(box, seed, (x, y, out) => {
      if (!inside(feature.outline, x, y)) return false;
      out.height = top;
      out.ground = 'sand';
      out.terrace = true;
      return true;
    });
  }
  if (feature.kind !== 'island') return null;
  const { insets, tops } = TUNING.terrain.ridge;
  const tiers = insets.map((inset) =>
    inset ? insetOutline(feature.outline, inset) : feature.outline,
  );
  const last = tiers.length - 1;
  return rasterise(box, seed, (x, y, out) => {
    let tier = -1;
    for (let k = last; k >= 0 && tier < 0; k--) if (inside(tiers[k]!, x, y)) tier = k;
    if (tier < 0) return false;
    out.height = tops[tier]!;
    out.ground = RIDGE_GROUNDS[tier] ?? 'grass';
    out.terrace = tier === last;
    return true;
  });
}
