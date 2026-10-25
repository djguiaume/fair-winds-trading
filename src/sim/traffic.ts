import { TUNING } from '../data/tuning';
import { questShown } from '../data/islands';
import {
  type BoatControls,
  type BoatState,
  createBoat,
  knotToUnits,
  stepBoat,
  targetSpeed,
} from './boat';
import { type Pier, resolveCollisions } from './collision';
import { seaShape } from './seaEdge';
import type { MapDef } from './map';
import { createRng, range, type Rng } from './rng';
import { type ShipClass, noGoAngle } from './ship';
import { DEG, bearingTo, bearingVector, clamp, wrapAngle } from './math';
import { type Wind, localWind, windAt, windEffectAt } from './wind';
import type { World, WorldEvent } from './world';
import { townLevels } from './founding';
import { questsDone, questsRunning } from './settlement';
import { knobs } from './difficulty';
import { REGATTA, crossesGate } from './regatta';

/*
 * Other boats on the sea (decision 0215, Phase 5 part 4): fishing boats near their port, coasters
 * on lanes between two ports, rare visitors from the far seas. They sail by the same model as the
 * player (`stepBoat`: the polar, the no-go zone, the rudder), in the wind where they are (zones,
 * island shelter, currents), and tack up a lane when the next mark lies upwind. They never ram: a
 * touch is a soft bump with no damage either way. Only the nearest few sail at once, as many as
 * the quality level allows (`seamanship.json` › `traffic.atOnce`); the rest wait out of sight.
 * Not saved: a voyage loaded again puts them back from the map's seed.
 */
const tuning = () => TUNING.seamanship.traffic;

export const TRAFFIC_KINDS = ['fishing', 'coaster', 'visitor'] as const;
export type TrafficKind = (typeof TRAFFIC_KINDS)[number];

/**
 * One fleet in a map or sea file's `traffic` list: one boat per name, all from one home port.
 * A fishing fleet sails from its harbour along `path` to its `grounds` and works them; a coaster
 * or visitor sails a lane from its home harbour along `path` to the harbour of `to`, and back.
 * Its `tags` (`after:`, `before:`, `during:`, `except:`) show and hide it like a sea mark's.
 */
export interface TrafficDef {
  id: string;
  kind: TrafficKind;
  /** Port id the boats belong to: they start and end their trips at its harbour. */
  home: string;
  /** The port at the lane's other end (coasters and visitors). */
  to?: string;
  /** The boats' names, one boat each (words of the story; not translated). */
  names: string[];
  /** Marks between the harbours, in order from home (open water; checked by `npm run check`). */
  path?: [number, number][];
  /** A fishing fleet's grounds: centre x, y and radius. */
  grounds?: [number, number, number];
  /** A visitor's ship class: its model and sailing (fluyt, indiaman, schooner…). */
  ship?: string;
  /** A visitor's livery: the sea it comes from (north, south, west, east). */
  livery?: string;
  tags?: string[];
}

type Point = { x: number; y: number };

export interface TrafficBoat {
  fleet: TrafficDef;
  name: string;
  /** Index into the map's `traffic` list and into the fleet's names. */
  fleetIndex: number;
  index: number;
  ship: ShipClass;
  boat: BoatState;
  /** Marks of the trip under way; `leg` is the next one. */
  route: Point[];
  leg: number;
  /** Where the leg began, for the tacking lane. */
  legFrom: Point;
  /** Out on the lane (true) or coming home. Fishing: out to the grounds. */
  outbound: boolean;
  /** Casts left on the grounds before heading home (fishing). */
  casts: number;
  /** Lying at a harbour with the sails down until this time. */
  waitUntil: number;
  /** The tack while beating: 1 = heading to the right of the wind, −1 to the left, 0 not beating. */
  tack: number;
  lastTack: number;
  /** The wind where she is, refreshed a few times a second. */
  wind: Wind;
  windAt: number;
  /** Closest she has come to the next mark, and when: a boat that stops gaining skips the mark. */
  best: number;
  bestAt: number;
  /** Whether `best` is the way by water (the mark's grid) or in a straight line. */
  byWater: boolean;
  /** Marks skipped because she could not get there (the checks want none). */
  stuck: number;
  /** Round trips finished: back in her home harbour (the checks count them). */
  trips: number;
  /** Sailing now; asleep, she waits where she is, unseen. */
  awake: boolean;
  /** Under sweeps by a harbour, sails down: where the wind would pin her to the quay. */
  sweeps: boolean;
  rng: Rng;
  /**
   * A race's rival (decision 0217): she sails the course and stops at the finish, never rows and
   * never gives way. `gunAt` the horn's time (null before it), `finishedAt` hers, `arrive` how
   * close she rounds a mark, `over` once the captain's race has ended.
   */
  racer?: {
    gunAt: number | null;
    finishedAt: number | null;
    arrive: number;
    over: boolean;
    /** The finish line: crossing it anywhere on the last leg finishes her. */
    finish?: [Point, Point];
  };
}

