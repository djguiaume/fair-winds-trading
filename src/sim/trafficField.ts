import { TUNING } from '../data/tuning';
import { createBoat, targetSpeed } from './boat';
import { PIER_HALF_WIDTH, type Pier, resolveCollisions } from './collision';
import { type Box, apart, boundsOf } from './outlineBounds';
import { islandCoasts } from './islandLayout';
import type { IslandDef, TerrainDef } from './map';
import { knobs } from './difficulty';
import { DEG, wrapAngle } from './math';
import { seaShape } from './seaEdge';
import { type ShipClass, noGoAngle } from './ship';
import type { TrafficBoat, TrafficDef } from './traffic';
import type { Wind } from './wind';
import type { World } from './world';

/*
 * How far a lane mark is by water in this wind (decision 0215): a grid round the fleet's lane,
 * each cell the time to the mark round land, reefs and the sea's edge for her hull, counted in
 * units sailed at her best speed, 0 at the mark. Upwind a stretch costs what beating up it does,
 * so the grid knows that going round an island off the wind can beat a tack up a channel. Made
 * when a boat first sails for that mark in a wind (to 15°), and the last few kept.
 *
 * The fleet's open-water grid under it is filled a share of its cells per step (issue #516): at
 * once it cost up to a third of a second when a fleet woke near the player. Until it is full the
 * helm steers straight for the mark, as she does off the grid.
 */
type Point = { x: number; y: number };

export interface MarkField {
  x0: number;
  y0: number;
  cols: number;
  rows: number;
  d: Float32Array;
}

/** Which cells of a fleet's grid are open water for her hull; `filled` cells are known so far. */
interface OpenGrid {
  x0: number;
  y0: number;
  cols: number;
  rows: number;
  open: Uint8Array;
  version: number;
  /** The current at each cell, knots east and north (difficulty and the switch applied). */
  east: Float32Array;
  north: Float32Array;
  currents: number;
  filled: number;
  /** While filling: the hull, and only the land and piers she could touch in the grid's box. */
  fill: {
    radius: number;
    draft: number;
    near: ReturnType<typeof obstaclesNear>;
  } | null;
}

const FIELD_CELL = 8;
/** Wind directions a field is made for: every 15°. */
const WIND_STEP = 15 * DEG;
/** Fields kept per fleet: her marks in the last few winds. */
const FIELDS_KEPT = 24;
const grids = new WeakMap<TrafficDef, OpenGrid>();
const fields = new WeakMap<TrafficDef, Map<string, MarkField>>();
/** A scratch hull for asking whether a cell is open water. */
const probe = createBoat(0, 0, 0);
const flow = { east: 0, north: 0, id: '' };

/**
 * The islands, terrain and piers a hull of `radius` could touch anywhere in `box` (issue #516):
 * asking `resolveCollisions` with only these gives the same answer at every point of the box, as
 * a hull only moves once it has touched something. A grid of many points asks this once.
 */
export function obstaclesNear(
  box: Box,
  radius: number,
  islands: readonly IslandDef[],
  terrain: readonly TerrainDef[],
  piers: readonly Pier[],
) {
  const reach = radius * Math.max(1, TUNING.seamanship.traffic.abeam);
  return {
    islands: islands.filter((island) => {
      const coasts = islandCoasts(island);
      if (coasts) return coasts.some((outline) => !apart(box, radius, boundsOf(outline)));
      const r = island.radius + radius;
      return !apart(box, r, { minX: island.x, minY: island.y, maxX: island.x, maxY: island.y });
    }),
    terrain: terrain.filter((feature) => !apart(box, radius, boundsOf(feature.outline))),
    piers: piers.filter((pier) => {
      const pad = (pier.halfWidth ?? PIER_HALF_WIDTH) + reach;
      const span = {
        minX: Math.min(pier.x0, pier.x1),
        minY: Math.min(pier.y0, pier.y1),
        maxX: Math.max(pier.x0, pier.x1),
        maxY: Math.max(pier.y0, pier.y1),
      };
      return !apart(box, pad, span);
    }),
  };
}

/** A new, empty grid over the lane's box and room round it to go about in. */
function newGrid(world: World, b: TrafficBoat, lane: readonly Point[], scale: number): OpenGrid {
  const pad = TUNING.seamanship.traffic.fieldPad;
  const xs = lane.map((p) => p.x);
  const ys = lane.map((p) => p.y);
  if (b.fleet.grounds) {
    xs.push(b.fleet.grounds[0] - b.fleet.grounds[2], b.fleet.grounds[0] + b.fleet.grounds[2]);
    ys.push(b.fleet.grounds[1] - b.fleet.grounds[2], b.fleet.grounds[1] + b.fleet.grounds[2]);
  }
  const x0 = Math.min(...xs) - pad;
  const y0 = Math.min(...ys) - pad;
  const cols = Math.ceil((Math.max(...xs) + pad - x0) / FIELD_CELL) + 1;
  const rows = Math.ceil((Math.max(...ys) + pad - y0) / FIELD_CELL) + 1;
  const box: Box = {
    minX: x0,
    minY: y0,
    maxX: x0 + (cols - 1) * FIELD_CELL,
    maxY: y0 + (rows - 1) * FIELD_CELL,
  };
  const radius = b.ship.radius + 2;
  const { islands, terrain } = world.land;
  return {
    x0,
    y0,
    cols,
    rows,
    open: new Uint8Array(cols * rows),
    version: world.land.version,
    east: new Float32Array(cols * rows),
    north: new Float32Array(cols * rows),
    currents: scale,
    filled: 0,
    fill: {
      radius,
      draft: b.ship.draft,
      near: obstaclesNear(box, radius, islands, terrain, world.piers),
    },
  };
}

