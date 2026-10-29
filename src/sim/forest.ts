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
  /** 0 to 1: a quality level draws the lowest-ranked `share` of each kind, the same ones each time. */
  rank: number;
}

/** Ground the town keeps clear, in the island file's units (radius units, harbour toward +z). */
export interface ForestClearings {
  /** Circles [x, z, r]: placed props with their margins (houses: 1.5 house widths), the harbour. */
  circles: [number, number, number][];
  /** Houses [x, z] the harbour camera looks at. */
  homes: [number, number][];
  /** The lane pieces drawn at this level [ax, az, bx, bz, half width]: hedgerows line them. */
  lanes: [number, number, number, number, number][];
  /**
   * Where the harbour camera stands: [x, z] in the file's units and its height in world units;
   * none: no view to keep.
   */
  camera?: [number, number, number];
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
  Small = 97,
  Hedge = 101,
  /** Added to every salt for a small tree's companion in the same cell. */
  Companion = 1000,
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

/**
 * Would a tree whose top is at `top` (world units) at file point (x, z) stand in the harbour
 * camera's line to a house? Only near the line and above it: the camera looks down from high
 * up, so trees well out from the town stay under its view.
 */
function inView(pl: Planting, x: number, z: number, top: number) {
  const { camera } = pl.input.clearings;
  if (!camera) return false;
  const half = FORESTS.clear.view / pl.input.island.radius;
  const [cx, cz, cy] = camera;
  return pl.homes.some(([hx, hz, hy]) => {
    const dx = cx - hx,
      dz = cz - hz;
    const t = ((x - hx) * dx + (z - hz) * dz) / (dx * dx + dz * dz || 1);
    if (t <= 0 || t >= 1 || top <= hy + (cy - hy) * t) return false;
    return Math.hypot(hx + dx * t - x, hz + dz * t - z) < half;
  });
}

/** A clump's chance and how deep inside it a point is (0 at its edge, 1 well inside). */
function clumpAt(n: number, edge: number) {
  const { fill, ragged } = FORESTS.clump;
  const t = Math.min(1, Math.max(0, (n - edge + ragged) / (2 * ragged)));
  const core = Math.min(1, Math.max(0, (n - edge + ragged) / (6 * ragged)));
  return { chance: fill * t * t * (3 - 2 * t), core };
}

/** How deep inside the painted woods a point is: 0 at their edge, 1 at a circle's middle. */
function paintedDepth(areas: [number, number, number][], x: number, z: number) {
  let depth = -1;
  for (const [cx, cz, r] of areas) depth = Math.max(depth, 1 - Math.hypot(x - cx, z - cz) / r);
  return depth;
}

/** The kind that grows at a share of the island's top, picked by weight; none: no tree. */
function kindAt(biome: ForestBiome, t: number, pick: number): string | undefined {
  const fits = biome.trees.filter((e) => t >= (e.from ?? 0) && t <= (e.to ?? 1));
  let left = pick * fits.reduce((sum, e) => sum + e.share, 0);
  return fits.find((e) => (left -= e.share) < 0)?.kind ?? fits[fits.length - 1]?.kind;
}

/** What one planting reads, worked out once. */
interface Planting {
  input: ForestInput;
  biome: ForestBiome;
  circles: [number, number, number][];
  top: number;
  seed: number;
  /** World units per tree size: the island's `woods.size`. */
  unit: number;
  box?: MapBox;
  /** The houses [x, z] and the height of the ground under them, world units. */
  homes: [number, number, number][];
}

/**
 * A tree at file point (fx, fz), drawing its numbers from cell (i, j) with `salt` added; none
 * where the ground or the town says no, or where its `chance` fails. `core` (0 to 1) is how deep
 * in its wood it stands: a lower quality level drops the trees at the edges first.
 */
function treeAt(
  pl: Planting,
  fx: number,
  fz: number,
  i: number,
  j: number,
  salt: number,
  chance: number,
  core: number,
  small: boolean,
): ForestTree | null {
  const { input, biome, seed } = pl;
  const { island, field, design } = input;
  const p = islandPoint(island, fx, fz);
  const box = pl.box;
  if (box && !(p.x >= box[0] && p.x <= box[2] && p.y >= box[1] && p.y <= box[3])) return null;
  if (pl.circles.some(([x, z, r]) => Math.hypot(fx - x, fz - z) < r)) return null;
  const height = heightAt(field, p.x, p.y);
  if (height < biome.minHeight) return null;
  const k = sampleIndex(field, p.x, p.y);
  const ground = k < 0 ? '' : field.grounds[field.ground[k]!]!;
  if (!ground || ground === 'lake' || !groundColors(ground, design.style).trees) return null;
  if (slopeAt(field, p.x, p.y) > biome.maxSlope) return null;
  if (hash01(seed + salt + Salt.Keep, i, j) >= chance) return null;
  const kind = kindAt(biome, height / pl.top, hash01(seed + salt + Salt.Kind, i, j));
  if (!kind) return null;
  const look = FORESTS.kinds[kind]!;
  const [lo, hi] = look.scale;
  const size = lo + (hi - lo) * hash01(seed + salt + Salt.Scale, i, j);
  const scale = pl.unit * size * (small ? FORESTS.small.scale : 1);
  if (inView(pl, fx, fz, height + look.height * scale)) return null;
  const { thinning } = FORESTS;
  return {
    x: p.x,
    y: p.y,
    height,
    kind,
    scale,
    yaw: hash01(seed + salt + Salt.Yaw, i, j) * Math.PI * 2,
    tint: Math.floor(hash01(seed + salt + Salt.Tint, i, j) * look.tints.length),
    rank: (1 - thinning) * (1 - core) + thinning * hash01(seed + salt + Salt.Rank, i, j),
  };
}

/** Trees in lines along both sides of the lanes drawn at this level (the biome's `hedgerow`). */
function hedgerows(pl: Planting, out: ForestTree[]) {
  const chance = pl.biome.hedgerow ?? 0;
  if (!chance) return;
  const { island } = pl.input;
  const { hedgerow, clear } = FORESTS;
  const spacing = (hedgerow.spacing * pl.unit) / island.radius;
  const offset = (clear.lane + hedgerow.offset * pl.unit) / island.radius;
  pl.input.clearings.lanes.forEach(([ax, az, bx, bz, half], k) => {
    const length = Math.hypot(bx - ax, bz - az);
    if (!length) return;
    const nx = -(bz - az) / length,
      nz = (bx - ax) / length;
    for (const side of [-1, 1]) {
      const along = Math.min(1, length / spacing);
      if (hash01(pl.seed + Salt.Hedge, k, side) >= chance * along) continue;
      const d = side * (half + offset);
      const fx = (ax + bx) / 2 + nx * d,
        fz = (az + bz) / 2 + nz * d;
      const tree = treeAt(pl, fx, fz, k, side, Salt.Hedge, 1, 0, true);
      if (tree) out.push(tree);
    }
  });
}

/**
 * The trees of an island at a level; with `box`, only those standing inside it (map units).
 * None where the file's woods are off (`tries` 0) or its biome grows none. Painted woods grow
 * thick and the rest of the free ground in clumps; a share of the trees are small ones, two to a
 * cell; hedgerows line the lanes.
 */
export function plantForest(input: ForestInput, box?: MapBox): ForestTree[] {
  const { island, design, field } = input;
  const woods = design.woods;
  const biome = forestBiome(design.style);
  const density = woods.density ?? 1;
  const cover = Math.min(1, (biome?.cover ?? 0) * density);
  if (!biome || cover <= 0 || !woods.tries) return [];
  const { spacing, jitter, clump, small } = FORESTS;
  // Outside painted woods only the biome's `outside` share grows, in clumps; groves only add.
  const loose = woods.areas?.length ? cover * clump.outside : cover;
  const areas = [...(woods.areas ?? []), ...(woods.groves ?? [])];
  const edge = fbmQuantile(clump.octaves, 1 - Math.min(1, loose / clump.fill));
  const unit = woods.size * ISLAND_SCALE;
  const step = (spacing * unit) / island.radius;
  const noiseScale = clump.scale * island.radius;
  const pl: Planting = {
    input,
    biome,
    circles: clearCircles(input),
    top: topOf(field) || 1,
    seed: design.seed,
    unit,
    box,
    homes: input.clearings.homes.map(([x, z]) => {
      const p = islandPoint(island, x, z);
      return [x, z, heightAt(field, p.x, p.y)];
    }),
  };
  const seed = design.seed;
  const [x0, z0, x1, z1] = woods.area;
  const out: ForestTree[] = [];
  for (let j = Math.ceil(z0 / step); j * step <= z1; j++)
    for (let i = Math.ceil(x0 / step); i * step <= x1; i++) {
      const fx = (i + (hash01(seed + Salt.JitterX, i, j) - 0.5) * jitter) * step,
        fz = (j + (hash01(seed + Salt.JitterZ, i, j) - 0.5) * jitter) * step;
      const depth = paintedDepth(areas, fx, fz);
      // In the file's frame, so an island's clumps stay put wherever its sea places it.
      const n = fbm(fx * noiseScale, fz * noiseScale, seed, clump.octaves);
      const wood =
        depth >= 0
          ? { chance: Math.min(1, clump.fill * density), core: Math.min(1, depth * 2) }
          : clumpAt(n, edge);
      if (!wood.chance) continue;
      const isSmall = hash01(seed + Salt.Small, i, j) < small.share;
      const tree = treeAt(pl, fx, fz, i, j, 0, wood.chance, wood.core, isSmall);
      if (tree) out.push(tree);
      if (!isSmall) continue;
      // A small tree shares its cell with a second one, half a cell off.
      const cx = fx + step / 2,
        cz = fz + (hash01(seed + Salt.Companion, i, j) - 0.5) * step;
      const companion = treeAt(pl, cx, cz, i, j, Salt.Companion, wood.chance, wood.core, true);
      if (companion) out.push(companion);
    }
  hedgerows(pl, out);
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
