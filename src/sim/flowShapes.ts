import { TUNING } from '../data/tuning';

/**
 * The shapes of currents and wind zones (decision 0140), shared by the game, the map checks and
 * the map editor so the editor shows exactly what the game sails. Authored points are smoothed by
 * corner cutting (Chaikin): the curve stays inside the points' polygon and never overshoots, and a
 * lane keeps its first and last point so the water starts and ends where it was drawn.
 */

export type LanePoint = [number, number, number];
export type OutlinePoint = [number, number];

const rounds = () => TUNING.weather.currents.smoothRounds;

/** An open lane `[x, y, width]` smoothed; widths ease along with the positions. */
export function smoothPath(path: readonly LanePoint[], n = rounds()): LanePoint[] {
  let out = path.map((p) => [...p] as LanePoint);
  if (out.length < 3) return out;
  for (let r = 0; r < n; r++) {
    const next: LanePoint[] = [out[0]!];
    for (let i = 0; i < out.length - 1; i++) {
      const a = out[i]!,
        b = out[i + 1]!;
      next.push(mix(a, b, 0.25), mix(a, b, 0.75));
    }
    next.push(out[out.length - 1]!);
    out = next;
  }
  return out;
}

/** A closed outline smoothed (the last point joins the first). */
export function smoothOutline(outline: readonly OutlinePoint[], n = rounds()): OutlinePoint[] {
  let out = outline.map((p) => [...p] as OutlinePoint);
  if (out.length < 3) return out;
  for (let r = 0; r < n; r++) {
    const next: OutlinePoint[] = [];
    for (let i = 0; i < out.length; i++) {
      const a = out[i]!,
        b = out[(i + 1) % out.length]!;
      next.push(mix(a, b, 0.25), mix(a, b, 0.75));
    }
    out = next;
  }
  return out;
}

function mix<T extends number[]>(a: T, b: T, t: number): T {
  return a.map((v, k) => v + (b[k]! - v) * t) as T;
}

/** True when two edges of a closed outline cross (neighbouring edges share a point and do not). */
export function outlineCrosses(outline: readonly OutlinePoint[]): boolean {
  const n = outline.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(outline[i]!, outline[(i + 1) % n]!, outline[j]!, outline[(j + 1) % n]!))
        return true;
    }
  return false;
}

function segmentsCross(
  a: readonly number[],
  b: readonly number[],
  c: readonly number[],
  d: readonly number[],
): boolean {
  const side = (p: readonly number[], q: readonly number[], r: readonly number[]) =>
    Math.sign((q[0]! - p[0]!) * (r[1]! - p[1]!) - (q[1]! - p[1]!) * (r[0]! - p[0]!));
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

/** True when (x, y) is inside a closed outline (even-odd). */
export function insideOutline(x: number, y: number, outline: readonly OutlinePoint[]): boolean {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, yi] = outline[i]!,
      [xj, yj] = outline[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The bounding circle of some points, padded by `pad` (for the `SpatialGrid`). */
export function boundingCircle(points: readonly (readonly number[])[], pad = 0) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p[0]!);
    x1 = Math.max(x1, p[0]!);
    y0 = Math.min(y0, p[1]!);
    y1 = Math.max(y1, p[1]!);
  }
  const x = (x0 + x1) / 2,
    y = (y0 + y1) / 2;
  let r = 0;
  for (const p of points) r = Math.max(r, Math.hypot(p[0]! - x, p[1]! - y));
  return { x, y, r: r + pad };
}

/**
 * The two edges of a smoothed lane, left then right looking downstream, `scale` × half its width
 * out from the centre line: the band the editor and the chart fill.
 */
export function laneEdges(
  lane: readonly LanePoint[],
  scale = 1,
): { left: OutlinePoint[]; right: OutlinePoint[] } {
  const left: OutlinePoint[] = [],
    right: OutlinePoint[] = [];
  for (let i = 0; i < lane.length; i++) {
    const a = lane[Math.max(0, i - 1)]!,
      b = lane[Math.min(lane.length - 1, i + 1)]!;
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      len = Math.hypot(dx, dy) || 1;
    // Left of the flow is (-dy, dx).
    const [x, y, w] = lane[i]!;
    const h = (w / 2) * scale;
    left.push([x - (dy / len) * h, y + (dx / len) * h]);
    right.push([x + (dy / len) * h, y - (dx / len) * h]);
  }
  return { left, right };
}