export interface TrafficState {
  boats: TrafficBoat[];
  /** How many may sail at once (the quality level's `atOnce`); the game sets it. */
  cap: number;
  /** Settings › Other ships. */
  on: boolean;
  /** Wake the nearest at once, wherever they are (a new voyage, a jump, the switch back on). */
  fresh: boolean;
  nextPick: number;
  /** Where the player was on the last step, to notice a jump. */
  last: Point | null;
}

/** The harbour mark of a port: its course buoy (the island's name), else off its coast. */
export function harbourPoint(map: MapDef, portId: string): Point | null {
  const port = map.ports.find((p) => p.id === portId);
  const island = port && map.islands.find((i) => i.id === port.islandId);
  if (!port || !island) return null;
  const wp = map.course.find((w) => w.label === island.name || w.label === port.name);
  if (wp) return { x: wp.x, y: wp.y };
  const b = island.look?.harbourBearing ?? 0;
  const v = bearingVector(b);
  return { x: island.x + v.x * (island.radius + 25), y: island.y + v.y * (island.radius + 25) };
}

/** The sailing class of a fleet's boats: the kind's base class, slower and smaller as tuned. */
export function trafficShip(fleet: TrafficDef): ShipClass {
  const kind = tuning().kinds[fleet.kind];
  const base = TUNING.ships[fleet.ship ?? kind.ship] ?? TUNING.ships.sloop!;
  // Her crew knows the boat: she turns smartly and carries her way through a tack.
  return {
    ...base,
    speedRatio: base.speedRatio * kind.speed,
    radius: base.radius * kind.scale,
    turnRateDeg: base.turnRateDeg * tuning().crewTurn,
    ironsDecel: base.decel,
  };
}

/**
 * The marks of a lane, harbour to harbour (or harbour to grounds), in order from home. A harbour
 * buoy too close to a reef or the shore for her hull moves out to the nearest open water.
 */
export function laneOf(map: MapDef, fleet: TrafficDef): Point[] {
  let byFleet = lanes.get(map);
  if (!byFleet) lanes.set(map, (byFleet = new WeakMap()));
  const known = byFleet.get(fleet);
  if (known) return known;
  const ship = trafficShip(fleet);
  const open = (p: Point | null) => p && openWater(map, p, ship.radius + 10, ship.draft);
  const pts: Point[] = [];
  const home = open(harbourPoint(map, fleet.home));
  if (home) pts.push(home);
  for (const [x, y] of fleet.path ?? []) pts.push({ x, y });
  if (fleet.kind === 'fishing') {
    if (fleet.grounds) pts.push({ x: fleet.grounds[0], y: fleet.grounds[1] });
  } else {
    const to = fleet.to ? open(harbourPoint(map, fleet.to)) : null;
    if (to) pts.push(to);
  }
  byFleet.set(fleet, pts);
  return pts;
}
const lanes = new WeakMap<MapDef, WeakMap<TrafficDef, Point[]>>();

/** The nearest point to `p` where a hull of radius `r` floats clear, every quest's land standing. */
function openWater(map: MapDef, p: Point, r: number, draft: number): Point {
  const land = { islands: map.islands, terrain: map.terrain ?? [] };
  if (!blockedAt(map, land, p.x, p.y, r, draft)) return p;
  for (let d = 4; d <= 60; d += 4)
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const x = Math.round(p.x + Math.sin(a) * d);
      const y = Math.round(p.y + Math.cos(a) * d);
      if (!blockedAt(map, land, x, y, r, draft)) return { x, y };
    }
  return p;
}

/** A scratch hull for asking whether water is open. */
const probe = createBoat(0, 0, 0);

/** True when a hull of radius `r` at (x, y) would touch land, a reef, a pier or the sea's edge. */
export function blockedAt(
  map: MapDef,
  land: Pick<World['land'], 'islands' | 'terrain'>,
  x: number,
  y: number,
  r: number,
  draft = 0,
  piers: Pier[] = [],
): boolean {
  probe.x = x;
  probe.y = y;
  probe.speedKn = 0;
  return (
    resolveCollisions(probe, r, land.islands, seaShape(map), land.terrain, piers, draft) !== null
  );
}

/** A point on a fishing fleet's grounds in open water (a few tries; the centre at worst). */
function castPoint(map: MapDef, land: World['land'], b: TrafficBoat): Point {
  const [cx, cy, r] = b.fleet.grounds ?? [b.boat.x, b.boat.y, 0];
  for (let i = 0; i < 8; i++) {
    const a = b.rng() * Math.PI * 2;
    const d = Math.sqrt(b.rng()) * r;
    const x = cx + Math.sin(a) * d;
    const y = cy + Math.cos(a) * d;
    if (!blockedAt(map, land, x, y, b.ship.radius * 2.5, b.ship.draft)) return { x, y };
  }
  return { x: cx, y: cy };
}

