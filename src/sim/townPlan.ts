import { atLevel, type IslandDesign, type PropDef } from '../data/islands';
import { coastDistance } from './coast';
import { designHeightfield, heightAt, sampleIndex, type Heightfield } from './heightfield';
import type { IslandCheckKit, IslandIssue } from './islandChecks';
import { characterPiers, islandPoint, type Outline } from './islandLayout';
import { sculptFrame } from './sculptScript';
import { MAX_SETTLEMENT_LEVEL } from './settlement';
import { type StyleRules, type TownRules, styleRules } from './townRules';
import type { IslandDef } from './map';

/**
 * A designed town as the town checks (issue #513) measure it: its houses with their footprints,
 * the house width W every rule is counted in, the harbour, the lanes and quays, and the ground's
 * slope and the waterline under any point. Everything is in island-radius units, at the top
 * town level with every quest done (the town a player keeps).
 */
export type Point = [number, number];

export interface House {
  /** Index in `design.props`. */
  index: number;
  prop: PropDef;
  at: Point;
  hull: Outline;
  fit: number;
  /** Unit vector the front (door side) faces: the model's +z turned by `turn`. */
  front: Point;
  /** Width across the front. */
  width: number;
}

export interface TownPlan {
  design: IslandDesign;
  kit: IslandCheckKit;
  rules: TownRules;
  style: StyleRules;
  /** The house width every distance rule counts in. */
  W: number;
  houses: House[];
  /** Where the arrival pier meets the shore; null for an island with no harbour. */
  harbour: Point | null;
  lanes: Point[][];
  /** Pier shafts as [root, tip], the arrival pier first. */
  piers: [Point, Point][];
  /** Quay props a door may face. */
  quays: Point[];
  island: IslandDef;
  field: Heightfield;
  report: (
    check: string,
    grade: 'warn' | 'fail',
    message: string,
    extra?: Partial<IslandIssue>,
  ) => void;
}

const LEVEL = MAX_SETTLEMENT_LEVEL;

/** Props standing in the lasting town: at the top level, not ones a quest takes away. */
export const lasting = (p: PropDef) =>
  atLevel(p, LEVEL) && !p.tags?.some((t) => t.startsWith('before:'));

const isHome = (kit: IslandCheckKit, p: PropDef) =>
  !!kit.types[p.type]?.home && !p.tags?.includes('outbuilding');

/** A town plan, or null for an island with no houses. */
export function townPlan(
  design: IslandDesign,
  kit: IslandCheckKit,
  rules: TownRules,
  issues: IslandIssue[],
): TownPlan | null {
  const houses = design.props
    .map((prop, index) => ({ prop, index }))
    .filter(({ prop }) => lasting(prop) && isHome(kit, prop))
    .map(({ prop, index }) => house(kit, prop, index));
  if (!houses.length) return null;
  const widths = houses.map((h) => h.width).sort((a, b) => a - b);
  const W = widths[Math.floor(widths.length / 2)]!;
  const island = sculptFrame(design.id, kit.R);
  const R = kit.R;
  const [arrival, ...side] = characterPiers(design, R, LEVEL).map((p): [Point, Point] => [
    [p.x / R, p.z0 / R],
    [p.x / R, (p.z0 + p.len) / R],
  ]);
  const harbour = kit.harbour !== false;
  return {
    design,
    kit,
    rules,
    style: styleRules(rules, design.style),
    W,
    houses,
    harbour: harbour ? arrival![0] : null,
    lanes: design.lanes.map((l) => l.points.map(([x, z]): Point => [x!, z!])),
    piers: harbour ? [arrival!, ...side] : side,
    quays: design.props
      .filter((p) => lasting(p) && rules.types.quays.includes(p.type))
      .map((p): Point => [p.x, p.z]),
    island,
    field: designHeightfield(island, design, LEVEL),
    report: (check, grade, message, extra = {}) =>
      issues.push({
        severity: grade === 'fail' && rules.grading.fails === 'error' ? 'error' : 'warning',
        check: `town-${check}`,
        grade,
        message,
        level: LEVEL,
        ...extra,
      }),
  };
}