/** Fills up to `cells` more cells of the grid; returns how many it filled. */
function fillGrid(world: World, grid: OpenGrid, cells: number): number {
  const { fill, rows, open } = grid;
  if (!fill) return 0;
  const sea = seaShape(world.map);
  const { islands, terrain, piers } = fill.near;
  const end = Math.min(open.length, grid.filled + cells);
  const start = grid.filled;
  for (let cell = start; cell < end; cell++) {
    const x = grid.x0 + Math.floor(cell / rows) * FIELD_CELL;
    const y = grid.y0 + (cell % rows) * FIELD_CELL;
    probe.x = x;
    probe.y = y;
    probe.speedKn = 0;
    const blocked =
      resolveCollisions(probe, fill.radius, islands, sea, terrain, piers, fill.draft) !== null;
    open[cell] = blocked ? 0 : 1;
    if (blocked || grid.currents <= 0) continue;
    const water = world.currents.at(x, y, grid.currents, flow);
    grid.east[cell] = water.east;
    grid.north[cell] = water.north;
  }
  grid.filled = end;
  if (end === open.length) grid.fill = null;
  return end - start;
}

/** The fleet's open-water grid, filled from this step's share of cells; null until it is full. */
function openGrid(world: World, b: TrafficBoat, lane: readonly Point[]): OpenGrid | null {
  const scale = world.currentsOn ? knobs(world.trade.difficulty).currents : 0;
  let grid = grids.get(b.fleet);
  if (!grid || grid.version !== world.land.version || grid.currents !== scale) {
    grid = newGrid(world, b, lane, scale);
    grids.set(b.fleet, grid);
  }
  const traffic = world.traffic;
  if (grid.fill) traffic.gridCells -= fillGrid(world, grid, Math.max(0, traffic.gridCells));
  return grid.fill ? null : grid;
}

/** Her speed toward a bearing `rel` off the wind, beating if she must, as a share of her best. */
function madeGood(ship: ShipClass, rel: number, best: number): number {
  const wind = { from: 0, speedKn: 14 };
  const noGo = noGoAngle(ship) + TUNING.seamanship.traffic.beatMarginDeg * DEG;
  const a = Math.abs(wrapAngle(rel));
  if (a >= noGo) return targetSpeed(ship, a, wind, 1) / best;
  // Up a stretch inside the no-go zone she sails both close-hauled courses in turn.
  return ((targetSpeed(ship, noGo, wind, 1) / best) * Math.cos(noGo)) / Math.cos(a);
}

/** Her best speed on any heading, in a 14-knot wind (the share is the same in any breeze). */
function bestSpeed(ship: ShipClass): number {
  let best = 0;
  for (let k = 0; k < 36; k++)
    best = Math.max(best, targetSpeed(ship, k * 5 * DEG, { from: 0, speedKn: 14 }, 1));
  return best;
}

/** The way by water to `mark` from every cell of the fleet's grid; null while it fills. */
export function markField(
  world: World,
  b: TrafficBoat,
  lane: readonly Point[],
  mark: Point,
  wind: Wind,
): MarkField | null {
  let byMark = fields.get(b.fleet);
  if (!byMark) fields.set(b.fleet, (byMark = new Map()));
  const step = ((Math.round(wind.from / WIND_STEP) % 24) + 24) % 24;
  const grid = openGrid(world, b, lane);
  if (!grid) return null;
  const key = `${mark.x},${mark.y}:${world.land.version}:${step}:${grid.currents}`;
  const known = byMark.get(key);
  if (known) {
    // The most recent last, so the oldest goes first.
    byMark.delete(key);
    byMark.set(key, known);
    return known;
  }
  const field = timeField(grid, b.ship, mark, step * WIND_STEP);
  byMark.set(key, field);
  if (byMark.size > FIELDS_KEPT) byMark.delete(byMark.keys().next().value!);
  return field;
}