/** Starts the next trip from where she is: out along the lane or home again. */
function nextTrip(map: MapDef, land: World['land'], b: TrafficBoat, time: number) {
  const lane = laneOf(map, b.fleet);
  const t = tuning();
  if (b.fleet.kind === 'fishing') {
    if (b.outbound && b.casts > 0) {
      b.casts--;
      b.route = [castPoint(map, land, b)];
    } else if (b.outbound) {
      b.outbound = false;
      b.route = lane.slice(0, -1).reverse();
    } else {
      b.outbound = true;
      b.trips++;
      b.waitUntil = time + range(b.rng, t.dwellSec[0]!, t.dwellSec[1]!);
      b.casts = Math.round(range(b.rng, t.castsPerTrip[0]!, t.castsPerTrip[1]!));
      b.route = lane.slice(1);
    }
  } else {
    b.outbound = !b.outbound;
    if (b.outbound) b.trips++;
    b.waitUntil = time + range(b.rng, t.dwellSec[0]!, t.dwellSec[1]!);
    b.route = b.outbound ? lane.slice(1) : lane.slice(0, -1).reverse();
  }
  startLeg(b, 0, time);
}

function startLeg(b: TrafficBoat, leg: number, time: number) {
  b.leg = leg;
  b.legFrom = { x: b.boat.x, y: b.boat.y };
  b.best = Infinity;
  b.bestAt = Math.max(time, b.waitUntil);
  b.tack = 0;
}

/** Every boat of the map's fleets, placed along their lanes from the map's seed. */
export function createTraffic(map: MapDef, land: World['land']): TrafficState {
  const boats: TrafficBoat[] = [];
  (map.traffic ?? []).forEach((fleet, fleetIndex) => {
    const lane = laneOf(map, fleet);
    if (lane.length < 2) return;
    const ship = trafficShip(fleet);
    fleet.names.forEach((name, index) => {
      const rng = createRng(
        (map.seed ^ Math.imul(fleetIndex + 1, 0x9e3779b1) ^ (index * 7919)) >>> 0,
      );
      // Somewhere along the lane, heading on, or lying at one end.
      const seg = Math.floor(rng() * (lane.length - 1));
      const k = rng();
      const a = lane[seg]!;
      const z = lane[seg + 1]!;
      const outbound = rng() < 0.5;
      const from = outbound ? a : z;
      const to = outbound ? z : a;
      const x = a.x + (z.x - a.x) * k;
      const y = a.y + (z.y - a.y) * k;
      const b: TrafficBoat = {
        fleet,
        name,
        fleetIndex,
        index,
        ship,
        boat: createBoat(x, y, bearingTo(from, to)),
        route: [],
        leg: 0,
        legFrom: { x, y },
        outbound,
        casts: 0,
        waitUntil: 0,
        tack: 0,
        lastTack: -Infinity,
        wind: { from: 0, speedKn: 0 },
        windAt: -Infinity,
        best: Infinity,
        bestAt: 0,
        stuck: 0,
        trips: 0,
        awake: false,
        sweeps: false,
        byWater: false,
        rng,
      };
      b.boat.sail = 1;
      if (fleet.kind === 'fishing' && outbound && fleet.grounds && seg === lane.length - 2) {
        // Already on the grounds, working them.
        const p = castPoint(map, land, b);
        b.boat.x = p.x;
        b.boat.y = p.y;
        b.casts = Math.round(range(rng, 1, tuning().castsPerTrip[1]!));
        b.route = [castPoint(map, land, b)];
      } else {
        b.route = outbound ? lane.slice(seg + 1) : lane.slice(0, seg + 1).reverse();
        const casts = tuning().castsPerTrip;
        if (fleet.kind === 'fishing') b.casts = Math.round(range(rng, casts[0]!, casts[1]!));
      }
      startLeg(b, 0, 0);
      boats.push(b);
    });
  });
  return { boats, cap: tuning().atOnce.medium, on: true, fresh: true, nextPick: 0, last: null };
}

/** Whether a fleet sails now: its tags, its ports founded, and nothing during the quiet quests. */
export function fleetShown(
  fleet: TrafficDef,
  done: ReadonlySet<string>,
  running: ReadonlySet<string>,
  levels: Record<string, number>,
): boolean {
  if (
    tuning()
      .quietDuring.split(/[\s,]+/)
      .some((q) => q && running.has(q))
  )
    return false;
  if (levels[fleet.home] === 0 || (fleet.to && levels[fleet.to] === 0)) return false;
  return questShown(fleet, done, running);
}

