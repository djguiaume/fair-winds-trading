import type { GroundDef, IslandDesign, LaneDef, Point, RampDef } from '../../data/islands';
import { insetOutline } from '../../sim/coast';
import { BEACH } from '../../sim/islandLayout';
import type { Level } from './doc';

/**
 * The island builder's ground, lanes and woods edits (decision 0105, part 2): coasts, raised
 * ground with cliff or sloped edges (0096 §4), mountains, the lake, lanes, paths and stairs, and
 * the painted woods. Pure data, no DOM, tested in tests/island-builder.test.ts.
 */

export type Shape =
  | { kind: 'coast'; index: number }
  | { kind: 'ground'; index: number }
  | { kind: 'lake' }
  | { kind: 'lane'; index: number }
  | { kind: 'ramp'; index: number };

/** The width a new slope gets, in island-radius units. */
export const SLOPE_WIDTH = 0.15;
/** The width of a new ramp (decision 0123), in island-radius units. */
export const RAMP_WIDTH = 0.1;

const pos = (v: number) => Number(v.toFixed(6));
const closed = (shape: Shape) => shape.kind !== 'lane' && shape.kind !== 'ramp';

/** The points of a shape (a lane's may carry a height), or undefined for ground on a coast. */
export function pointsOf(design: IslandDesign, shape: Shape): number[][] | undefined {
  switch (shape.kind) {
    case 'coast':
      return design.coasts[shape.index];
    case 'ground':
      return design.ground[shape.index]?.outline;
    case 'lake':
      return design.lake;
    case 'lane':
      return design.lanes[shape.index]?.points;
    case 'ramp':
      return design.ramps?.[shape.index]?.points;
  }
}

/** The outline drawn for a ground entry: its own, or its coast's inset by the beach. */
export function groundOutline(design: IslandDesign, g: GroundDef): Point[] {
  return g.outline ?? insetOutline(design.coasts[g.coast ?? 0]!, BEACH);
}

export function shapeName(design: IslandDesign, shape: Shape): string {
  if (shape.kind === 'coast') return shape.index ? `Islet ${shape.index}` : 'Coast';
  if (shape.kind === 'lake') return 'Lake';
  if (shape.kind === 'ramp') return 'Ramp';
  if (shape.kind === 'lane') {
    const kind = design.lanes[shape.index]?.kind ?? 'lane';
    return { lane: 'Lane', path: 'Path', stairs: 'Stairs' }[kind];
  }
  const g = design.ground[shape.index];
  return g?.shape === 'peak' ? 'Mountain' : g?.coast !== undefined ? 'Low ground' : 'Raised ground';
}

// --- Points ----------------------------------------------------------------------------------

/** Moves a point; a stairs point takes the given height (the ground there). */
export function movePoint(
  design: IslandDesign,
  shape: Shape,
  index: number,
  x: number,
  z: number,
  height?: number,
) {
  const pts = pointsOf(design, shape);
  const p = pts?.[index];
  if (!p) return;
  p[0] = pos(x);
  p[1] = pos(z);
  if (p.length === 3 && height !== undefined) p[2] = pos(height);
}

/** Per-edge slope flags of a ground outline (true: sloped). */
function slopeFlags(g: GroundDef): boolean[] {
  const n = g.outline?.length ?? 0;
  return Array.from(
    { length: n },
    (_, i) => !!g.slope && (!g.slopeEdges || g.slopeEdges.some(([a, b]) => i >= a && i <= b)),
  );
}
/** Writes per-edge flags back as `slope` and runs of `slopeEdges` (left out when all slope). */
function setSlopeFlags(g: GroundDef, flags: boolean[], width = g.slope ?? SLOPE_WIDTH) {
  if (!flags.some(Boolean)) {
    delete g.slope;
    delete g.slopeEdges;
    return;
  }
  g.slope = width;
  if (flags.every(Boolean)) {
    delete g.slopeEdges;
    return;
  }
  const runs: [number, number][] = [];
  flags.forEach((on, i) => {
    if (!on) return;
    const last = runs[runs.length - 1];
    if (last && last[1] === i - 1) last[1] = i;
    else runs.push([i, i]);
  });
  g.slopeEdges = runs;
}

