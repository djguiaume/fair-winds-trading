import { groundColors } from '../data/grounds';
import { type ForestBiome, FORESTS, forestBiome } from '../data/forests';
import { atLevel, type IslandDesign, LANE_WIDTH } from '../data/islands';
import { type Heightfield, heightAt, sampleIndex } from './heightfield';
import { islandBearing, islandPoint } from './islandLayout';
import { ISLAND_SCALE } from './islandUnits';
import type { IslandDef } from './map';
import { fbm, fbmQuantile, hash01 } from './noise';
import type { Region } from './sculpt';

/**
 * The new look's forests (issue #275, decision 0222): where an island's trees stand, from its
 * height field, its file's woods and its biome's recipe (`src/data/forests.json`). No renderer
 * here, so the tests and tools read the same trees the game draws.
 *
 * Each candidate tree sits on its own grid cell and draws all its numbers from a hash of the
 * island's seed and that cell, never from a running generator: a tree depends only on the ground
 * round it, so after a sculpt edit `replantRegion` redoes the edited corner alone and gets exactly
 * what a full planting would.
 */
export interface ForestTree {
  /** Map point (x east, y north) and the ground's height there, world units. */
  x: number;
  y: number;
  height: number;
  kind: string;
  /** The model's scale, reference model → world. */
  scale: number;
  yaw: number;
  /** Index into its kind's `tints`. */
  tint: number;
  /** 0 to 1: a quality level draws the trees ranked under its `share`, the same ones each time. */
  rank: number;
}

/** Ground the town keeps clear, in the island file's units (radius units, harbour toward +z). */
export interface ForestClearings {
  /** Circles [x, z, r]: placed props with their margins (houses: 1.5 house widths), the harbour. */
  circles: [number, number, number][];
  /** Houses [x, z] the harbour camera looks at. */
  homes: [number, number][];
  /** Where the harbour camera stands, [x, z] in the file's units; none: no view to keep. */
  camera?: [number, number];
}

export interface ForestInput {
  island: IslandDef;
  design: IslandDesign;
  field: Heightfield;
  /** The town level drawn: piers and lanes come and go with it. */
  level: number;
  clearings: ForestClearings;
}

/** A box of map points: [x0, y0, x1, y1]. */
export type MapBox = [number, number, number, number];

/** Salts so each number a cell draws is its own. */
const enum Salt {
  JitterX = 11,
  JitterZ = 23,
  Keep = 37,
  Kind = 41,
  Scale = 53,
  Yaw = 67,
  Tint = 79,
  Rank = 83,
}

/** An island file point from a map point: `islandPoint` undone (a reflection: its own inverse). */
export function filePoint(island: IslandDef, x: number, y: number): [number, number] {
  const a = Math.PI - islandBearing(island);
  const dx = (x - island.x) / island.radius,
    dy = (y - island.y) / island.radius;
  return [Math.cos(a) * dx + Math.sin(a) * dy, Math.sin(a) * dx - Math.cos(a) * dy];
}

/** The island's highest ground: kinds grow between shares of it. */
const tops = new WeakMap<Heightfield, number>();
function topOf(field: Heightfield) {
  let top = tops.get(field);
  if (top === undefined) {
    top = 0;
    for (let k = 0; k < field.heights.length; k++)
      if (field.ground[k]) top = Math.max(top, field.heights[k]!);
    tops.set(field, top);
  }
  return top;
}

/** Steepness in degrees at a map point, from the field's heights a cell either side. */
function slopeAt(field: Heightfield, x: number, y: number) {
  const d = field.cell;
  const gx = (heightAt(field, x + d, y) - heightAt(field, x - d, y)) / (2 * d),
    gy = (heightAt(field, x, y + d) - heightAt(field, x, y - d)) / (2 * d);
  return (Math.atan(Math.hypot(gx, gy)) * 180) / Math.PI;
}

/** Every circle the trees keep out of, in file units: the town's, lanes, piers, build spots. */
function clearCircles(input: ForestInput): [number, number, number][] {
  const { design, island, level, clearings } = input;
  const { clear } = FORESTS;
  const out = [...clearings.circles];
  for (const lane of design.lanes) {
    const r = (lane.width ?? LANE_WIDTH) / 2 + clear.lane / island.radius;
    for (let k = 1; k < lane.points.length; k++) {
      const [ax, az] = lane.points[k - 1]!,
        [bx, bz] = lane.points[k]!;
      const n = Math.max(1, Math.ceil(Math.hypot(bx! - ax!, bz! - az!) / r));
      for (let s = 0; s <= n; s++)
        out.push([ax! + ((bx! - ax!) * s) / n, az! + ((bz! - az!) * s) / n, r]);
    }
  }
  for (const pier of design.piers)
    if (atLevel(pier, level)) out.push([pier.x, pier.z, clear.pier / island.radius]);
  for (const spot of design.homeSpots ?? []) out.push([spot.x, spot.z, clear.plot / island.radius]);
  for (const c of design.woods.clear ?? []) out.push(c);
  return out;
}

/** Is a file point on the harbour camera's line to a house? */
function inView(input: ForestInput, x: number, z: number) {
  const { camera, homes } = input.clearings;
  if (!camera) return false;
  const half = FORESTS.clear.view / input.island.radius;
  const [cx, cz] = camera;
  return homes.some(([hx, hz]) => {
    const dx = hx - cx,
      dz = hz - cz;
    const t = ((x - cx) * dx + (z - cz) * dz) / (dx * dx + dz * dz || 1);
    if (t <= 0 || t >= 1) return false;
    return Math.hypot(cx + dx * t - x, cz + dz * t - z) < half;
  });
}