/** Wakes the nearest boats the cap allows and puts the far ones to sleep (decision 0215). */
function pick(world: World, traffic: TrafficState) {
  const t = tuning();
  const me = world.boat;
  const done = questsDone(world.trade);
  const running = questsRunning(world.trade);
  const levels = townLevels(world.map, world.trade);
  const shown = new Map<TrafficDef, boolean>();
  const isShown = (f: TrafficDef) => {
    let s = shown.get(f);
    if (s === undefined) shown.set(f, (s = fleetShown(f, done, running, levels)));
    return s;
  };
  const dist = (b: TrafficBoat) => Math.hypot(b.boat.x - me.x, b.boat.y - me.y);
  let awake = 0;
  for (const b of traffic.boats) {
    if (!b.awake) continue;
    if (!traffic.on || !isShown(b.fleet) || dist(b) > t.activeRange) b.awake = false;
    else awake++;
  }
  // A lower cap (the quality fell): the farthest go first.
  if (awake > traffic.cap) {
    const on = traffic.boats.filter((b) => b.awake).sort((a, b) => dist(b) - dist(a));
    for (const b of on.slice(0, awake - traffic.cap)) b.awake = false;
    awake = traffic.cap;
  }
  if (!traffic.on || awake >= traffic.cap) {
    traffic.fresh = false;
    return;
  }
  // Only a boat out of sight wakes, so none appears in view, unless the view itself is new.
  const candidates = traffic.boats
    .filter((b) => !b.awake && isShown(b.fleet))
    .map((b) => ({ b, d: dist(b) }))
    .filter(({ d }) => d <= t.activeRange && (traffic.fresh || d > t.hideRange))
    .sort((a, b) => a.d - b.d);
  for (const { b } of candidates.slice(0, traffic.cap - awake)) {
    b.awake = true;
    b.windAt = -Infinity;
    b.bestAt = world.time;
    b.best = Infinity;
    b.waitUntil = Math.min(b.waitUntil, world.time + t.dwellSec[1]!);
  }
  traffic.fresh = false;
}

/** The wind where a boat is: the sea's (or a pinned quest wind), less the shelter of islands. */
function windFor(world: World, b: TrafficBoat): Wind {
  if (world.time - b.windAt < 0.3) return b.wind;
  b.windAt = world.time;
  const sea =
    world.calmWind ??
    (world.windConfig
      ? windAt(world.windConfig, world.time, world.map.seed, b.boat)
      : world.seaWind);
  b.wind = localWind(sea, windEffectAt(world.windBlockers, b.boat, sea));
  return b.wind;
}

/**
 * How far a lane mark is by water in this wind (decision 0215): a grid round the fleet's lane,
 * each cell the time to the mark round land, reefs and the sea's edge for her hull, counted in
 * units sailed at her best speed, 0 at the mark. Upwind a stretch costs what beating up it does,
 * so the grid knows that going round an island off the wind can beat a tack up a channel. Made
 * when a boat first sails for that mark in a wind (to 15°), and the last few kept.
 */
interface MarkField {
  x0: number;
  y0: number;
  cols: number;
  rows: number;
  d: Float32Array;
}
/** Which cells of a fleet's grid are open water for her hull. */
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
}
const FIELD_CELL = 8;
/** Wind directions a field is made for: every 15°. */
const WIND_STEP = 15 * DEG;
/** Fields kept per fleet: her marks in the last few winds. */
const FIELDS_KEPT = 24;
const grids = new WeakMap<TrafficDef, OpenGrid>();
const fields = new WeakMap<TrafficDef, Map<string, MarkField>>();

function openGrid(world: World, b: TrafficBoat): OpenGrid {
  const scale = world.currentsOn ? knobs(world.trade.difficulty).currents : 0;
  const known = grids.get(b.fleet);
  if (known && known.version === world.land.version && known.currents === scale) return known;
  // The lane's box and room round it to go about in.
  const lane = laneOf(world.map, b.fleet);
  const pad = tuning().fieldPad;
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
  const open = new Uint8Array(cols * rows);
  const r = b.ship.radius + 2;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++)
      open[i * rows + j] = blockedAt(
        world.map,
        world.land,
        x0 + i * FIELD_CELL,
        y0 + j * FIELD_CELL,
        r,
        b.ship.draft,
        world.piers,
      )
        ? 0
        : 1;
  const east = new Float32Array(cols * rows);
  const north = new Float32Array(cols * rows);
  if (scale > 0)
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        if (!open[i * rows + j]) continue;
        const water = world.currents.at(x0 + i * FIELD_CELL, y0 + j * FIELD_CELL, scale, flow);
        east[i * rows + j] = water.east;
        north[i * rows + j] = water.north;
      }
  const grid = {
    x0,
    y0,
    cols,
    rows,
    open,
    version: world.land.version,
    east,
    north,
    currents: scale,
  };
  grids.set(b.fleet, grid);
  return grid;
}

