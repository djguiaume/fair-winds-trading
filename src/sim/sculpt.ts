import { TUNING } from '../data/tuning';
import { PROP_RECIPES } from '../data/props';
import type { IslandDesign, PropDef, SculptDef, SculptEdit } from '../data/islands';
import type { Heightfield } from './heightfield';
import type { IslandDef } from './map';
import { islandPoint } from './islandLayout';
import { ISLAND_SCALE } from './islandUnits';

/**
 * Hand sculpting of the islands' ground (decision 0230, issue #270): an island file's edits are
 * replayed in order over its generated height field, on the canonical grid, so every quality
 * level, the sim, the editors and the CLIs see the same ground.
 *
 * Every dab of a brush changes the samples inside its radius by `strength × weight`, where the
 * weight is 1 inside the brush's core and fades smoothly to 0 at its rim over `falloff × radius`:
 * - `raise`, `lower`: add or take `strength` (radius units) at the centre.
 * - `flatten`: pull the ground toward `height`.
 * - `smooth`: pull each sample toward the average of the samples within `smoothRadius` round it,
 *   read before the dab, so the result never depends on the order samples are visited.
 * - `slope`: one stroke between two ends [x, z, height]: within `radius` of the segment, pull the
 *   ground toward the height the segment has there, rising evenly from one end to the other.
 * Heights stay within `sculpt.minHeight` to `maxHeight`, and the ground round buildings and home
 * spots is protected unless an edit says `override`. The arithmetic is only +, −, ×, ÷ and square
 * roots on fixed inputs, so the same file always replays to the same heights.
 */

/** The replay rules this game knows; bump it (and migrate old files) when an operation changes. */
export const SCULPT_VERSION = 1;

const OPS = new Set(['raise', 'lower', 'flatten', 'smooth', 'slope']);

/** The samples an edit changed: columns i0 to i1 and rows j0 to j1, inclusive. */
export interface Region {
  i0: number;
  j0: number;
  i1: number;
  j1: number;
}

/** The smallest region holding both; null is the empty region. */
export function joinRegions(a: Region | null, b: Region | null): Region | null {
  if (!a || !b) return a ?? b;
  return {
    i0: Math.min(a.i0, b.i0),
    j0: Math.min(a.j0, b.j0),
    i1: Math.max(a.i1, b.i1),
    j1: Math.max(a.j1, b.j1),
  };
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** What is wrong with a brush's settings (an edit without its points), if anything. */
export function brushProblems(brush: Omit<SculptEdit, 'points'>): string[] {
  if (!OPS.has(brush.op)) return [`unknown operation "${String(brush.op)}"`];
  const problems: string[] = [];
  if (!finite(brush.radius) || brush.radius <= 0) problems.push('radius must be above 0');
  if (!finite(brush.falloff) || brush.falloff < 0 || brush.falloff > 1)
    problems.push('falloff must be 0 to 1');
  const lift = brush.op === 'raise' || brush.op === 'lower';
  if (!finite(brush.strength) || brush.strength < 0 || (!lift && brush.strength > 1))
    problems.push(lift ? 'strength must be 0 or more' : 'strength must be 0 to 1');
  if (brush.op === 'flatten' && !finite(brush.height)) problems.push('flatten needs a height');
  if (brush.override !== undefined && typeof brush.override !== 'boolean')
    problems.push('override must be true or false');
  return problems;
}

/** What is wrong with an edit, if anything: a file with such an edit cannot replay. */
export function editProblems(edit: SculptEdit): string[] {
  const problems = brushProblems(edit);
  if (!OPS.has(edit.op)) return problems;
  const size = edit.op === 'slope' ? 3 : 2;
  const points = Array.isArray(edit.points) ? edit.points : [];
  if (edit.op === 'slope' ? points.length !== 2 : !points.length)
    problems.push(edit.op === 'slope' ? 'a slope needs two ends' : 'no points');
  if (!points.every((p) => Array.isArray(p) && p.length === size && p.every(finite)))
    problems.push(`points must be [x, z${size === 3 ? ', height' : ''}] numbers`);
  return problems;
}

/** Every problem of an island's `sculpt`, as "edit N: …". */
export function sculptProblems(sculpt: SculptDef): string[] {
  if (sculpt.version !== SCULPT_VERSION)
    return [`sculpt version ${sculpt.version} is not this game's (${SCULPT_VERSION})`];
  if (!Array.isArray(sculpt.edits)) return ['sculpt has no edits list'];
  return sculpt.edits.flatMap((e, i) => editProblems(e).map((p) => `edit ${i + 1}: ${p}`));
}

/** An island's edits, once its file is known to replay with this game's rules. */
export function sculptEdits(design: IslandDesign): readonly SculptEdit[] {
  if (!design.sculpt) return [];
  const problems = sculptProblems(design.sculpt);
  if (problems.length) throw new Error(`Island "${design.id}": ${problems[0]}`);
  return design.sculpt.edits;
}

/**
 * How far an edit reaches from a point (radius units, the file's frame): the distance from the
 * point to the nearest dab, or to a slope's segment, less the edit's radius. Below 0, it is inside.
 */
export function editReach(edit: SculptEdit, x: number, z: number): number {
  const pts = edit.points;
  if (edit.op === 'slope') {
    const [a, b] = pts as [number[], number[]];
    return segmentDistance(x, z, a[0]!, a[1]!, b[0]!, b[1]!) - edit.radius;
  }
  let near = Infinity;
  for (const p of pts) near = Math.min(near, Math.hypot(x - p[0]!, z - p[1]!));
  return near - edit.radius;
}

function segmentDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const t = segmentT(x, y, ax, ay, bx - ax, by - ay);
  const px = ax + (bx - ax) * t,
    py = ay + (by - ay) * t;
  return Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
}

