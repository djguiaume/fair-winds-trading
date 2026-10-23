import { KNOT_TO_UNITS } from './boat';
import { coastDistance } from './coast';
import { isGood } from './goods';
import { islandCoasts, islandPoint } from './islandLayout';
import type { IslandDef, MapDef, PortDef } from './map';
import { DEG, bearingTo, wrapAngle } from './math';
import { CUTTER, SLOOP, polarFraction } from './ship';

/**
 * Map checks (decision 0095): the rules the map tests apply to the Windward Ring, written for any
 * map so the map editor can run them in the page and the tests run the very same code.
 */

type Point = { x: number; y: number };

export interface MapCheck {
  /** Stable id, one per rule. */
  id: string;
  ok: boolean;
  /** A warning is worth a look; an error breaks the game or a test. */
  severity: 'error' | 'warning';
  /** One line, the passing summary or what failed. */
  message: string;
}

// --- Clear water ---------------------------------------------------------------------------

const clearanceCache = new WeakMap<MapDef, Map<string, boolean>>();

/** True when a hull with this margin fits at (x, y): inside the world edge and off every shore. */
export function clearAt(map: MapDef, x: number, y: number, margin: number): boolean {
  let cache = clearanceCache.get(map);
  if (!cache) {
    cache = new Map();
    clearanceCache.set(map, cache);
  }
  const key = `${x.toFixed(4)},${y.toFixed(4)},${margin}`;
  const prior = cache.get(key);
  if (prior !== undefined) return prior;
  const result =
    Math.hypot(x, y) < map.boundsRadius - margin &&
    map.islands.every((i) => {
      const coasts = islandCoasts(i);
      return coasts
        ? coasts.every((c) => coastDistance(x, y, c).distance > margin)
        : Math.hypot(x - i.x, y - i.y) > i.radius + margin;
    }) &&
    (map.terrain ?? []).every((t) => coastDistance(x, y, t.outline).distance > margin);
  cache.set(key, result);
  return result;
}

// --- Wind-aware route audit ----------------------------------------------------------------

// Coarse navigation: 16 sailing headings on an 8-unit grid, no-go angles excluded, every
// segment checked against coasts at <=3-unit intervals with extra hull/turning clearance.
// Costs estimate steady sloop sailing time in a 14 kn breeze.
const STEP = 8;
const DIRS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
  [-2, -1],
  [-2, 1],
  [2, -1],
  [2, 1],
  [-1, -2],
  [1, -2],
  [-1, 2],
  [1, 2],
] as const;

export interface SailRoute {
  points: Point[];
  /** Estimated steady sailing time, seconds. */
  seconds: number;
}

/** Fastest sloop route between two points with the wind from `windDeg`, or null if none. */
export function sailRoute(
  map: MapDef,
  start: Point,
  goal: Point,
  windDeg: number,
  turningClearance = 11,
): SailRoute | null {
  const key = (p: Point) => `${p.x},${p.y}`;
  const snap = (p: Point) => ({
    x: Math.round(p.x / STEP) * STEP,
    y: Math.round(p.y / STEP) * STEP,
  });
  const first = snap(start),
    last = snap(goal),
    end = key(last);
  const dist = new Map<string, number>([[key(first), 0]]),
    prev = new Map<string, string>();
  const points = new Map<string, Point>([[key(first), first]]);
  const heuristic = (p: Point) =>
    Math.hypot(p.x - last.x, p.y - last.y) / (14 * SLOOP.speedRatio * KNOT_TO_UNITS);
  const queue = [{ p: first, cost: 0, priority: heuristic(first) }];
  while (queue.length) {
    queue.sort((a, b) => b.priority - a.priority);
    const { p, cost } = queue.pop()!;
    const k = key(p);
    if (cost !== dist.get(k)) continue;
    if (k === end) {
      const path: Point[] = [];
      let at: string | undefined = k;
      while (at) {
        path.push(points.get(at)!);
        at = prev.get(at);
      }
      const ordered = path.reverse();
      const simplified = ordered.filter((p, i) => {
        if (i === 0 || i === ordered.length - 1) return true;
        const a = ordered[i - 1]!,
          b = ordered[i + 1]!;
        return (p.x - a.x) * (b.y - p.y) !== (p.y - a.y) * (b.x - p.x);
      });
      return { points: simplified, seconds: cost };
    }
    for (const [dx, dy] of DIRS) {
      const q = { x: p.x + dx * STEP, y: p.y + dy * STEP };
      const angle = Math.abs(wrapAngle(bearingTo(p, q) - windDeg * DEG));
      if (angle < SLOOP.noGoAngle + 10 * DEG) continue;
      const length = Math.hypot(q.x - p.x, q.y - p.y),
        samples = Math.ceil(length / 3);
      let free = true;
      for (let i = 1; i <= samples; i++)
        if (
          !clearAt(
            map,
            p.x + ((q.x - p.x) * i) / samples,
            p.y + ((q.y - p.y) * i) / samples,
            SLOOP.radius + turningClearance,
          )
        ) {
          free = false;
          break;
        }
      if (!free) continue;
      const next =
        cost + length / (14 * SLOOP.speedRatio * polarFraction(SLOOP, angle) * KNOT_TO_UNITS);
      const nk = key(q);
      if (next >= (dist.get(nk) ?? Infinity)) continue;
      dist.set(nk, next);
      points.set(nk, q);
      prev.set(nk, k);
      queue.push({ p: q, cost: next, priority: next + heuristic(q) });
    }
  }
  return null;
}