/** The chance a tree grows where the clump noise is `n`: full inside a clump, a ragged edge. */
function clumpChance(n: number, edge: number) {
  const { fill, ragged } = FORESTS.clump;
  const t = Math.min(1, Math.max(0, (n - edge + ragged) / (2 * ragged)));
  return fill * t * t * (3 - 2 * t);
}

/** The kind that grows at a share of the island's top, picked by weight; none: no tree. */
function kindAt(biome: ForestBiome, t: number, pick: number): string | undefined {
  const fits = biome.trees.filter((e) => t >= (e.from ?? 0) && t <= (e.to ?? 1));
  let left = pick * fits.reduce((sum, e) => sum + e.share, 0);
  return fits.find((e) => (left -= e.share) < 0)?.kind ?? fits[fits.length - 1]?.kind;
}

/**
 * The trees of an island at a level; with `box`, only those standing inside it (map units).
 * None where the file's woods are off (`tries` 0) or its biome grows none.
 */
export function plantForest(input: ForestInput, box?: MapBox): ForestTree[] {
  const { island, design, field } = input;
  const woods = design.woods;
  const biome = forestBiome(design.style);
  const density = woods.density ?? 1;
  const cover = Math.min(1, (biome?.cover ?? 0) * density);
  if (!biome || cover <= 0 || !woods.tries) return [];
  const { spacing, jitter, clump } = FORESTS;
  // Painted woods are the forest itself, grown thick; elsewhere the noise's highest ground grows
  // clumps over the biome's share of the free land.
  const painted = !!woods.areas?.length;
  const edge = fbmQuantile(clump.octaves, 1 - Math.min(1, cover / clump.fill));
  const unit = woods.size * ISLAND_SCALE;
  const step = (spacing * unit) / island.radius;
  const noiseScale = clump.scale * island.radius;
  const circles = clearCircles(input);
  const top = topOf(field) || 1;
  const seed = design.seed;
  const [x0, z0, x1, z1] = woods.area;
  const out: ForestTree[] = [];
  for (let j = Math.ceil(z0 / step); j * step <= z1; j++)
    for (let i = Math.ceil(x0 / step); i * step <= x1; i++) {
      const fx = (i + (hash01(seed + Salt.JitterX, i, j) - 0.5) * jitter) * step,
        fz = (j + (hash01(seed + Salt.JitterZ, i, j) - 0.5) * jitter) * step;
      const p = islandPoint(island, fx, fz);
      if (box && !(p.x >= box[0] && p.x <= box[2] && p.y >= box[1] && p.y <= box[3])) continue;
      if (painted && !woods.areas!.some(([x, z, r]) => Math.hypot(fx - x, fz - z) < r)) continue;
      if (circles.some(([x, z, r]) => Math.hypot(fx - x, fz - z) < r)) continue;
      const height = heightAt(field, p.x, p.y);
      if (height < biome.minHeight) continue;
      const k = sampleIndex(field, p.x, p.y);
      const ground = k < 0 ? '' : field.grounds[field.ground[k]!]!;
      if (!ground || ground === 'lake' || !groundColors(ground, design.style).trees) continue;
      if (slopeAt(field, p.x, p.y) > biome.maxSlope) continue;
      // In the file's frame, so an island's clumps stay put wherever its sea places it.
      const n = fbm(seed, fx * noiseScale, fz * noiseScale, clump.octaves);
      const chance = painted ? Math.min(1, clump.fill * density) : clumpChance(n, edge);
      if (hash01(seed + Salt.Keep, i, j) >= chance) continue;
      const kind = kindAt(biome, height / top, hash01(seed + Salt.Kind, i, j));
      if (!kind || inView(input, fx, fz)) continue;
      const look = FORESTS.kinds[kind]!;
      const [lo, hi] = look.scale;
      out.push({
        x: p.x,
        y: p.y,
        height,
        kind,
        scale: unit * (lo + (hi - lo) * hash01(seed + Salt.Scale, i, j)),
        yaw: hash01(seed + Salt.Yaw, i, j) * Math.PI * 2,
        tint: Math.floor(hash01(seed + Salt.Tint, i, j) * look.tints.length),
        rank: hash01(seed + Salt.Rank, i, j),
      });
    }
  return out;
}

/** A sculpt region (field samples) as a map box, two cells wider all round: slopes read past it. */
export function regionBox(field: Heightfield, r: Region): MapBox {
  const c = field.cell;
  return [
    field.x0 + (r.i0 - 2) * c,
    field.y0 + (r.j0 - 2) * c,
    field.x0 + (r.i1 + 2) * c,
    field.y0 + (r.j1 + 2) * c,
  ];
}

/** The trees after the ground changed inside `box`: those outside kept as they are. */
export function replantRegion(trees: ForestTree[], input: ForestInput, box: MapBox): ForestTree[] {
  const outside = trees.filter(
    (t) => !(t.x >= box[0] && t.x <= box[2] && t.y >= box[1] && t.y <= box[3]),
  );
  return [...outside, ...plantForest(input, box)];
}