/** Where a point falls along a segment, 0 at its start to 1 at its end. */
function segmentT(x: number, y: number, ax: number, ay: number, dx: number, dy: number) {
  const len2 = dx * dx + dy * dy;
  if (!(len2 > 0)) return 0;
  return Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / len2));
}

/** A brush's weight at a distance: 1 in its core, then a smoothstep down to 0 at its rim. */
export function brushWeight(distance: number, radius: number, falloff: number): number {
  if (distance >= radius) return 0;
  const core = radius * (1 - falloff);
  if (distance <= core) return 1;
  const t = (radius - distance) / (radius - core);
  return t * t * (3 - 2 * t);
}

/** An edit's brush on the map: world units, ready to paint a field. */
interface Brush {
  op: SculptEdit['op'];
  radius: number;
  /** World units for raise (+) and lower (−); a share of the way for the others. */
  strength: number;
  falloff: number;
  height: number;
  /** Where the brush may paint: `keep`'s weights, or null for everywhere. */
  keep: Float32Array | null;
}

interface MapPoint {
  x: number;
  y: number;
  /** World units; a slope end's height. */
  h: number;
}

function brushOf(edit: SculptEdit, island: IslandDef, keep: Float32Array | null): Brush {
  const R = island.radius;
  const sign = edit.op === 'lower' ? -1 : 1;
  const lift = edit.op === 'raise' || edit.op === 'lower' ? R : 1;
  return {
    op: edit.op,
    radius: edit.radius * R,
    strength: edit.strength * lift * sign,
    falloff: edit.falloff,
    height: (edit.height ?? 0) * R,
    keep: edit.override ? null : keep,
  };
}

function mapPoint(island: IslandDef, p: readonly number[]): MapPoint {
  const at = islandPoint(island, p[0]!, p[1]!);
  return { x: at.x, y: at.y, h: (p[2] ?? 0) * island.radius };
}

/** The samples inside a map box, clipped to the field; null when none are. */
function boxRegion(f: Heightfield, minX: number, minY: number, maxX: number, maxY: number) {
  const i0 = Math.max(0, Math.ceil((minX - f.x0) / f.cell)),
    j0 = Math.max(0, Math.ceil((minY - f.y0) / f.cell));
  const i1 = Math.min(f.w - 1, Math.floor((maxX - f.x0) / f.cell)),
    j1 = Math.min(f.h - 1, Math.floor((maxY - f.y0) / f.cell));
  return i0 > i1 || j0 > j1 ? null : { i0, j0, i1, j1 };
}

