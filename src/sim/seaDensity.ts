import { type SeaShape, atSea, seaDistance, seaReach, seaShape } from './seaEdge';
import type { MapDef } from './map';
import { type Sector, type Sectors, bearingOf, inSector, sectorSpan } from './seaSectors';

/**
 * Sea density (decision 0180): how full each sea's slice of the outer ring is, so no sea feels
 * empty next to the others. Things the boat sees (islands, reefs, banks, ice, sea marks) are
 * "landmarks"; zones and currents are felt more than seen and are counted apart. Water farther
 * than `sight` from every landmark is "empty water". Measured on a grid over the outer ring.
 */
export interface DensityOptions {
  /** Inner and outer radius of the measured ring (default: the charted radius to the edge). */
  inner?: number;
  outer?: number;
  /** Distance at which a landmark keeps the water from feeling empty, map units. */
  sight?: number;
  /** Grid step, map units. */
  cell?: number;
  /** How many empty spots to list per sector. */
  spots?: number;
  /** Also return the empty water cells (for the chart). */
  keepCells?: boolean;
}

export interface EmptySpot {
  x: number;
  y: number;
  /** Distance to the nearest landmark: the radius of the empty disc. */
  radius: number;
  bearing: number;
}

export interface SectorDensity {
  id: string;
  sector: Sector;
  /** Open water in the slice, thousands of square map units. */
  water: number;
  islands: number;
  ports: number;
  shapes: number;
  marks: number;
  zones: number;
  currents: number;
  /** Landmarks (islands, shapes, marks) per 100 000 square units of water. */
  perArea: number;
  /** Share of the water farther than `sight` from any landmark, 0..1. */
  empty: number;
  /** Share of the water inside a wind zone or a current, 0..1. */
  felt: number;
  /** The biggest empty discs, largest first, not overlapping. */
  spots: EmptySpot[];
  /** Empty share in slices of `step` degrees from the sector's start, for finding the gaps. */
  slices: { from: number; to: number; empty: number }[];
  /** Middles of the empty water cells, with `keepCells`. */
  emptyCells?: Pt[];
}

export type Pt = [number, number];

