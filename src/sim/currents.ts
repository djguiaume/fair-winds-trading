import { TUNING } from '../data/tuning';
import { coastDistance } from './coast';
import {
  type LanePoint,
  type OutlinePoint,
  boundingCircle,
  insideOutline,
  smoothOutline,
  smoothPath,
} from './flowShapes';
import { islandCoasts } from './islandLayout';
import type { CurrentDef, MapDef } from './map';
import { DEG } from './math';
import { SpatialGrid } from './spatial';

/**
 * Where the water moves (decision 0140). Built once per map from its `currents`; `at` is asked
 * only at the points that need it (the boat, the boats simulated near it, the balance bots), and
 * asks a `SpatialGrid` for the few lane segments and areas near that point, so its cost stays flat
 * however large the sea. Pure function of the map and place: nothing to save.
 */

/** The water's velocity at a point, in knots (east, north), and the current that carries it. */
export interface CurrentSample {
  east: number;
  north: number;
  /** Id of the strongest current at the point, or '' in still water. */
  id: string;
}

interface Segment {
  x: number;
  y: number;
  r: number;
  current: number;
  ax: number;
  ay: number;
  /** Unit tangent downstream, length. */
  tx: number;
  ty: number;
  len: number;
  wa: number;
  wb: number;
  /** Distance along the lane at `a`. */
  s: number;
}

interface Area {
  x: number;
  y: number;
  r: number;
  current: number;
  outline: OutlinePoint[];
  east: number;
  north: number;
}

interface Land {
  x: number;
  y: number;
  r: number;
  /** Signed distance from the shore, positive at sea. */
  distance(x: number, y: number): number;
}

/** A lane's centre line after smoothing, with its length and narrowest width. */
export interface LaneShape {
  points: LanePoint[];
  length: number;
  narrowest: number;
}

export function laneShape(current: CurrentDef): LaneShape | null {
  if (!current.path || current.path.length < 2) return null;
  const points = smoothPath(current.path);
  let length = 0;
  for (let i = 1; i < points.length; i++)
    length += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
  return { points, length, narrowest: Math.min(...points.map((p) => p[2])) };
}

