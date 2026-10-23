import { coastDistance } from './coast';
import { HULL_BEAM_SCALE, HULL_DIMENSIONS, HULL_SCALE, HULL_SHAPES } from './hullShape';

type Point = [number, number];
const outlines = new Map<string, { outline: Point[]; radius: number }>();

function localHull(shipId: string) {
  let cached = outlines.get(shipId);
  if (!cached) {
    const shape = HULL_SHAPES[shipId] ?? HULL_SHAPES.sloop!;
    const size = HULL_DIMENSIONS[shipId] ?? HULL_DIMENSIONS.sloop!;
    const points: Point[] = shape.rings.flatMap((ring) =>
      shape.outline.map(([x, z]): Point => [
        x * size.beam * HULL_BEAM_SCALE * HULL_SCALE * ring.beam,
        z * size.length * HULL_SCALE * ring.length,
      ]),
    );
    points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (a: Point, b: Point, c: Point) =>
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const half = (ps: Point[]) => {
      const result: Point[] = [];
      for (const p of ps) {
        while (result.length >= 2 && cross(result.at(-2)!, result.at(-1)!, p) <= 0) result.pop();
        result.push(p);
      }
      result.pop();
      return result;
    };
    const outline = [...half(points), ...half([...points].reverse())];
    cached = { outline, radius: Math.max(...outline.map(([x, z]) => Math.hypot(x, z))) };
    outlines.set(shipId, cached);
  }
  return cached;
}

/** Heading-independent radius of the cached authored hull, including every ring. */
export function hullRadius(shipId: string): number {
  return localHull(shipId).radius;
}

/** Upright hull footprint, including the widest authored sections; rigging is excluded. */
export function hullFootprint(
  boat: { x: number; y: number; heading?: number },
  shipId: string,
): Point[] {
  const { outline } = localHull(shipId);
  const s = Math.sin(boat.heading ?? 0),
    c = Math.cos(boat.heading ?? 0);
  // The renderer turns the authored +Z bow through PI, then applies -heading.
  return outline.map(([x, z]) => [boat.x - x * c + z * s, boat.y + x * s + z * c]);
}

function pointSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Exact minimum between two closed line segments, including crossing edges. */
function segmentGap(a: Point, b: Point, c: Point, d: Point): number {
  const rx = b[0] - a[0],
    ry = b[1] - a[1];
  const sx = d[0] - c[0],
    sy = d[1] - c[1];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) > 1e-10) {
    const qx = c[0] - a[0],
      qy = c[1] - a[1];
    const t = (qx * sy - qy * sx) / den,
      u = (qx * ry - qy * rx) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
  }
  return Math.min(
    pointSegment(a, c, d),
    pointSegment(b, c, d),
    pointSegment(c, a, b),
    pointSegment(d, a, b),
  );
}

export function hullSegmentGap(hull: Point[], a: Point, b: Point): number {
  if (
    coastDistance(a[0], a[1], hull).distance <= 0 ||
    coastDistance(b[0], b[1], hull).distance <= 0
  )
    return 0;
  return Math.min(...hull.map((p, i) => segmentGap(p, hull[(i + 1) % hull.length]!, a, b)));
}

export function hullCoastGap(hull: Point[], coast: Point[]): number {
  if (hull.some(([x, y]) => coastDistance(x, y, coast).distance <= 0)) return 0;
  return Math.min(...coast.map((p, i) => hullSegmentGap(hull, p, coast[(i + 1) % coast.length]!)));
}