function inPolygon(x: number, y: number, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segDist(x: number, y: number, [ax, ay]: Pt, [bx, by]: Pt): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

/** Distance from a point to a closed outline, 0 inside. */
function polyDist(x: number, y: number, poly: readonly Pt[]): number {
  if (inPolygon(x, y, poly)) return 0;
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
    best = Math.min(best, segDist(x, y, poly[j]!, poly[i]!));
  return best;
}

function polyBox(poly: readonly Pt[]): [number, number, number, number] {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of poly)
    [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  return [x0, y0, x1, y1];
}

/** Density of every sector of the grown sea. The map is the merged one (`grownMap`). */
export function seaDensity(
  map: MapDef,
  sectors: Sectors,
  opts: DensityOptions = {},
): SectorDensity[] {
  const inner = opts.inner ?? map.fog?.chartedRadius ?? 445;
  // The sea's own shape, a section sticking out included (decision 0202), unless told a ring.
  const sea: SeaShape = opts.outer === undefined ? seaShape(map) : { radius: opts.outer };
  const outer = seaReach(sea);
  const sight = opts.sight ?? 160;
  const cell = opts.cell ?? 10;
  const step = 15;

  // Landmarks as distance functions, with a box to skip far ones quickly.
  type Mark = {
    box: [number, number, number, number];
    dist: (x: number, y: number) => number;
    land: boolean;
  };
  const landmarks: Mark[] = [];
  const shown = (tags?: string[]) => !(tags ?? []).some((t) => t.startsWith('during:'));
  for (const i of map.islands) {
    if (!shown(i.tags)) continue;
    landmarks.push({
      box: [i.x - i.radius, i.y - i.radius, i.x + i.radius, i.y + i.radius],
      dist: (x, y) => Math.max(0, Math.hypot(x - i.x, y - i.y) - i.radius),
      land: true,
    });
  }
  for (const t of map.terrain ?? []) {
    if (t.outline.length < 3) continue;
    landmarks.push({
      box: polyBox(t.outline),
      dist: (x, y) => polyDist(x, y, t.outline),
      land: t.kind === 'island',
    });
  }
  for (const m of map.marks ?? [])
    landmarks.push({
      box: [m.x, m.y, m.x, m.y],
      dist: (x, y) => Math.hypot(x - m.x, y - m.y),
      land: false,
    });
  const felt = [
    ...(map.windZones ?? []).map((z) => z.outline),
    ...(map.currents ?? []).flatMap((c) => (c.outline ? [c.outline as Pt[]] : [])),
  ].filter((o) => o.length >= 3);
  const lanes = (map.currents ?? []).filter((c) => c.path?.length);

  const nearest = (x: number, y: number, cap: number) => {
    let best = cap;
    for (const l of landmarks) {
      const [x0, y0, x1, y1] = l.box;
      if (x < x0 - best || x > x1 + best || y < y0 - best || y > y1 + best) continue;
      best = Math.min(best, l.dist(x, y));
      if (best === 0) return 0;
    }
    return best;
  };

  const out: SectorDensity[] = [];
  for (const [id, sector] of Object.entries(sectors)) {
    const span = sectorSpan(sector);
    const at = (b: number) => (((b - sector[0]) % 360) + 360) % 360;
    const where = (x: number, y: number) =>
      Math.hypot(x, y) >= inner && inSector(bearingOf(x, y), sector, 0);
    // Counts: by the thing's middle.
    const mid = (pts: readonly Pt[]) => {
      const [x0, y0, x1, y1] = polyBox(pts);
      return [(x0 + x1) / 2, (y0 + y1) / 2] as Pt;
    };
    const islands = map.islands.filter((i) => where(i.x, i.y));
    const ports = map.ports.filter((p) => islands.some((i) => i.id === p.islandId)).length;
    const shapes = (map.terrain ?? []).filter(
      (t) => t.outline.length && where(...mid(t.outline)),
    ).length;
    const marks = (map.marks ?? []).filter((m) => where(m.x, m.y)).length;
    const zones = (map.windZones ?? []).filter((z) => where(...mid(z.outline))).length;
    const currents = (map.currents ?? []).filter((c) => {
      const pts = (c.path?.map(([x, y]) => [x, y] as Pt) ?? c.outline ?? []) as Pt[];
      return pts.length > 0 && where(...mid(pts));
    }).length;

    // The grid.
    let water = 0;
    let empty = 0;
    let feltCells = 0;
    const cells: EmptySpot[] = [];
    const emptyCells: Pt[] = [];
    const sliceN = Math.ceil(span / step);
    const sw = new Array<number>(sliceN).fill(0);
    const se = new Array<number>(sliceN).fill(0);
    for (let x = -outer; x <= outer; x += cell)
      for (let y = -outer; y <= outer; y += cell) {
        const r = Math.hypot(x, y);
        if (r < inner || !atSea(sea, x, y)) continue;
        const b = bearingOf(x, y);
        if (!inSector(b, sector, 0)) continue;
        if (landmarks.some((l) => l.land && l.dist(x, y) === 0)) continue;
        const d = nearest(x, y, 2 * outer);
        water++;
        const k = Math.min(sliceN - 1, Math.floor(at(b) / step));
        sw[k]!++;
        if (d > sight) {
          empty++;
          emptyCells.push([x, y]);
          se[k]!++;
        }
        if (
          felt.some((o) => inPolygon(x, y, o)) ||
          lanes.some((c) => {
            const p = c.path!;
            for (let i = 1; i < p.length; i++) {
              const w = Math.max(p[i - 1]![2] ?? 20, p[i]![2] ?? 20) / 2;
              if (segDist(x, y, [p[i - 1]![0], p[i - 1]![1]], [p[i]![0], p[i]![1]]) <= w)
                return true;
            }
            return false;
          })
        )
          feltCells++;
        // An empty disc may not reach past the rim or out of the slice's water.
        const room = Math.min(d, seaDistance(sea, x, y).distance, r - inner);
        if (room > sight / 2) cells.push({ x, y, radius: room, bearing: b });
      }
    cells.sort((a, b) => b.radius - a.radius);
    const spots: EmptySpot[] = [];
    for (const c of cells) {
      if (spots.length >= (opts.spots ?? 4)) break;
      if (spots.some((s) => Math.hypot(s.x - c.x, s.y - c.y) < s.radius + c.radius * 0.5)) continue;
      spots.push({ ...c, radius: Math.round(c.radius), bearing: Math.round(c.bearing) });
    }
    const area = water * cell * cell;
    out.push({
      id,
      sector,
      water: Math.round(area / 1000),
      islands: islands.length,
      ports,
      shapes,
      marks,
      zones,
      currents,
      perArea: Math.round(((islands.length + shapes + marks) / area) * 1e5 * 10) / 10,
      empty: water ? empty / water : 0,
      felt: water ? feltCells / water : 0,
      spots,
      slices: sw.map((n, k) => ({
        from: (sector[0] + k * step) % 360,
        to: (sector[0] + Math.min(span, (k + 1) * step)) % 360,
        empty: n ? se[k]! / n : 0,
      })),
      emptyCells: opts.keepCells ? emptyCells : undefined,
    });
  }
  return out;
}

/** The density table as text lines, one per sector, then its gaps and empty spots. */
export function densityLines(rows: SectorDensity[]): string[] {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const out = [
    'sea     slice     water  isl port shape mark zone curr  per100k  empty  felt  biggest empty',
  ];
  for (const r of rows)
    out.push(
      [
        r.id.padEnd(7),
        `${r.sector[0]}..${r.sector[1]}`.padEnd(9),
        `${r.water}k`.padStart(6),
        String(r.islands).padStart(4),
        String(r.ports).padStart(4),
        String(r.shapes).padStart(5),
        String(r.marks).padStart(4),
        String(r.zones).padStart(4),
        String(r.currents).padStart(4),
        String(r.perArea).padStart(8),
        pct(r.empty).padStart(6),
        pct(r.felt).padStart(5),
        r.spots[0] ? ` r${r.spots[0].radius} at ${r.spots[0].bearing}°` : '',
      ].join(' '),
    );
  for (const r of rows) {
    out.push(
      `${r.id}: empty by ${r.slices[1] ? r.slices[1].from - r.slices[0]!.from : 0}° slice ${r.slices
        .map((s) => `${s.from}° ${pct(s.empty)}`)
        .join(', ')}`,
    );
    out.push(
      `  empty spots: ${r.spots.map((s) => `r${s.radius} at (${s.x},${s.y}) ${s.bearing}°`).join(', ')}`,
    );
  }
  return out;
}