/** Writes a sculpted height, kept in bounds; a changed sample is no longer level terrace. */
function setHeight(field: Heightfield, k: number, height: number) {
  const { minHeight, maxHeight } = TUNING.terrain.sculpt;
  const next = Math.fround(Math.min(maxHeight, Math.max(minHeight, height)));
  if (next === field.heights[k]) return;
  field.heights[k] = next;
  field.terrace[k] = 0;
}

let averages = new Float32Array(0);

/** Each sample's neighbourhood average over a region, read before any of it changes. */
function regionAverages(field: Heightfield, r: Region): Float32Array {
  const n = Math.max(1, Math.round(TUNING.terrain.sculpt.smoothRadius / field.cell));
  const rw = r.i1 - r.i0 + 1;
  if (averages.length < rw * (r.j1 - r.j0 + 1)) averages = new Float32Array(rw * (r.j1 - r.j0 + 1));
  for (let j = r.j0; j <= r.j1; j++)
    for (let i = r.i0; i <= r.i1; i++) {
      let sum = 0,
        count = 0;
      for (let b = Math.max(0, j - n); b <= Math.min(field.h - 1, j + n); b++)
        for (let a = Math.max(0, i - n); a <= Math.min(field.w - 1, i + n); a++) {
          sum += field.heights[b * field.w + a]!;
          count++;
        }
      averages[(j - r.j0) * rw + (i - r.i0)] = sum / count;
    }
  return averages;
}

/** One dab of a round brush at a map point. */
function paintDab(field: Heightfield, brush: Brush, at: MapPoint): Region | null {
  const r = brush.radius;
  const region = boxRegion(field, at.x - r, at.y - r, at.x + r, at.y + r);
  if (!region) return null;
  const avg = brush.op === 'smooth' ? regionAverages(field, region) : null;
  const rw = region.i1 - region.i0 + 1;
  const lift = brush.op === 'raise' || brush.op === 'lower';
  for (let j = region.j0; j <= region.j1; j++)
    for (let i = region.i0; i <= region.i1; i++) {
      const dx = field.x0 + i * field.cell - at.x,
        dy = field.y0 + j * field.cell - at.y;
      const k = j * field.w + i;
      const w =
        brushWeight(Math.sqrt(dx * dx + dy * dy), r, brush.falloff) * (brush.keep?.[k] ?? 1);
      if (!(w > 0)) continue;
      const h = field.heights[k]!;
      const target = avg ? avg[(j - region.j0) * rw + (i - region.i0)]! : brush.height;
      setHeight(field, k, lift ? h + brush.strength * w : h + (target - h) * brush.strength * w);
    }
  return region;
}

/** A slope between two ends: the ground pulled toward the even ramp along the segment. */
function paintSlope(field: Heightfield, brush: Brush, a: MapPoint, b: MapPoint): Region | null {
  const r = brush.radius;
  const region = boxRegion(
    field,
    Math.min(a.x, b.x) - r,
    Math.min(a.y, b.y) - r,
    Math.max(a.x, b.x) + r,
    Math.max(a.y, b.y) + r,
  );
  if (!region) return null;
  const dx = b.x - a.x,
    dy = b.y - a.y;
  for (let j = region.j0; j <= region.j1; j++)
    for (let i = region.i0; i <= region.i1; i++) {
      const x = field.x0 + i * field.cell,
        y = field.y0 + j * field.cell;
      const t = segmentT(x, y, a.x, a.y, dx, dy);
      const ox = x - (a.x + dx * t),
        oy = y - (a.y + dy * t);
      const k = j * field.w + i;
      const w =
        brushWeight(Math.sqrt(ox * ox + oy * oy), r, brush.falloff) * (brush.keep?.[k] ?? 1);
      if (!(w > 0)) continue;
      const h = field.heights[k]!;
      setHeight(field, k, h + (a.h + (b.h - a.h) * t - h) * brush.strength * w);
    }
  return region;
}