function house(kit: IslandCheckKit, prop: PropDef, index: number): House {
  const fit = prop.fit ?? kit.fit(prop);
  const turn = ((prop.turn ?? 0) * Math.PI) / 180;
  // three.js turns +z to (sin, cos) and +x to (cos, -sin) about the vertical.
  const front: Point = [Math.sin(turn), Math.cos(turn)];
  const hull = kit.footprint?.(prop) ?? circle(prop.x, prop.z, fit);
  const across = hull.map(([x, z]) => (x - prop.x) * front[1] - (z - prop.z) * front[0]);
  return {
    index,
    prop,
    at: [prop.x, prop.z],
    hull,
    fit,
    front,
    width: Math.max(...across) - Math.min(...across),
  };
}

const circle = (x: number, z: number, r: number): Outline =>
  Array.from({ length: 8 }, (_, k): [number, number] => [
    x + r * Math.cos((k * Math.PI) / 4),
    z + r * Math.sin((k * Math.PI) / 4),
  ]);

/**
 * The ground's slope round a point, a plane fitted to a ring of radius `r`: its angle in degrees
 * and the way downhill (unit, file units; [0, 0] on flat ground).
 */
export function slopeAt(plan: TownPlan, x: number, z: number, r: number) {
  const { island, field } = plan;
  const height = (px: number, pz: number) => {
    const p = islandPoint(island, px, pz);
    return heightAt(field, p.x, p.y);
  };
  const h0 = height(x, z);
  let gx = 0,
    gz = 0;
  // Eight points evenly round the ring: the least-squares plane's gradient is a plain sum.
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const dh = height(x + r * Math.cos(a), z + r * Math.sin(a)) - h0;
    gx += (dh * Math.cos(a)) / (4 * r);
    gz += (dh * Math.sin(a)) / (4 * r);
  }
  // Heights are world units, the ring file units: one file unit is the island's world radius.
  const rise = Math.hypot(gx, gz);
  const deg = (Math.atan(rise / island.radius) * 180) / Math.PI;
  const down: Point = rise ? [-gx / rise, -gz / rise] : [0, 0];
  return { deg, down };
}

/** The ground material at a point (the island file's name, as `avoid` lists them). */
export function groundAt(plan: TownPlan, x: number, z: number): string {
  const p = islandPoint(plan.island, x, z);
  const k = sampleIndex(plan.field, p.x, p.y);
  return k < 0 ? '' : (plan.field.grounds[plan.field.ground[k]!] ?? '');
}

/** How far inland a point is (negative at sea), and the way to the nearest water. */
export function waterAt(plan: TownPlan, x: number, z: number) {
  let best = { depth: -Infinity, way: [0, 1] as Point };
  for (const coast of plan.design.coasts) {
    const d = coastDistance(x, z, coast);
    if (-d.distance > best.depth) best = { depth: -d.distance, way: [d.nx, d.ny] };
  }
  return best;
}

/** Nearest point of a segment. */
function onSegment(p: Point, a: Point, b: Point): Point {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const len = dx * dx + dz * dz;
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len)) : 0;
  return [a[0] + dx * t, a[1] + dz * t];
}

/** Nearest point of a polyline and its distance. */
export function nearestOn(p: Point, line: readonly Point[]) {
  let at = line[0]!;
  for (let i = 1; i < line.length; i++) {
    const q = onSegment(p, line[i - 1]!, line[i]!);
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) < Math.hypot(at[0] - p[0], at[1] - p[1])) at = q;
  }
  return { at, distance: Math.hypot(at[0] - p[0], at[1] - p[1]) };
}

/** Gap between two convex outlines, 0 when they touch or overlap. */
export function hullGap(a: Outline, b: Outline): number {
  let gap = Infinity;
  for (const [from, to] of [
    [a, b],
    [b, a],
  ] as const)
    for (const [x, z] of from) {
      if (coastDistance(x, z, to).distance <= 0) return 0;
      gap = Math.min(gap, nearestOn([x, z], [...to, to[0]!]).distance);
    }
  return gap;
}

/** Angle in degrees between two directions, 0 to 180. */
export function angleBetween(a: Point, b: Point): number {
  const dot = (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
}

/** Angle between two lines (either way along them), 0 to 90. */
export const lineAngle = (a: Point, b: Point) => {
  const t = angleBetween(a, b);
  return Math.min(t, 180 - t);
};

/** A prop's name in a message: its type and place. */
export const named = (p: PropDef) => `${p.type} (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`;
