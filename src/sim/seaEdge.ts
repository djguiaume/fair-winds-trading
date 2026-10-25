import { TUNING } from '../data/tuning';
import { coastDistance, insetOutline } from './coast';
import type { MapDef } from './map';

/**
 * The sea's edge (decision 0202): the playable water is the round sea, a disc of the map's
 * `boundsRadius` round (0, 0), joined with every outline in its `edges` (each sea file can bring
 * its own, for a section that sticks out one way). Every corner is rounded, where a section joins
 * the round sea too, so the edge reads as more ocean, never a box (the art director's rule). The
 * edge buoys, the wall the boat bumps into, the charts, the fog and the map checks all ask this
 * module, so a new section moves them all: buoys go along its outer edge and none are left where
 * it joins. Without `edges` the sea is exactly the disc it always was.
 */

type XY = [number, number];

/** One outline of open water joined to the round sea, from a sea file's `edges` (0202). */
export interface SeaEdgeDef {
  id: string;
  outline: XY[];
}

/** The playable water: the round sea and, with sections joined to it, its rounded outer rim. */
export interface SeaShape {
  radius: number;
  /** The rim of the joined, rounded sea, a closed loop about `RIM_STEP` apart; none for a disc. */
  rim?: readonly XY[];
}

/** Spacing of the rim's points, map units: fine enough for the wall, the chart and the buoys. */
const RIM_STEP = 4;

/** The sections' outlines a map's edges give: those with three points or more. */
const outlinesOf = (map: Pick<MapDef, 'edges'>) =>
  (map.edges ?? []).map((e) => e.outline).filter((o) => o.length >= 3);

const shapes = new WeakMap<object, { key: string; shape: SeaShape }>();

/**
 * The playable water of a map. Kept per map while its radius, outlines and rounding stay the same
 * (the game asks every frame, the map checks at every grid point; the editor moves points in place).
 */
export function seaShape(map: Pick<MapDef, 'boundsRadius' | 'edges'>): SeaShape {
  const outlines = outlinesOf(map);
  if (!outlines.length) return { radius: map.boundsRadius };
  const round = TUNING.seamanship.boundaryBuoys.round;
  const key = `${map.boundsRadius}|${round}|${outlines.map((o) => o.join(' ')).join('|')}`;
  const kept = shapes.get(map);
  if (kept?.key === key) return kept.shape;
  const shape: SeaShape = {
    radius: map.boundsRadius,
    rim: traceRim(map.boundsRadius, outlines, round),
  };
  shapes.set(map, { key, shape });
  return shape;
}

/** A bare radius (the old wall) or a sea shape. */
export function asSeaShape(sea: number | SeaShape): SeaShape {
  return typeof sea === 'number' ? { radius: sea } : sea;
}

/**
 * The joined sea's rim, rounded by `round`: a section's corners rounded (its outline moved in by
 * `round`, then the water grown back out by it) and blended into the round sea with a smooth
 * minimum, so the seam is a fillet too. Traced once by walking along where the blend is zero.
 */
