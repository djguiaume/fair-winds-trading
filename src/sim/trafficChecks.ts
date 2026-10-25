import { TUNING } from '../data/tuning';
import type { MapCheck } from './mapChecks';
import type { MapDef } from './map';
import { landOut, landWith } from './questLand';
import { sailRoute } from './mapChecks';
import { SLOOP } from './ship';
import {
  TRAFFIC_KINDS,
  type TrafficDef,
  blockedAt,
  createTraffic,
  harbourPoint,
  laneOf,
  sailAlone,
  trafficShip,
} from './traffic';
import { createWorld } from './world';
import { DEG } from './math';

/*
 * The checks on the map's other boats (decision 0215), run by `npm run check`, the sea editor and
 * the tests: every fleet's ports, names and class exist, its lane runs in open water with room to
 * tack, and (the slow part, with the route checks) one of its boats sails the lane out and home
 * in winds from every quarter without giving up a mark.
 */

const ok = (id: string, message: string): MapCheck => ({
  id,
  ok: true,
  severity: 'error',
  message,
});
const bad = (id: string, message: string, severity: MapCheck['severity'] = 'error'): MapCheck => ({
  id,
  ok: false,
  severity,
  message,
});

/** Spacing of the points tested along a lane, units. */
const SAMPLE = 4;

/**
 * The land a fleet sails among (decision 0166's quest land): a fleet that waits on a quest sails
 * once every quest has moved its land; any other sails from the start to the end, so all the land
 * that ever stands is in its way.
 */
export function fleetLand(map: MapDef, fleet: TrafficDef) {
  if (!fleet.tags?.some((t) => t.startsWith('after:'))) return landWith(map, new Set());
  const quests = new Set(
    [...map.islands, ...(map.terrain ?? [])].flatMap((f) =>
      (f.tags ?? []).map((t) => t.slice(t.indexOf(':') + 1)),
    ),
  );
  return landWith(map, landOut(map, quests));
}

/** Where a lane runs too close to land, reef or the sea's edge (the first point), or null. */
export function laneBlocked(map: MapDef, fleet: TrafficDef): { x: number; y: number } | null {
  const land = fleetLand(map, fleet);
  const ship = trafficShip(fleet);
  const lane = laneOf(map, fleet);
  // Room for the hull and a little to spare; the harbour marks themselves sit by the shore.
  const r = ship.radius + 2;
  for (let i = 0; i + 1 < lane.length; i++) {
    const a = lane[i]!;
    const b = lane[i + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / SAMPLE));
    for (let k = 0; k <= n; k++) {
      const x = a.x + ((b.x - a.x) * k) / n;
      const y = a.y + ((b.y - a.y) * k) / n;
      if (blockedAt(map, land, x, y, r, ship.draft)) return { x: Math.round(x), y: Math.round(y) };
    }
  }
  return null;
}

/** The data checks, quick enough for every edit: ids, ports, names, classes, open water. */
export function trafficQuickChecks(map: MapDef): MapCheck[] {
  const fleets = map.traffic ?? [];
  if (!fleets.length) return [];
  const problems: string[] = [];
  const ids = fleets.map((f) => f.id);
  for (const id of ids.filter((id, k) => ids.indexOf(id) !== k))
    problems.push(`two fleets "${id}"`);
  const names = fleets.flatMap((f) => f.names);
  for (const n of names.filter((n, k) => names.indexOf(n) !== k))
    problems.push(`two boats named "${n}"`);
  for (const f of fleets) {
    const at = `fleet ${f.id}`;
    if (!TRAFFIC_KINDS.includes(f.kind)) problems.push(`${at}: unknown kind "${f.kind}"`);
    if (!f.names?.length) problems.push(`${at}: no boat names`);
    if (!map.ports.some((p) => p.id === f.home)) problems.push(`${at}: no home port "${f.home}"`);
    else if (!harbourPoint(map, f.home)) problems.push(`${at}: home port has no harbour`);
    if (f.kind === 'fishing') {
      if (!f.grounds) problems.push(`${at}: a fishing fleet needs grounds`);
    } else if (!f.to || !map.ports.some((p) => p.id === f.to))
      problems.push(`${at}: no port "${f.to ?? ''}" at the lane's other end`);
    const ship = f.ship ?? TUNING.seamanship.traffic.kinds[f.kind]?.ship;
    if (ship && !TUNING.ships[ship]) problems.push(`${at}: unknown ship class "${ship}"`);
    if (problems.length) continue;
    const blocked = laneBlocked(map, f);
    if (blocked)
      problems.push(`${at}: the lane runs onto land or a reef at ${blocked.x},${blocked.y}`);
  }
  return [
    problems.length
      ? bad('traffic', problems.slice(0, 4).join('; ') + (problems.length > 4 ? '…' : ''))
      : ok('traffic', `${fleets.length} fleets, ${names.length} boats`),
  ];
}

/** Winds a lane is sailed in by the slow check: from the four quarters. */
const CHECK_WINDS = [0, 90, 180, 270];

/**
 * Sails one boat of each fleet out along its lane and home again in each check wind, alone, with
 * the currents on: a boat that gives up a mark, or is not home in time, fails the fleet.
 */