/** Adds a point halfway along the edge after `index`; returns the new point's index. */
export function insertPoint(design: IslandDesign, shape: Shape, index: number): number {
  const pts = pointsOf(design, shape);
  if (!pts) return -1;
  const n = pts.length;
  if (!closed(shape) && index >= n - 1) return -1;
  const a = pts[index % n]!,
    b = pts[(index + 1) % n]!;
  const p = a.map((v, k) => pos((v + b[k]!) / 2));
  const g = shape.kind === 'ground' ? design.ground[shape.index] : undefined;
  const flags = g ? slopeFlags(g) : undefined;
  pts.splice(index + 1, 0, p);
  if (g && flags && g.slope) {
    flags.splice(index + 1, 0, flags[index]!);
    setSlopeFlags(g, flags);
  }
  return index + 1;
}

/** Removes a point; outlines keep three, lanes two. */
export function deletePoint(design: IslandDesign, shape: Shape, index: number): boolean {
  const pts = pointsOf(design, shape);
  if (!pts || pts.length <= (closed(shape) ? 3 : 2)) return false;
  const g = shape.kind === 'ground' ? design.ground[shape.index] : undefined;
  const flags = g ? slopeFlags(g) : undefined;
  pts.splice(index, 1);
  if (g && flags && g.slope) {
    const n = flags.length;
    // The edge before the point now runs to the next one: sloped if either was.
    flags[(index - 1 + n) % n] = flags[(index - 1 + n) % n]! || flags[index]!;
    flags.splice(index, 1);
    setSlopeFlags(g, flags);
  }
  return true;
}

/** Deletes a whole shape; the main coast stays. Returns false when it cannot go. */
export function deleteShape(design: IslandDesign, shape: Shape): boolean {
  if (shape.kind === 'coast') {
    if (shape.index === 0) return false;
    design.coasts.splice(shape.index, 1);
    // Ground on a later islet moves down with it; ground on this one goes.
    design.ground = design.ground
      .filter((g) => g.coast !== shape.index)
      .map((g) =>
        g.coast !== undefined && g.coast > shape.index ? { ...g, coast: g.coast - 1 } : g,
      );
  } else if (shape.kind === 'ground') design.ground.splice(shape.index, 1);
  else if (shape.kind === 'lake') delete design.lake;
  else if (shape.kind === 'ramp') {
    design.ramps?.splice(shape.index, 1);
    if (!design.ramps?.length) delete design.ramps;
  } else design.lanes.splice(shape.index, 1);
  return true;
}

// --- Ground ----------------------------------------------------------------------------------

/** A ring of `n` points round (x, z). */
function ring(x: number, z: number, rx: number, rz: number, n: number): Point[] {
  return Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2;
    return [pos(x + Math.cos(a) * rx), pos(z + Math.sin(a) * rz)];
  });
}

/** Raised ground: a hexagon, `rise` above the ground under it, from the level it is drawn on. */
export function addPlateau(
  design: IslandDesign,
  x: number,
  z: number,
  under: number,
  level: Level,
): number {
  const g: GroundDef = {
    outline: ring(x, z, 0.22, 0.16, 6),
    height: pos(under + 0.2),
    material: 'grass',
  };
  if (level > 1) g.from = level;
  design.ground.push(g);
  return design.ground.length - 1;
}

/** A rock peak (a cone over its outline) standing on the ground under it. */
export function addMountain(
  design: IslandDesign,
  x: number,
  z: number,
  under: number,
  level: Level,
): number {
  const g: GroundDef = {
    outline: ring(x, z, 0.26, 0.2, 10),
    height: pos(under + 0.6),
    material: 'rock',
    shape: 'peak',
    base: pos(under),
  };
  if (level > 1) g.from = level;
  design.ground.push(g);
  return design.ground.length - 1;
}

/** The lake, if the island has none yet. */
export function addLake(design: IslandDesign, x: number, z: number): boolean {
  if (design.lake) return false;
  design.lake = ring(x, z, 0.2, 0.14, 10);
  return true;
}

/** Every edge a cliff, or every edge a slope of the given width. */
export function setEdges(design: IslandDesign, index: number, slope: number | null) {
  const g = design.ground[index];
  if (!g) return;
  delete g.slopeEdges;
  if (slope === null) delete g.slope;
  else g.slope = pos(slope);
}