function traceRim(radius: number, outlines: readonly (readonly XY[])[], round: number): XY[] {
  const sections = outlines.map((o) => {
    const inner = round > 0 ? insetOutline(o as XY[], round) : (o as XY[]);
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const [x, y] of o) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    return { inner, box: [x0, y0, x1, y1] as const };
  });
  // Distance-like: negative in the water. Blended over `k`, about the fillet's size.
  const k = Math.max(1e-6, round * 2);
  const smin = (a: number, b: number) => {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - (h * h * k) / 4;
  };
  const f = (x: number, y: number) => {
    let d = Math.hypot(x, y) - radius;
    for (const s of sections) {
      // A section far off cannot change the blend here.
      const [x0, y0, x1, y1] = s.box;
      const far = Math.max(x0 - x, x - x1, y0 - y, y - y1);
      if (far > d + k + round) continue;
      d = smin(d, coastDistance(x, y, s.inner).distance - round);
    }
    return d;
  };
  const grad = (x: number, y: number): XY => {
    const h = 0.25;
    return [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)];
  };
  const project = (p: XY): XY => {
    let [x, y] = p;
    for (let i = 0; i < 6; i++) {
      const v = f(x, y);
      if (Math.abs(v) < 1e-4) break;
      const [gx, gy] = grad(x, y);
      const g2 = gx * gx + gy * gy || 1;
      x -= (v * gx) / g2;
      y -= (v * gy) / g2;
    }
    return [x, y];
  };
  // Start on the outer rim: in from beyond the farthest water along the east, to the first water.
  let reach = radius;
  for (const o of outlines) for (const [x, y] of o) reach = Math.max(reach, Math.hypot(x, y));
  let x = reach + 2 * k;
  while (f(x, 0) > 0 && x > 0) x -= RIM_STEP;
  const start = project([x + RIM_STEP / 2, 0]);
  const rim: XY[] = [start];
  let p = start;
  const most = Math.ceil((40 * reach) / RIM_STEP);
  for (let n = 0; n < most; n++) {
    const [gx, gy] = grad(p[0], p[1]);
    const g = Math.hypot(gx, gy) || 1;
    // Counter-clockwise round the water: the outside (the gradient) on the right.
    p = project([p[0] - (gy / g) * RIM_STEP, p[1] + (gx / g) * RIM_STEP]);
    if (n > 8 && Math.hypot(p[0] - start[0], p[1] - start[1]) < RIM_STEP * 0.75) break;
    rim.push(p);
  }
  return rim.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100] as XY);
}

export interface SeaDistance {
  /** How far inside the water: positive at sea, negative beyond the edge. */
  distance: number;
  /** The way into the water at the nearest edge. */
  nx: number;
  ny: number;
}

/** How far inside the water a point is, and the way back in. */
export function seaDistance(sea: SeaShape, x: number, y: number): SeaDistance {
  if (!sea.rim) {
    const r = Math.hypot(x, y) || 1e-6;
    return { distance: sea.radius - r, nx: -x / r, ny: -y / r };
  }
  const c = coastDistance(x, y, sea.rim as XY[]);
  return { distance: -c.distance, nx: -c.nx, ny: -c.ny };
}

/** Whether a point is at sea, at least `margin` inside the edge. */
export function atSea(sea: SeaShape, x: number, y: number, margin = 0): boolean {
  // Every joined sea holds the whole round sea.
  if (Math.hypot(x, y) <= sea.radius - margin) return true;
  if (!sea.rim) return false;
  const [x0, y0, x1, y1] = seaBox(sea);
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  return seaDistance(sea, x, y).distance >= margin;
}

/** The farthest the water reaches from the middle: the radius that holds the whole sea. */
export function seaReach(sea: SeaShape): number {
  let reach = sea.radius;
  for (const [x, y] of sea.rim ?? []) reach = Math.max(reach, Math.hypot(x, y));
  return reach;
}

const boxes = new WeakMap<object, [number, number, number, number]>();

/** The sea's box, `[west, south, east, north]` in map units. */
export function seaBox(sea: SeaShape): [number, number, number, number] {
  const r = sea.radius;
  if (!sea.rim) return [-r, -r, r, r];
  let box = boxes.get(sea.rim);
  if (!box) {
    box = [-r, -r, r, r];
    for (const [x, y] of sea.rim) {
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x);
      box[3] = Math.max(box[3], y);
    }
    boxes.set(sea.rim, box);
  }
  return box;
}

/**
 * Pushes a point back into the water if it is beyond the edge. Returns the way it was pushed (into
 * the water), or null when it was at sea.
 */