export function trafficSailChecks(map: MapDef): MapCheck[] {
  const fleets = map.traffic ?? [];
  if (!fleets.length) return [];
  const failed: string[] = [];
  const sea = { ...map, traffic: [] };
  for (const fleet of fleets) {
    const land = fleetLand(map, fleet);
    const lane = laneOf(map, fleet);
    if (lane.length < 2) continue;
    const length = lane
      .slice(1)
      .reduce((s, p, i) => s + Math.hypot(p.x - lane[i]!.x, p.y - lane[i]!.y), 0);
    for (const fromDeg of CHECK_WINDS) {
      const world = createWorld(sea, SLOOP);
      world.land = land;
      // The player's boat far away: nobody to give way to.
      world.boat.x = world.boat.y = 1e6;
      world.calmWind = { from: fromDeg * DEG, speedKn: 14 };
      const one = { ...map, traffic: [{ ...fleet, names: [fleet.names[0] ?? 'check'] }] };
      const boat = createTraffic(one, world.land).boats[0];
      if (!boat) continue;
      // From the home harbour, as if just leaving.
      boat.boat.x = lane[0]!.x;
      boat.boat.y = lane[0]!.y;
      boat.outbound = true;
      boat.casts = 1;
      boat.route = lane.slice(1);
      boat.leg = 0;
      boat.legFrom = { ...lane[0]! };
      boat.waitUntil = 0;
      boat.best = Infinity;
      boat.bestAt = world.time;
      // Out and home at a fifth of her best speed made good, time in harbour, a minute to spare.
      const unitsPerSec = boat.ship.speedRatio * 14 * 0.2 * TUNING.seamanship.boat.knotToUnits;
      const seconds = (2 * length) / unitsPerSec + TUNING.seamanship.traffic.dwellSec[1]! + 60;
      const end = world.time + seconds;
      while (world.time < end && boat.trips === 0) sailAlone(world, boat, 5, 0.2);
      const home = boat.trips > 0;
      if (boat.stuck) failed.push(`${fleet.id} gave up a mark in wind from ${fromDeg}°`);
      else if (!home)
        failed.push(
          `${fleet.id} not home within ${Math.round(seconds)} s in wind from ${fromDeg}°`,
        );
    }
  }
  return [
    failed.length
      ? bad('traffic-sail', failed.slice(0, 4).join('; ') + (failed.length > 4 ? '…' : ''))
      : ok('traffic-sail', `${fleets.length} fleets sail their lanes in winds from every quarter`),
  ];
}

/**
 * A lane's marks from the route planner (`npm run sea -- add fleet … --route`, the editor's Route
 * button): the shortest way a sloop finds between the harbours (or to the grounds) with the wind
 * on the beam, so it goes round land rather than tacking, without its two ends.
 */
export function routeLane(map: MapDef, fleet: TrafficDef): [number, number][] | null {
  const lane = laneOf(map, { ...fleet, path: [] });
  if (lane.length < 2) return null;
  const ship = trafficShip(fleet);
  const land = fleetLand(map, fleet);
  const sea = { ...map, islands: land.islands, terrain: land.terrain };
  // Room to beat up the lane: the planner keeps her this much farther off than her hull needs,
  // or half that, or just clear of the checks, where a passage is narrower.
  const room = TUNING.seamanship.traffic.laneRoom;
  const rooms = [room, room / 2, 2];
  const route = (a: Point, b: Point, extra: number) => {
    const hull = { radius: ship.radius + extra, draft: ship.draft };
    const bearing = (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;
    let best: { points: Point[]; seconds: number } | null = null;
    for (const side of [90, -90]) {
      const r = sailRoute(sea, a, b, bearing + side, 11, undefined, hull);
      if (r && (!best || r.seconds < best.seconds)) best = r;
    }
    return best;
  };
  // A harbour buoy in the planner's blind spot by a shore: try open water a little off it, and
  // keep that point as a mark of the lane.
  const near = (p: Point) => [
    p,
    ...[12, 24, 36].flatMap((d) =>
      Array.from({ length: 12 }, (_, k) => ({
        x: Math.round(p.x + Math.sin((k / 12) * Math.PI * 2) * d),
        y: Math.round(p.y + Math.cos((k / 12) * Math.PI * 2) * d),
      })),
    ),
  ];
  const a0 = lane[0]!;
  const b0 = lane[lane.length - 1]!;
  const lay = (a: Point, b: Point, extra: number) => {
    const r = route(a, b, extra);
    if (!r) return null;
    const pts = [
      a0,
      ...(a === a0 ? [] : [a]),
      ...r.points.slice(1, -1),
      ...(b === b0 ? [] : [b]),
      b0,
    ];
    return straighten(map, land, pts, ship.radius + extra, ship.draft)
      .slice(1, -1)
      .map((p) => [Math.round(p.x), Math.round(p.y)] as [number, number]);
  };
  for (const extra of rooms) {
    const lane = lay(a0, b0, extra);
    if (lane) return lane;
  }
  const ends = near(b0);
  for (const extra of rooms)
    for (const a of near(a0).slice(0, 13))
      for (const b of ends) {
        if (a === a0 && b === b0) continue;
        const lane = lay(a, b, extra);
        if (lane) return lane;
      }
  return null;
}

type Point = { x: number; y: number };

/** Whether a hull of radius `r` sails clear from `a` to `b`. */
function clearRun(
  map: MapDef,
  land: ReturnType<typeof fleetLand>,
  a: Point,
  b: Point,
  r: number,
  draft: number,
): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / SAMPLE));
  for (let k = 1; k < n; k++)
    if (blockedAt(map, land, a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n, r, draft))
      return false;
  return true;
}

/** The planner's grid steps pulled straight: from each mark, on to the farthest one in clear water. */
function straighten(
  map: MapDef,
  land: ReturnType<typeof fleetLand>,
  pts: Point[],
  r: number,
  draft: number,
): Point[] {
  const out = [pts[0]!];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !clearRun(map, land, pts[i]!, pts[j]!, r, draft)) j--;
    out.push(pts[j]!);
    i = j;
  }
  return out;
}