/** One wave crest across a current: from `a` through a peak bowed downstream to `b`. */
export interface Crest {
  a: OutlinePoint;
  /** Quadratic control point (the bow, downstream of the centre). */
  c: OutlinePoint;
  b: OutlinePoint;
  /** 0..1: fainter where the lane starts, ends or widens. */
  alpha: number;
}

/** Gap between crests along the flow (map units). */
const CREST_GAP = 34;

/**
 * Crests across a smoothed lane, `drift` units downstream of their rest place (the caller grows
 * it with time so they move with the water). Shared by the editor preview and the sea chart.
 */
export function laneCrests(lane: readonly LanePoint[], drift: number, endFade = 40): Crest[] {
  const out: Crest[] = [];
  if (lane.length < 2) return out;
  const lengths = [0];
  for (let i = 1; i < lane.length; i++)
    lengths.push(
      lengths[i - 1]! + Math.hypot(lane[i]![0] - lane[i - 1]![0], lane[i]![1] - lane[i - 1]![1]),
    );
  const total = lengths[lengths.length - 1]!;
  const narrowest = Math.min(...lane.map((p) => p[2]));
  let i = 1;
  for (let s = (((drift % CREST_GAP) + CREST_GAP) % CREST_GAP) + 4; s < total - 4; s += CREST_GAP) {
    while (i < lane.length - 1 && lengths[i]! < s) i++;
    const p = lane[i - 1]!,
      q = lane[i]!;
    const seg = lengths[i]! - lengths[i - 1]! || 1;
    const t = (s - lengths[i - 1]!) / seg;
    const x = p[0] + (q[0] - p[0]) * t,
      y = p[1] + (q[1] - p[1]) * t,
      w = p[2] + (q[2] - p[2]) * t;
    const tx = (q[0] - p[0]) / seg,
      ty = (q[1] - p[1]) / seg;
    const h = w * 0.3,
      bow = w * 0.16;
    const ends = Math.min(1, s / endFade, (total - s) / endFade);
    out.push({
      a: [x - ty * h - tx * bow * 0.4, y + tx * h - ty * bow * 0.4],
      c: [x + tx * bow, y + ty * bow],
      b: [x + ty * h - tx * bow * 0.4, y - tx * h - ty * bow * 0.4],
      alpha: Math.max(0, ends) * Math.min(1, (narrowest / w) ** 0.7),
    });
  }
  return out;
}

/** Crests in rows across an area current flowing towards `towardDeg`, staggered. */
export function areaCrests(
  outline: readonly OutlinePoint[],
  towardDeg: number,
  drift: number,
): Crest[] {
  const out: Crest[] = [];
  if (outline.length < 3) return out;
  const { x: ox, y: oy, r } = boundingCircle(outline);
  const a = (towardDeg * Math.PI) / 180;
  const tx = Math.sin(a),
    ty = Math.cos(a);
  const h = 13,
    bow = 7,
    across = 48;
  const shift = ((drift % CREST_GAP) + CREST_GAP) % CREST_GAP;
  for (let row = -Math.ceil(r / CREST_GAP); row * CREST_GAP <= r; row++) {
    const along = row * CREST_GAP + shift;
    const stagger = row % 2 ? across / 2 : 0;
    for (let col = -Math.ceil(r / across) - 1; col * across <= r; col++) {
      const side = col * across + stagger;
      const x = ox + tx * along + ty * side,
        y = oy + ty * along - tx * side;
      if (!insideOutline(x, y, outline)) continue;
      out.push({
        a: [x - ty * h - tx * bow * 0.4, y + tx * h - ty * bow * 0.4],
        c: [x + tx * bow, y + ty * bow],
        b: [x + ty * h - tx * bow * 0.4, y - tx * h - ty * bow * 0.4],
        alpha: 0.8,
      });
    }
  }
  return out;
}