/** Where a boat waits off a port: in front of the harbour for profiled islands, else south. */
export function harbourApproach(map: MapDef, port: PortDef, distance = 2.0): Point {
  const island = map.islands.find((i) => i.id === port.islandId)!;
  return island.look?.profile
    ? islandPoint(island, 0.08, distance)
    : { x: island.x, y: island.y - island.radius - 20 };
}

// --- The checks ----------------------------------------------------------------------------

const pass = (id: string, message: string, severity: MapCheck['severity'] = 'error') => ({
  id,
  ok: true,
  severity,
  message,
});
const fail = (id: string, message: string, severity: MapCheck['severity'] = 'error') => ({
  id,
  ok: false,
  severity,
  message,
});
const list = (names: string[]) =>
  names.length > 3
    ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`
    : names.join(', ');

function portGoods(port: PortDef) {
  const lw = Object.values(port.levelWants ?? {}).flat();
  const lp = Object.values(port.levelProduces ?? {}).flat();
  return {
    made: [...port.produces, ...lp] as string[],
    wanted: [...port.wants, ...lw, ...(port.wantsMade ?? [])] as string[],
  };
}

/** The quick checks: data that holds together, land inside the sea, clear harbours and spawn. */
export function quickChecks(map: MapDef): MapCheck[] {
  const out: MapCheck[] = [];
  const islandName = (i: IslandDef) => i.name ?? i.id;

  // Ids and links: every port on a real island, unique ids, a real home port.
  const problems: string[] = [];
  const dupes = (ids: string[]) => ids.filter((id, k) => ids.indexOf(id) !== k);
  for (const id of dupes(map.islands.map((i) => i.id))) problems.push(`two islands "${id}"`);
  for (const id of dupes(map.ports.map((p) => p.id))) problems.push(`two ports "${id}"`);
  for (const id of dupes((map.terrain ?? []).map((t) => t.id))) problems.push(`two shapes "${id}"`);
  for (const port of map.ports) {
    if (!map.islands.some((i) => i.id === port.islandId))
      problems.push(`${port.name} sits on missing island "${port.islandId}"`);
    if (port.level !== undefined && !(port.level >= 1 && port.level <= 4))
      problems.push(`${port.name} level ${port.level} (1 to 4)`);
    const { made, wanted } = portGoods(port);
    for (const good of [...made, ...wanted])
      if (!isGood(good)) problems.push(`${port.name}: unknown good "${good}"`);
  }
  for (const id of dupes(map.ports.map((p) => p.islandId)))
    problems.push(`two ports on island "${id}"`);
  if (map.homePort && !map.ports.some((p) => p.id === map.homePort))
    problems.push(`home port "${map.homePort}" missing`);
  for (const t of map.terrain ?? [])
    if (t.outline.length < 3) problems.push(`${t.name ?? t.id} has fewer than 3 points`);
  out.push(
    problems.length
      ? fail('links', problems.join('; '))
      : pass('links', 'ids unique, every port on an island, goods known'),
  );

  // Trade: every good someone wants is made somewhere and every good made has a buyer.
  const made = new Set(map.ports.flatMap((p) => portGoods(p).made));
  const wanted = new Set(map.ports.flatMap((p) => portGoods(p).wanted));
  const noMaker = [...wanted].filter((g) => !made.has(g));
  const noBuyer = [...made].filter((g) => !wanted.has(g));
  out.push(
    noMaker.length || noBuyer.length
      ? fail(
          'goods',
          [
            noMaker.length ? `nobody makes ${list(noMaker)}` : '',
            noBuyer.length ? `nobody buys ${list(noBuyer)}` : '',
          ]
            .filter(Boolean)
            .join('; '),
        )
      : pass('goods', 'every good has a maker and a buyer'),
  );

  // Land inside the world edge, with room to sail round it.
  const outside = [
    ...map.islands
      .filter((i) => Math.hypot(i.x, i.y) + i.radius + SLOOP.radius + 20 >= map.boundsRadius)
      .map(islandName),
    ...(map.terrain ?? [])
      .filter((t) =>
        t.outline.some(([x, y]) => Math.hypot(x, y) + SLOOP.radius >= map.boundsRadius),
      )
      .map((t) => t.name ?? t.id),
  ];
  out.push(
    outside.length
      ? fail('edge', `too close to the world edge: ${list(outside)}`)
      : pass('edge', 'all land inside the world edge'),
  );

  // Start position: room for a cutter to turn.
  out.push(
    clearAt(map, map.start.x, map.start.y, CUTTER.radius + 3)
      ? pass('start', 'start position in clear water')
      : fail('start', 'start position is on or too close to land'),
  );

  // Harbours: the approach to every port is clear of reefs, shores and other islands.
  const blocked: string[] = [];
  for (const port of map.ports) {
    const island = map.islands.find((i) => i.id === port.islandId);
    if (!island) continue;
    let ok = true;
    if (island.look?.profile) {
      for (let z = 1.5; z <= 2.0; z += 0.1) {
        const p = islandPoint(island, 0.08, z);
        if (!clearAt(map, p.x, p.y, CUTTER.radius)) ok = false;
      }
    } else {
      for (let angle = 0; angle < 360; angle += 15) {
        const d = island.radius + 12;
        if (
          !clearAt(
            map,
            island.x + d * Math.sin(angle * DEG),
            island.y + d * Math.cos(angle * DEG),
            CUTTER.radius,
          )
        )
          ok = false;
      }
    }
    if (!ok) blocked.push(port.name);
  }
  out.push(
    blocked.length
      ? fail('harbours', `harbour approach blocked: ${list(blocked)}`)
      : pass('harbours', 'harbours clear of reefs and shore'),
  );

  // A port faces the course waypoint that carries its island's name (see prepareMap).
  const facing = map.ports
    .filter((p) => !p.hidden)
    .map((p) => map.islands.find((i) => i.id === p.islandId))
    .filter((i): i is IslandDef => !!i && !map.course.some((w) => w.label === i.name));
  out.push(
    facing.length
      ? fail(
          'facing',
          `no waypoint named like ${list(facing.map(islandName))}: harbour faces north`,
          'warning',
        )
      : pass('facing', 'every port faces its waypoint', 'warning'),
  );

  // Scenery islands are landmarks you steer by.
  const portIslands = new Set(map.ports.map((p) => p.islandId));
  const plain = map.islands.filter((i) => !portIslands.has(i.id) && !i.look?.landmark);
  out.push(
    plain.length
      ? fail(
          'landmarks',
          `scenery island without a landmark: ${list(plain.map(islandName))}`,
          'warning',
        )
      : pass('landmarks', 'every scenery island has a landmark', 'warning'),
  );
  return out;
}

/**
 * The slow checks: a sloop can reach every port from the start with the wind from the map's
 * prevailing direction and from the opposite side, and every pair of charted ports connects.
 */
export function routeChecks(map: MapDef): MapCheck[] {
  const winds = [map.wind.fromDeg, (map.wind.fromDeg + 180) % 360];
  const ports = map.ports.filter((p) => map.islands.some((i) => i.id === p.islandId));
  const unreachable: string[] = [];
  let slowest = 0;
  for (const port of ports)
    for (const wind of winds) {
      const plan = sailRoute(map, map.start, harbourApproach(map, port), wind);
      if (!plan) unreachable.push(`${port.name} (wind ${wind}°)`);
      else slowest = Math.max(slowest, plan.seconds);
    }
  const charted = ports.filter((p) => !p.hidden);
  const cut: string[] = [];
  for (const a of charted)
    for (const b of charted)
      if (a !== b && !sailRoute(map, harbourApproach(map, a), harbourApproach(map, b), winds[0]!))
        cut.push(`${a.name} → ${b.name}`);
  return [
    unreachable.length
      ? fail('reach', `no sloop route from the start to ${list(unreachable)}`)
      : pass('reach', `every port reachable by a sloop (longest ${Math.round(slowest)} s)`),
    cut.length
      ? fail('pairs', `no route ${list(cut)}`)
      : pass('pairs', 'every pair of charted ports connects'),
  ];
}

/**
 * Port-to-port distances that moved by more than `tolerance` compared with a reference map, so a
 * drag that changes trade timings is flagged (prices and orders were tuned on those distances).
 */
export function distanceChanges(map: MapDef, reference: MapDef, tolerance = 0.05): MapCheck {
  const at = (m: MapDef, id: string) => {
    const port = m.ports.find((p) => p.id === id);
    const island = port && m.islands.find((i) => i.id === port.islandId);
    return island ? { x: island.x, y: island.y } : null;
  };
  const changes: string[] = [];
  const ids = map.ports.map((p) => p.id);
  for (const [k, a] of ids.entries())
    for (const b of ids.slice(k + 1)) {
      const [a1, b1, a0, b0] = [at(map, a), at(map, b), at(reference, a), at(reference, b)];
      if (!a1 || !b1 || !a0 || !b0) continue;
      const now = Math.hypot(a1.x - b1.x, a1.y - b1.y);
      const was = Math.hypot(a0.x - b0.x, a0.y - b0.y);
      if (Math.abs(now - was) > was * tolerance) {
        const name = (id: string) => map.ports.find((p) => p.id === id)!.name;
        changes.push(`${name(a)} → ${name(b)} now ${Math.round(now)} u (was ${Math.round(was)})`);
      }
    }
  return changes.length
    ? fail('distances', `${list(changes)}: check trade timings`, 'warning')
    : pass('distances', 'port distances as shipped', 'warning');
}