/** Her speed toward a bearing `rel` off the wind, beating if she must, as a share of her best. */
function madeGood(ship: ShipClass, rel: number, best: number): number {
  const wind = { from: 0, speedKn: 14 };
  const noGo = noGoAngle(ship) + tuning().beatMarginDeg * DEG;
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

export function markField(world: World, b: TrafficBoat, mark: Point, wind: Wind): MarkField {
  let byMark = fields.get(b.fleet);
  if (!byMark) fields.set(b.fleet, (byMark = new Map()));
  const step = ((Math.round(wind.from / WIND_STEP) % 24) + 24) % 24;
  const grid = openGrid(world, b);
  const key = `${mark.x},${mark.y}:${world.land.version}:${step}:${grid.currents}`;
  const known = byMark.get(key);
  if (known) {
    // The most recent last, so the oldest goes first.
    byMark.delete(key);
    byMark.set(key, known);
    return known;
  }
  const { x0, y0, cols, rows, open: water, east, north } = grid;
  const open = water.slice();
  const n = cols * rows;
  const d = new Float32Array(n).fill(Infinity);
  // The cost of one step to each of the eight neighbours, sailed toward this cell.
  const from = step * WIND_STEP;
  const best = bestSpeed(b.ship);
  // Her speed made good each of the eight ways, knots: from the neighbour (i + di, j + dj) to
  // here she sails toward −di east, −dj north. The current there helps or hinders.
  const share: number[] = [];
  for (let di = -1; di <= 1; di++)
    for (let dj = -1; dj <= 1; dj++)
      share.push(di || dj ? best * madeGood(b.ship, Math.atan2(-di, -dj) - from, best) : 0);
  const cost = (next: number, di: number, dj: number) => {
    const len = di && dj ? Math.SQRT2 : 1;
    const along = (-di * east[next]! - dj * north[next]!) / len;
    const kn = share[(di + 1) * 3 + dj + 1]! + along;
    return (len * FIELD_CELL * best) / Math.max(best * 0.05, kn);
  };
  // Dijkstra from the cells round the mark, eight ways, on a heap of (time, cell).
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
  const field = { x0, y0, cols, rows, d };
  byMark.set(key, field);
  if (byMark.size > FIELDS_KEPT) byMark.delete(byMark.keys().next().value!);
  return field;
}

/** The distance by water at a point, smoothed between cells; Infinity by land or off the grid. */
export function fieldAt(f: MarkField, x: number, y: number): number {
  const u = (x - f.x0) / FIELD_CELL;
  const v = (y - f.y0) / FIELD_CELL;
  const i = Math.floor(u);
  const j = Math.floor(v);
  if (i < 0 || j < 0 || i + 1 >= f.cols || j + 1 >= f.rows) return Infinity;
  const fu = u - i;
  const fv = v - j;
  const a = f.d[i * f.rows + j]!;
  const b = f.d[(i + 1) * f.rows + j]!;
  const c = f.d[i * f.rows + j + 1]!;
  const e = f.d[(i + 1) * f.rows + j + 1]!;
  // By a shore some corners are land: the water ones count, and the land's share costs a cell,
  // so a narrow passage (a cell or two wide) still leads somewhere.
  let sum = 0;
  let weight = 0;
  let dry = 0;
  for (const [value, w] of [
    [a, (1 - fu) * (1 - fv)],
    [b, fu * (1 - fv)],
    [c, (1 - fu) * fv],
    [e, fu * fv],
  ] as const) {
    if (value === Infinity) dry += w;
    else {
      sum += value * w;
      weight += w;
    }
  }
  if (dry > 0.75 || weight === 0) return Infinity;
  return sum / weight + dry * FIELD_CELL * 2;
}

/** Headings the helm weighs: every 10°, and both close-hauled courses. */
const HEADINGS = Array.from({ length: 36 }, (_, k) => (k * 10 * Math.PI) / 180);

/**
 * The helm of one boat (decision 0215): of the headings she can sail (none inside the no-go
 * zone), the one whose point a little ahead lies nearest the mark by water. Upwind that is one of
 * the close-hauled courses; she stays on her tack until the other one gains clearly and she has
 * held this one a while, so she beats up a lane in long boards that shorten near the mark, and
 * goes round land without being told. She eases her sails coming in and when she must give way.
 */
/** A lane mark is reached by water; a cast on the open grounds in a straight line. */
const onLane = (b: TrafficBoat) =>
  !(b.fleet.kind === 'fishing' && b.outbound && b.route.length === 1);

export function pilot(world: World, b: TrafficBoat, wind: Wind): BoatControls {
  const t = tuning();
  const { boat } = b;
  if (world.time < b.waitUntil) return { steer: 0, sailStep: 0 };
  const target = b.route[b.leg];
  if (!target) return { steer: 0, sailStep: 0 };
  const noGo = noGoAngle(b.ship) + t.beatMarginDeg * DEG;
  const left = Math.hypot(target.x - boat.x, target.y - boat.y);
  const field = onLane(b) ? markField(world, b, target, wind) : null;
  // By a harbour, slow, she takes to the sweeps (the long oars) and rows clear of the quays.
  const lane = laneOf(world.map, b.fleet);
  const ends = b.fleet.kind === 'fishing' ? [lane[0]!] : [lane[0]!, lane[lane.length - 1]!];
  // Pinned on a lee shore anywhere, she rows off it the same way; a racer only then (her course's
  // ends are marks at sea, not quays).
  b.sweeps =
    boat.speedKn < t.sweepKn * 1.5 &&
    (boat.sinceBump < 2 ||
      (!b.racer && ends.some((p) => Math.hypot(p.x - boat.x, p.y - boat.y) < t.sweepRange)));
  if (b.sweeps) {
    let best = Infinity;
    let want = bearingTo(boat, target);
    const look = Math.min(t.lookUnits / 2, left);
    for (const h of HEADINGS) {
      const v = bearingVector(h);
      const x = boat.x + v.x * look;
      const y = boat.y + v.y * look;
      const d =
        (field ? fieldAt(field, x, y) : Math.hypot(target.x - x, target.y - y)) +
        t.turnCost * Math.abs(wrapAngle(h - boat.heading));
      if (d < best) {
        best = d;
        want = h;
      }
    }
    b.tack = 0;
    return { steer: clamp(wrapAngle(want - boat.heading) * 2.5, -1, 1), sailStep: 0 };
  }
  let fastest = 0;
  for (const h of HEADINGS) fastest = Math.max(fastest, targetSpeed(b.ship, h, wind, 1));
  const score = (h: number) => {
    // Where each heading takes her in the same time: less far on the slower ones.
    const look = Math.min(t.lookUnits, left) * (targetSpeed(b.ship, h, wind, 1) / (fastest || 1));
    const v = bearingVector(h);
    const x = boat.x + v.x * look;
    const y = boat.y + v.y * look;
    return field ? fieldAt(field, x, y) : Math.hypot(target.x - x, target.y - y);
  };
  const since = world.time - b.lastTack;
  // The side the wind is on (her tack): changing it with her bow through the wind is a tack.
  const relNow = wrapAngle(boat.heading - wind.from);
  b.tack ||= relNow >= 0 ? 1 : -1;
  // Land ahead on her own tack: she goes about at once, whatever it gains.
  const blocked = score(wind.from + b.tack * noGo) === Infinity;
  let best = Infinity;
  let want = bearingTo(boat, target);
  for (const h of [...HEADINGS, wind.from + noGo, wind.from - noGo]) {
    const rel = wrapAngle(h - wind.from);
    if (Math.abs(rel) < noGo - 1e-6) continue;
    let v = score(h);
    // Changing tack must gain clearly, and not too soon after the last change: through the wind,
    // or round by a gybe unless she is running anyway.
    // Her tack is the side she last chose: mid-tack her bow is not there yet.
    if (Math.sign(rel) !== b.tack) {
      const tack = Math.abs(rel) + Math.abs(relNow) < Math.PI;
      if (!blocked && (tack || Math.abs(relNow) < (3 * Math.PI) / 4)) {
        if (since < t.minTackSec) continue;
        v += t.tackGain;
      }
      // Round the other way would take her through the wind's eye and back: not a gybe.
      if (!tack && blocked) continue;
    }
    // A big turn costs way: the helm prefers what is near her bow.
    v += t.turnCost * Math.abs(wrapAngle(h - boat.heading));
    if (v < best) {
      best = v;
      want = h;
    }
  }
  // Nothing ahead in open water she knows (off her lane's grid, or hard by a shore): she sails
  // the heading nearest the mark that she can, and the grid takes over again.
  if (best === Infinity) {
    const direct = bearingTo(boat, target);
    const r = wrapAngle(direct - wind.from);
    want = Math.abs(r) >= noGo ? direct : wind.from + (r >= 0 ? 1 : -1) * noGo;
  }
  const rel = wrapAngle(want - wind.from);
  const side = rel >= 0 ? 1 : -1;
  if (side !== b.tack) {
    b.lastTack = world.time;
    b.tack = side;
  }
  const closeHauled = Math.abs(rel) < noGo + 5 * DEG;
  // Fresh out of a tack she bears away a little to build speed before she points high again.
  if (closeHauled && boat.speedKn < 0.6 * targetSpeed(b.ship, want, wind, boat.sail))
    want += side * t.buildDeg * DEG;
  let sailStep = 2;
  const last = b.leg === b.route.length - 1;
  // Coming in off the wind she shortens sail; beating in, she needs it all.
  if (last && left < t.arriveRange * 3 && !closeHauled) sailStep = 1;
  if (wind.speedKn > t.reefKn) sailStep = 1;
  // Give way: the player close ahead, she eases her sails and bears away from her.
  const me = world.boat;
  const pd = Math.hypot(me.x - boat.x, me.y - boat.y);
  if (pd < t.giveWayRange && !b.racer) {
    const toMe = wrapAngle(bearingTo(boat, me) - boat.heading);
    if (Math.abs(toMe) < 70 * DEG) {
      sailStep = 1;
      const away = boat.heading - Math.sign(toMe || 1) * 40 * DEG;
      if (Math.abs(wrapAngle(away - wind.from)) >= noGo) want = away;
    }
  }
  // A racer (decision 0217) goes round the captain and the other boats: the nearest one close
  // ahead, she bears away from it, keeping her sails full.
  if (b.racer) {
    let near: { x: number; y: number } | null = null;
    let nd: number = t.giveWayRange;
    const others = [
      me,
      ...world.traffic.boats.filter((o) => o.awake && o !== b).map((o) => o.boat),
    ];
    for (const o of others) {
      const d = Math.hypot(o.x - boat.x, o.y - boat.y);
      if (d < nd && Math.abs(wrapAngle(bearingTo(boat, o) - boat.heading)) < 70 * DEG) {
        near = o;
        nd = d;
      }
    }
    if (near) {
      const toIt = wrapAngle(bearingTo(boat, near) - boat.heading);
      const away = boat.heading - Math.sign(toIt || 1) * 40 * DEG;
      if (Math.abs(wrapAngle(away - wind.from)) >= noGo) want = away;
    }
  }
  return { steer: clamp(wrapAngle(want - boat.heading) * 2.5, -1, 1), sailStep };
}

/** One boat's step: helm, sails, current, land; a new mark when she gets there. */
function stepOne(world: World, b: TrafficBoat, dt: number) {
  const t = tuning();
  const wind = windFor(world, b);
  const controls = pilot(world, b, wind);
  const { boat } = b;
  const was = { x: boat.x, y: boat.y };
  stepBoat(boat, controls, b.ship, wind, dt);
  if (b.sweeps && world.time >= b.waitUntil) {
    // Rowing: a steady way through the water, wind or none, and the hull held to her course.
    boat.speedKn = Math.max(boat.speedKn, t.sweepKn);
    boat.drift.x = boat.drift.y = 0;
  }
  if (world.time < b.waitUntil) {
    // Lines ashore: she lies still at the harbour.
    boat.speedKn *= Math.exp(-2 * dt);
    boat.drift.x = boat.drift.y = 0;
  } else if (world.currentsOn) {
    const water = world.currents.at(boat.x, boat.y, knobs(world.trade.difficulty).currents, flow);
    const k = knotToUnits() * dt;
    boat.x += water.east * k;
    boat.y += water.north * k;
  }
  resolveCollisions(
    boat,
    b.ship.radius,
    world.land.islands,
    seaShape(world.map),
    world.land.terrain,
    world.piers,
    b.ship.draft,
  );
  const target = b.route[b.leg];
  if (!target || world.time < b.waitUntil) return;
  const d = Math.hypot(target.x - boat.x, target.y - boat.y);
  // Her progress is the way left by water: the long way round an island is still progress.
  const field = onLane(b) ? markField(world, b, target, b.wind) : null;
  const togo = field ? fieldAt(field, boat.x, boat.y) : Infinity;
  const progress = togo < Infinity ? togo : d;
  // Measured the other way since the last gain (on or off the grid): a fresh start.
  if (togo < Infinity !== b.byWater) {
    b.byWater = togo < Infinity;
    b.best = Infinity;
  }
  if (progress < b.best - 4) {
    b.best = progress;
    b.bestAt = world.time;
  }
  const stuck = world.time - b.bestAt > t.stuckSec;
  if (stuck) b.stuck++;
  const line = b.leg === b.route.length - 1 ? b.racer?.finish : undefined;
  const over = !!line && crossesGate(line, was, boat);
  if (d < (b.racer?.arrive ?? t.arriveRange) || stuck || over) {
    if (b.leg + 1 < b.route.length) startLeg(b, b.leg + 1, world.time);
    else if (b.racer && line && b.racer.finishedAt === null) {
      // Over the finish line: she sails on clear of it, square to the line, then lies there.
      b.racer.finishedAt = world.time;
      const [p, q] = line;
      const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      let nx = (q.y - p.y) / len;
      let ny = -(q.x - p.x) / len;
      if (nx * (boat.x - was.x) + ny * (boat.y - was.y) < 0) [nx, ny] = [-nx, -ny];
      const run = REGATTA.rival.runOut;
      b.route = [{ x: boat.x + nx * run, y: boat.y + ny * run }];
      startLeg(b, 0, world.time);
    } else if (b.racer) {
      // Clear of the line (or her course given up): she lies there with her sails down.
      b.racer.finishedAt ??= world.time;
      b.waitUntil = Infinity;
      b.route = [];
    } else nextTrip(world.map, world.land, b, world.time);
  }
}
const flow = { east: 0, north: 0, id: '' };

/**
 * The soft bump (decision 0215): a boat and the player that touch are pushed apart, the other boat
 * most, and the player loses a little way. No damage either way; the toast says "bump".
 */
/**
 * How far a hull reaches toward a bearing: an oval, its collision radius along the keel and
 * `abeam` of it across (a round circle stood far out from her sides, Guillaume's play-test).
 */
function hullReach(radius: number, heading: number, toward: number): number {
  const a = radius;
  const b = radius * tuning().abeam;
  const off = toward - heading;
  return (a * b) / Math.hypot(b * Math.cos(off), a * Math.sin(off));
}

/** The distance two hulls touch at, along the line between them. */
function touchReach(
  p: { x: number; y: number; heading: number },
  pr: number,
  q: { x: number; y: number; heading: number },
  qr: number,
): number {
  const toQ = Math.atan2(q.x - p.x, q.y - p.y);
  return (hullReach(pr, p.heading, toQ) + hullReach(qr, q.heading, toQ)) * tuning().touch;
}

function bumpPlayer(world: World, b: TrafficBoat): WorldEvent | null {
  // A racer (decision 0217) is pushed half the way and loses way too: a touch costs both boats.
  const share = b.racer ? 0.5 : 0.7;
  const me = world.boat;
  const reach = touchReach(world.boat, world.ship.radius, b.boat, b.ship.radius);
  const dx = b.boat.x - me.x;
  const dy = b.boat.y - me.y;
  const d = Math.hypot(dx, dy);
  if (d >= reach) return null;
  const nx = d > 1e-6 ? dx / d : 1;
  const ny = d > 1e-6 ? dy / d : 0;
  const over = reach - d;
  b.boat.x += nx * over * share;
  b.boat.y += ny * over * share;
  me.x -= nx * over * (1 - share);
  me.y -= ny * over * (1 - share);
  const into = Math.sin(me.heading) * nx + Math.cos(me.heading) * ny;
  if (into > 0) me.speedKn *= 1 - 0.5 * into;
  if (b.racer) {
    const hers = -(Math.sin(b.boat.heading) * nx + Math.cos(b.boat.heading) * ny);
    if (hers > 0) b.boat.speedKn *= 1 - 0.5 * hers;
  }
  if (me.sinceBump < 0.5) return null;
  me.sinceBump = 0;
  return { type: 'bump' };
}

/** Keeps two boats of the traffic from overlapping: each pushed half the way. */
function separate(a: TrafficBoat, b: TrafficBoat) {
  const reach = touchReach(a.boat, a.ship.radius, b.boat, b.ship.radius);
  const dx = b.boat.x - a.boat.x;
  const dy = b.boat.y - a.boat.y;
  const d = Math.hypot(dx, dy);
  if (d >= reach || d < 1e-6) return;
  const k = (reach - d) / d / 2;
  a.boat.x -= dx * k;
  a.boat.y -= dy * k;
  b.boat.x += dx * k;
  b.boat.y += dy * k;
}

/** Steps the boats that sail now, after the player's step (decision 0215). */
export function stepTraffic(world: World, dt: number): WorldEvent[] {
  const traffic = world.traffic;
  const me = world.boat;
  // A jump (a quest, the screenshot tool, a load): wake whoever is near the new place at once.
  if (traffic.last && Math.hypot(me.x - traffic.last.x, me.y - traffic.last.y) > 60)
    traffic.fresh = true;
  traffic.last = { x: me.x, y: me.y };
  if (traffic.fresh || world.time >= traffic.nextPick) {
    traffic.nextPick = world.time + 0.5;
    pick(world, traffic);
  }
  const events: WorldEvent[] = [];
  const awake = traffic.boats.filter((b) => b.awake);
  for (const b of awake) {
    stepOne(world, b, dt);
    const e = bumpPlayer(world, b);
    if (e) events.push(e);
  }
  for (let i = 0; i < awake.length; i++)
    for (let j = i + 1; j < awake.length; j++) separate(awake[i]!, awake[j]!);
  return events;
}

/**
 * The race's rival (decision 0217), after the player: she waits at the line until the horn, sails
 * the course, and once the captain's race has ended she goes when she is done or out of sight.
 */
export function stepRival(world: World, dt: number): WorldEvent[] {
  const b = world.rival;
  if (!b?.racer) return [];
  const far = Math.hypot(b.boat.x - world.boat.x, b.boat.y - world.boat.y) > tuning().activeRange;
  if (b.racer.over && (b.racer.finishedAt !== null || far)) {
    world.rival = null;
    return [];
  }
  stepOne(world, b, dt);
  // She touches the other boats as the captain does, never sailing through them.
  for (const o of world.traffic.boats) if (o.awake) separate(b, o);
  const e = bumpPlayer(world, b);
  return e ? [e] : [];
}

/** Sails one boat alone for `seconds` (the checks and tests), with the world's wind. */
export function sailAlone(world: World, b: TrafficBoat, seconds: number, dt = 0.1) {
  const end = world.time + seconds;
  while (world.time < end) {
    world.time += dt;
    stepOne(world, b, dt);
  }
}