const smooth = (e0: number, e1: number, v: number) => {
  if (e1 <= e0) return v >= e1 ? 1 : 0;
  const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export class CurrentField {
  readonly currents: readonly CurrentDef[];
  private readonly lanes: (LaneShape | null)[];
  private readonly grid: SpatialGrid<Segment | Area>;
  private readonly land: SpatialGrid<Land>;
  private readonly found: (Segment | Area)[] = [];
  private readonly shores: Land[] = [];
  /** Per current: best normalised distance and its strength this query. */
  private readonly best: Float64Array;
  private readonly bestEast: Float64Array;
  private readonly bestNorth: Float64Array;

  constructor(map: Pick<MapDef, 'currents' | 'islands' | 'terrain'>) {
    this.currents = map.currents ?? [];
    this.lanes = this.currents.map(laneShape);
    const items: (Segment | Area)[] = [];
    this.currents.forEach((c, current) => {
      const lane = this.lanes[current];
      if (lane) {
        let s = 0;
        for (let i = 1; i < lane.points.length; i++) {
          const [ax, ay, wa] = lane.points[i - 1]!,
            [bx, by, wb] = lane.points[i]!;
          const len = Math.hypot(bx - ax, by - ay);
          if (len < 1e-6) continue;
          items.push({
            x: (ax + bx) / 2,
            y: (ay + by) / 2,
            r: len / 2 + Math.max(wa, wb) / 2,
            current,
            ax,
            ay,
            tx: (bx - ax) / len,
            ty: (by - ay) / len,
            len,
            wa,
            wb,
            s,
          });
          s += len;
        }
      } else if (c.outline && c.outline.length >= 3) {
        const outline = smoothOutline(c.outline);
        const a = (c.towardDeg ?? 0) * DEG;
        items.push({
          ...boundingCircle(outline),
          current,
          outline,
          east: Math.sin(a),
          north: Math.cos(a),
        });
      }
    });
    this.grid = new SpatialGrid(items);
    const land: Land[] = [];
    for (const island of map.islands) {
      const coasts = islandCoasts(island);
      land.push({
        x: island.x,
        y: island.y,
        r: island.radius * (coasts ? 1.6 : 1),
        distance: coasts
          ? (x, y) => Math.min(...coasts.map((c) => coastDistance(x, y, c).distance))
          : (x, y) => Math.hypot(x - island.x, y - island.y) - island.radius,
      });
    }
    for (const t of map.terrain ?? [])
      if (t.kind !== 'shallows')
        land.push({
          ...boundingCircle(t.outline),
          distance: (x, y) => coastDistance(x, y, t.outline).distance,
        });
    this.land = new SpatialGrid(land);
    const n = this.currents.length;
    this.best = new Float64Array(n);
    this.bestEast = new Float64Array(n);
    this.bestNorth = new Float64Array(n);
  }

  /** The lane shape of a current (null for an area). */
  lane(index: number): LaneShape | null {
    return this.lanes[index] ?? null;
  }

  /** The water's velocity at (x, y), knots; `scale` multiplies every speed (difficulty). */
  at(x: number, y: number, scale = 1, out: CurrentSample = { east: 0, north: 0, id: '' }) {
    out.east = 0;
    out.north = 0;
    out.id = '';
    if (!this.currents.length || scale <= 0) return out;
    const tune = TUNING.weather.currents;
    const near = this.grid.near(x, y, 0, this.found);
    if (!near.length) return out;
    this.best.fill(Infinity);
    this.bestEast.fill(0);
    this.bestNorth.fill(0);
    for (const item of near) {
      const c = this.currents[item.current]!;
      if ('outline' in item) {
        if (!insideOutline(x, y, item.outline)) continue;
        const inset = -coastDistance(x, y, item.outline).distance;
        const k = smooth(0, tune.edgeFadeUnits, inset) * c.speedKn;
        this.best[item.current] = 0;
        this.bestEast[item.current] = item.east * k;
        this.bestNorth[item.current] = item.north * k;
        continue;
      }
      // Nearest point on the segment, and how far across the lane that is.
      const along = (x - item.ax) * item.tx + (y - item.ay) * item.ty;
      const t = Math.min(1, Math.max(0, along / item.len));
      const px = item.ax + item.tx * item.len * t,
        py = item.ay + item.ty * item.len * t;
      const half = (item.wa + (item.wb - item.wa) * t) / 2;
      const across = Math.hypot(x - px, y - py) / half;
      if (across >= 1 || across >= this.best[item.current]!) continue;
      const lane = this.lanes[item.current]!;
      const s = item.s + item.len * t;
      const fade = Math.min(tune.edgeFadeUnits, half);
      const k =
        c.speedKn *
        (1 - smooth(half - fade, half, across * half)) *
        smooth(0, tune.endFadeUnits, s) *
        smooth(0, tune.endFadeUnits, lane.length - s) *
        Math.pow(lane.narrowest / (half * 2), tune.wideSlowdown);
      this.best[item.current] = across;
      this.bestEast[item.current] = item.tx * k;
      this.bestNorth[item.current] = item.ty * k;
    }
    let strongest = 0;
    for (let i = 0; i < this.currents.length; i++) {
      const e = this.bestEast[i]!,
        n = this.bestNorth[i]!;
      if (!e && !n) continue;
      out.east += e;
      out.north += n;
      const speed = e * e + n * n;
      if (speed > strongest) {
        strongest = speed;
        out.id = this.currents[i]!.id;
      }
    }
    if (!out.id) return out;
    // Calm near land, so harbours stay still.
    const reach = tune.coastFadeUnits;
    let shore = reach;
    for (const land of this.land.near(x, y, reach, this.shores))
      shore = Math.min(shore, land.distance(x, y));
    const k = smooth(0, reach, shore) * scale;
    out.east *= k;
    out.north *= k;
    if (!k) out.id = '';
    return out;
  }
}