/** The `index`th dab of a brush edit (not a slope), as a drag paints it. */
export function applyDab(
  field: Heightfield,
  island: IslandDef,
  keep: Float32Array | null,
  edit: SculptEdit,
  index: number,
): Region | null {
  return paintDab(field, brushOf(edit, island, keep), mapPoint(island, edit.points[index]!));
}

/** Applies a whole edit to a field in place; returns the samples it may have changed. */
export function applyEdit(
  field: Heightfield,
  island: IslandDef,
  keep: Float32Array | null,
  edit: SculptEdit,
): Region | null {
  const brush = brushOf(edit, island, keep);
  if (edit.op === 'slope') {
    const [a, b] = edit.points as [number[], number[]];
    return paintSlope(field, brush, mapPoint(island, a), mapPoint(island, b));
  }
  let region: Region | null = null;
  for (const p of edit.points)
    region = joinRegions(region, paintDab(field, brush, mapPoint(island, p)));
  return region;
}

/**
 * Where sculpting may change the ground: 0 on the protected terraces round buildings and home
 * spots (their footprint plus `protect.margin`), fading back to 1 over `protect.fade`. Built from
 * every building at every level, so the edited ground is the same at every settlement level.
 * Null when the island has nothing to protect.
 */
export function keepMask(
  field: Heightfield,
  island: IslandDef,
  design: IslandDesign,
): Float32Array | null {
  const spots = protectedSpots(island, design);
  if (!spots.length) return null;
  const { margin, fade } = TUNING.terrain.sculpt.protect;
  const keep = new Float32Array(field.w * field.h).fill(1);
  for (const s of spots) {
    const inner = s.r + margin,
      outer = inner + fade;
    const region = boxRegion(field, s.x - outer, s.y - outer, s.x + outer, s.y + outer);
    if (!region) continue;
    for (let j = region.j0; j <= region.j1; j++)
      for (let i = region.i0; i <= region.i1; i++) {
        const dx = field.x0 + i * field.cell - s.x,
          dy = field.y0 + j * field.cell - s.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const free = fade > 0 ? Math.min(1, Math.max(0, (d - inner) / fade)) : d < inner ? 0 : 1;
        const k = j * field.w + i;
        keep[k] = Math.min(keep[k]!, free);
      }
  }
  return keep;
}

/** Buildings and home spots on the map, with their footprint radius (world units). */
function protectedSpots(island: IslandDef, design: IslandDesign) {
  const spots: { x: number; y: number; r: number }[] = [];
  for (const p of design.props) {
    const r = buildingFit(p, island.radius);
    if (r !== null) spots.push({ ...islandPoint(island, p.x, p.z), r });
  }
  const { fit } = TUNING.terrain.sculpt.protect;
  for (const s of design.homeSpots ?? []) spots.push({ ...islandPoint(island, s.x, s.z), r: fit });
  return spots;
}

/**
 * A building's footprint radius in world units, from the data alone (the renderer measures the
 * model; this must not need it): the file's `fit`, the recipe's `protect` or `fit`, else
 * `terrain.json` › `sculpt.protect.fit`. Null for a prop that is not a building or a home.
 */
export function buildingFit(p: PropDef, radius: number): number | null {
  const recipe = PROP_RECIPES[p.type];
  if (!recipe?.building && !recipe?.home) return null;
  // Island files and fitRadius are radius units; a recipe's fit is reference units (the models').
  if (p.fit !== undefined) return p.fit * radius;
  if (recipe.fitRadius !== undefined) return recipe.fitRadius * radius;
  const scale = recipe.sizedInModel ? 1 : (p.size ?? 1);
  const reference = recipe.protect ?? recipe.fit;
  return reference !== undefined
    ? reference * scale * ISLAND_SCALE
    : TUNING.terrain.sculpt.protect.fit * scale;
}

/** Replays an island file's edits over its generated field, in file order, in place. */
export function sculptField(field: Heightfield, island: IslandDef, design: IslandDesign) {
  const edits = sculptEdits(design);
  if (!edits.length) return field;
  const keep = keepMask(field, island, design);
  for (const edit of edits) applyEdit(field, island, keep, edit);
  return field;
}