/** Dijkstra from the cells round the mark, eight ways, the wind from `from`. */
function timeField(grid: OpenGrid, ship: ShipClass, mark: Point, from: number): MarkField {
  const { x0, y0, cols, rows, open: water, east, north } = grid;
  const open = water.slice();
  const n = cols * rows;
  const d = new Float32Array(n).fill(Infinity);
  // The cost of one step to each of the eight neighbours, sailed toward this cell.
  const best = bestSpeed(ship);
  // Her speed made good each of the eight ways, knots: from the neighbour (i + di, j + dj) to
  // here she sails toward −di east, −dj north. The current there helps or hinders.
  const share: number[] = [];
  for (let di = -1; di <= 1; di++)
    for (let dj = -1; dj <= 1; dj++)
      share.push(di || dj ? best * madeGood(ship, Math.atan2(-di, -dj) - from, best) : 0);
  const cost = (next: number, di: number, dj: number) => {
    const len = di && dj ? Math.SQRT2 : 1;
    const along = (-di * east[next]! - dj * north[next]!) / len;
    const kn = share[(di + 1) * 3 + dj + 1]! + along;
    return (len * FIELD_CELL * best) / Math.max(best * 0.05, kn);
  };
  // A heap of (time, cell).
  const heapD: number[] = [];
  const heapC: number[] = [];
  const push = (cell: number, dist: number) => {
    if (dist >= d[cell]!) return;
    d[cell] = dist;
    heapD.push(dist);
    heapC.push(cell);
    let k = heapD.length - 1;
    while (k > 0) {
      const up = (k - 1) >> 1;
      if (heapD[up]! <= heapD[k]!) break;
      [heapD[up], heapD[k]] = [heapD[k]!, heapD[up]!];
      [heapC[up], heapC[k]] = [heapC[k]!, heapC[up]!];
      k = up;
    }
  };
  const pop = () => {
    const top = heapC[0]!;
    const lastD = heapD.pop()!;
    const lastC = heapC.pop()!;
    if (heapD.length) {
      heapD[0] = lastD;
      heapC[0] = lastC;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        if (l >= heapD.length) break;
        const m = l + 1 < heapD.length && heapD[l + 1]! < heapD[l]! ? l + 1 : l;
        if (heapD[k]! <= heapD[m]!) break;
        [heapD[k], heapD[m]] = [heapD[m]!, heapD[k]!];
        [heapC[k], heapC[m]] = [heapC[m]!, heapC[k]!];
        k = m;
      }
    }
    return top;
  };
  const mi = (mark.x - x0) / FIELD_CELL;
  const mj = (mark.y - y0) / FIELD_CELL;
  for (const i of [Math.floor(mi), Math.ceil(mi)])
    for (const j of [Math.floor(mj), Math.ceil(mj)])
      if (i >= 0 && j >= 0 && i < cols && j < rows) {
        const cell = i * rows + j;
        open[cell] = 1;
        push(cell, Math.hypot(x0 + i * FIELD_CELL - mark.x, y0 + j * FIELD_CELL - mark.y));
      }
  const done = new Uint8Array(n);
  while (heapD.length) {
    const cell = pop();
    if (done[cell]) continue;
    done[cell] = 1;
    const i = Math.floor(cell / rows);
    const j = cell % rows;
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const a = i + di;
        const c = j + dj;
        if (a < 0 || c < 0 || a >= cols || c >= rows) continue;
        const next = a * rows + c;
        if (!open[next] || done[next]) continue;
        push(next, d[cell]! + cost(next, di, dj));
      }
  }
  return { x0, y0, cols, rows, d };
}

/** Scratch for `fieldAt`, which the helm asks dozens of times a step. */
const corners = new Float64Array(4);
const weights = new Float64Array(4);

/** The distance by water at a point, smoothed between cells; Infinity by land or off the grid. */
export function fieldAt(f: MarkField, x: number, y: number): number {
  const u = (x - f.x0) / FIELD_CELL;
  const v = (y - f.y0) / FIELD_CELL;
  const i = Math.floor(u);
  const j = Math.floor(v);
  if (i < 0 || j < 0 || i + 1 >= f.cols || j + 1 >= f.rows) return Infinity;
  const fu = u - i;
  const fv = v - j;
  corners[0] = f.d[i * f.rows + j]!;
  corners[1] = f.d[(i + 1) * f.rows + j]!;
  corners[2] = f.d[i * f.rows + j + 1]!;
  corners[3] = f.d[(i + 1) * f.rows + j + 1]!;
  weights[0] = (1 - fu) * (1 - fv);
  weights[1] = fu * (1 - fv);
  weights[2] = (1 - fu) * fv;
  weights[3] = fu * fv;
  // By a shore some corners are land: the water ones count, and the land's share costs a cell,
  // so a narrow passage (a cell or two wide) still leads somewhere.
  let sum = 0;
  let weight = 0;
  let dry = 0;
  for (let k = 0; k < 4; k++) {
    if (corners[k] === Infinity) dry += weights[k]!;
    else {
      sum += corners[k]! * weights[k]!;
      weight += weights[k]!;
    }
  }
  if (dry > 0.75 || weight === 0) return Infinity;
  return sum / weight + dry * FIELD_CELL * 2;
}