/** Turns one edge between cliff and slope. */
export function toggleSlopeEdge(design: IslandDesign, index: number, edge: number) {
  const g = design.ground[index];
  if (!g?.outline) return;
  const flags = slopeFlags(g);
  flags[edge] = !flags[edge];
  setSlopeFlags(g, flags);
}

// --- Ramps ----------------------------------------------------------------------------------

/**
 * A ramp along the points (decision 0123), rising evenly from `start` to `end`, from the level it
 * is drawn on. Drawn on flat ground it climbs 0.2.
 */
export function addRamp(
  design: IslandDesign,
  points: number[][],
  start: number,
  end: number,
  level: Level,
): number {
  const ramp: RampDef = {
    points: points.map((p) => [pos(p[0]!), pos(p[1]!)]),
    width: RAMP_WIDTH,
    start: pos(start),
    end: pos(Math.abs(end - start) < 0.01 ? start + 0.2 : end),
    material: 'grass',
  };
  if (level > 1) ramp.from = level;
  design.ramps ??= [];
  design.ramps.push(ramp);
  return design.ramps.length - 1;
}

// --- Lanes -----------------------------------------------------------------------------------

/**
 * A new lane, path or stairs through the points. Stairs carry the ground's height at each point
 * and stand on the lowest; paths follow the ground (no `y`).
 */
export function addLane(
  design: IslandDesign,
  kind: NonNullable<LaneDef['kind']>,
  points: number[][],
): number {
  const lane: LaneDef = {
    points: points.map((p) =>
      (kind === 'stairs' ? [p[0]!, p[1]!, p[2] ?? 0] : [p[0]!, p[1]!]).map(pos),
    ),
  };
  if (kind !== 'lane') lane.kind = kind;
  if (kind === 'stairs') lane.base = Math.min(...lane.points.map((p) => p[2]!));
  design.lanes.push(lane);
  return design.lanes.length - 1;
}

// --- Woods -----------------------------------------------------------------------------------

const circle = (x: number, z: number, r: number): [number, number, number] => [
  pos(x),
  pos(z),
  pos(r),
];

/**
 * Paints the woods: `grow` adds where trees may grow (and lifts clearings there), `clear` keeps
 * trees off (and rubs out painted woods there). Dabs closer than half a brush are skipped.
 */
export function paintWoods(
  design: IslandDesign,
  x: number,
  z: number,
  r: number,
  mode: 'grow' | 'clear',
) {
  const w = design.woods;
  const near = (c: [number, number, number]) => Math.hypot(c[0] - x, c[1] - z) < r * 0.5;
  if (mode === 'grow') {
    if (w.clear) {
      w.clear = w.clear.filter((c) => Math.hypot(c[0] - x, c[1] - z) > r);
      if (!w.clear.length) delete w.clear;
    }
    w.areas ??= [];
    if (!w.areas.some(near)) w.areas.push(circle(x, z, r));
  } else {
    if (w.areas) {
      w.areas = w.areas.filter((c) => Math.hypot(c[0] - x, c[1] - z) > r);
      if (!w.areas.length) delete w.areas;
    }
    w.clear ??= [];
    if (!w.clear.some(near)) w.clear.push(circle(x, z, r));
  }
}

/** Removes the painted woods (back to trees anywhere in the woods' area). */
export function clearWoodsPainting(design: IslandDesign) {
  delete design.woods.areas;
}

/** Turns a lane into a lane, path or stairs; stairs take the ground's height at each point. */
export function setLaneKind(
  design: IslandDesign,
  index: number,
  kind: NonNullable<LaneDef['kind']>,
  heightAt: (x: number, z: number) => number,
) {
  const lane = design.lanes[index];
  if (!lane) return;
  const points = lane.points.map((p) =>
    kind === 'stairs' ? [p[0]!, p[1]!, pos(p[2] ?? heightAt(p[0]!, p[1]!))] : [p[0]!, p[1]!],
  );
  const next: LaneDef = { points };
  if (kind !== 'lane') next.kind = kind;
  if (kind === 'stairs') next.base = Math.min(...points.map((p) => p[2]!));
  if (kind === 'path' && lane.kind === 'path' && lane.y !== undefined) next.y = lane.y;
  design.lanes[index] = next;
}