export function keepAtSea(
  sea: SeaShape,
  p: { x: number; y: number },
): { nx: number; ny: number } | null {
  const fromCenter = Math.hypot(p.x, p.y);
  if (fromCenter <= sea.radius) return null;
  if (!sea.rim) {
    // The round sea alone: straight back towards the middle, as the wall always did.
    const nx = -p.x / fromCenter,
      ny = -p.y / fromCenter;
    p.x += -nx * (sea.radius - fromCenter);
    p.y += -ny * (sea.radius - fromCenter);
    return { nx, ny };
  }
  const d = seaDistance(sea, p.x, p.y);
  if (d.distance >= 0) return null;
  p.x += d.nx * -d.distance;
  p.y += d.ny * -d.distance;
  return { nx: d.nx, ny: d.ny };
}

/**
 * The sea's outer edge as one closed line to draw (its first point repeated at the end), about
 * `step` apart.
 */
export function edgeLine(sea: SeaShape, step: number): XY[] {
  if (sea.rim) {
    const every = Math.max(1, Math.floor(step / RIM_STEP));
    const line = sea.rim.filter((_, i) => i % every === 0);
    return [...line, line[0]!];
  }
  const n = Math.max(24, Math.ceil((Math.PI * 2 * sea.radius) / step));
  const line: XY[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    line.push([Math.cos(a) * sea.radius, Math.sin(a) * sea.radius]);
  }
  return line;
}

/**
 * Where the edge buoys float: `offset` beyond the edge, `spacing` apart along it. The round sea
 * alone gives today's ring exactly; a joined sea, a buoy every `spacing` along its rounded rim.
 */
export function edgeSpots(
  sea: SeaShape,
  spacing: number,
  offset: number,
): { x: number; y: number }[] {
  const spots: { x: number; y: number }[] = [];
  if (!sea.rim) {
    const r = sea.radius + offset;
    const count = Math.max(8, Math.round((Math.PI * 2 * r) / spacing));
    for (let i = 0; i < count; i++) {
      // Clockwise from east as seen from above, the order the ring's buoys always had.
      const a = (i / count) * Math.PI * 2;
      spots.push({ x: Math.cos(a) * r, y: -Math.sin(a) * r });
    }
    return spots;
  }
  const rim = sea.rim;
  const n = rim.length;
  // The rim's length, so the buoys share it out evenly and the last is as far from the first.
  let length = 0;
  for (let i = 0; i < n; i++) {
    const a = rim[i]!,
      b = rim[(i + 1) % n]!;
    length += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const count = Math.max(8, Math.round(length / spacing));
  const gap = length / count;
  let along = 0,
    next = 0;
  for (let i = 0; i < n && spots.length < count; i++) {
    const a = rim[i]!,
      b = rim[(i + 1) % n]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (next <= along + len && spots.length < count) {
      const t = len ? (next - along) / len : 0;
      const x = a[0] + (b[0] - a[0]) * t,
        y = a[1] + (b[1] - a[1]) * t;
      // Out of the water: the rim runs counter-clockwise, so the outside is on the right.
      const ox = len ? (b[1] - a[1]) / len : 0,
        oy = len ? -(b[0] - a[0]) / len : 0;
      spots.push({ x: x + ox * offset, y: y + oy * offset });
      next += gap;
    }
    along += len;
  }
  return spots;
}

/**
 * The sharpest turn the edge buoy line makes between three buoys in a row, degrees, and where
 * (the art director's rule: at most `maxTurnDeg`, decision 0202).
 */
export function sharpestTurn(
  sea: SeaShape,
  spacing: number,
): { deg: number; x: number; y: number } {
  const spots = edgeSpots(sea, spacing, 0);
  let worst = { deg: 0, x: 0, y: 0 };
  for (let i = 0; i < spots.length; i++) {
    const a = spots[(i + spots.length - 1) % spots.length]!,
      b = spots[i]!,
      c = spots[(i + 1) % spots.length]!;
    const t1 = Math.atan2(b.y - a.y, b.x - a.x),
      t2 = Math.atan2(c.y - b.y, c.x - b.x);
    let turn = Math.abs(t2 - t1);
    if (turn > Math.PI) turn = 2 * Math.PI - turn;
    const deg = (turn * 180) / Math.PI;
    if (deg > worst.deg) worst = { deg, x: b.x, y: b.y };
  }
  return worst;
}
