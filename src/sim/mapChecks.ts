import { knotToUnits } from './boat';
import { coastDistance } from './coast';
import { piersOf, solidTo } from './collision';
import { CurrentField, laneShape } from './currents';
import { outlineCrosses, smoothOutline } from './flowShapes';
import { TUNING } from '../data/tuning';
import { isFar, isGood } from './goods';
import { islandCoasts, islandPoint } from './islandLayout';
import { landmarkOf } from '../data/islands';
import { type IslandDef, type MapDef, type PortDef, SEA_MARK_TYPES } from './map';
import { DEG, bearingTo, wrapAngle } from './math';
import { CUTTER, SHIP_CLASSES, SLOOP, noGoAngle, polarFraction } from './ship';
import { MAX_SETTLEMENT_LEVEL } from './settlement';
import { NO_ZONE, type ZoneEffect, zoneField, zoneMaxGain, zoneMeanAt } from './windZones';

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

/**
 * True when a hull with this margin fits at (x, y): inside the world edge and off every shore.
 * Shallows count as shore only to a hull deeper than they allow (decision 0151); the default
 * draft is a sloop's.
 */
export function clearAt(
  map: MapDef,
  x: number,
  y: number,
  margin: number,
  draft = SLOOP.draft,
): boolean {
  let cache = clearanceCache.get(map);
  if (!cache) {
    cache = new Map();
    clearanceCache.set(map, cache);
  }
  const key = `${x.toFixed(4)},${y.toFixed(4)},${margin},${draft}`;
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
    (map.terrain ?? []).every(
      (t) => !solidTo(t, draft) || coastDistance(x, y, t.outline).distance > margin,
    );
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

/** Above any current's speed, so the route search's estimate never overshoots (decision 0140). */
const FASTEST_CURRENT_KN = 3.5;

export interface SailRoute {
  points: Point[];
  /** Estimated steady sailing time, seconds. */
  seconds: number;
}

const routeZone: ZoneEffect = { ...NO_ZONE };

/**
 * Fastest sloop route between two points with the wind from `windDeg`, or null if none. With
 * `water` (knots east and north at a point, e.g. a `CurrentField`), each leg's speed over the
 * ground adds the current along it (decision 0140). `hull` swaps the sloop's size and draft for
 * another ship's, so a deep ship's route goes round the shallows it may not cross (0151); the
 * speeds stay the sloop's.
 */
export function sailRoute(
  map: MapDef,
  start: Point,
  goal: Point,
  windDeg: number,
  turningClearance = 11,
  water?: (x: number, y: number) => { east: number; north: number },
  hull: { radius: number; draft: number } = SLOOP,
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
  // Wind zones (decision 0140) bend and weaken the wind along the way; the planner uses their
  // average effect. The fastest a zone can make the wind keeps the estimate optimistic.
  const zones = zoneField(map.windZones, smoothOutline);
  const gain = zones ? zoneMaxGain(zones) : 1;
  const heuristic = (p: Point) =>
    Math.hypot(p.x - last.x, p.y - last.y) /
    ((14 * gain * SLOOP.speedRatio + (water ? FASTEST_CURRENT_KN : 0)) * knotToUnits());
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
      let from = windDeg * DEG,
        strength = 1;
      if (zones) {
        const z = zoneMeanAt(zones, (p.x + q.x) / 2, (p.y + q.y) / 2, from, false, routeZone);
        from += z.turn;
        strength = z.strength;
      }
      const angle = Math.abs(wrapAngle(bearingTo(p, q) - from));
      if (angle < noGoAngle(SLOOP) + 10 * DEG) continue;
      const length = Math.hypot(q.x - p.x, q.y - p.y),
        samples = Math.ceil(length / 3);
      let free = true;
      for (let i = 1; i <= samples; i++)
        if (
          !clearAt(
            map,
            p.x + ((q.x - p.x) * i) / samples,
            p.y + ((q.y - p.y) * i) / samples,
            hull.radius + turningClearance,
            hull.draft,
          )
        ) {
          free = false;
          break;
        }
      if (!free) continue;
      let knots = 14 * strength * SLOOP.speedRatio * polarFraction(SLOOP, angle);
      if (water) {
        const v = water((p.x + q.x) / 2, (p.y + q.y) / 2);
        knots += (v.east * (q.x - p.x) + v.north * (q.y - p.y)) / length;
      }
      if (knots <= 0.5) continue;
      const next = cost + length / (knots * knotToUnits());
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
  // Small islands (the hidden yards, decision 0110) keep the same sea room off their pier.
  return island.look?.profile
    ? islandPoint(island, 0.08, Math.max(distance, 1 + 22 / island.radius))
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
  // What a quest can change it to counts too (decision 0130).
  const all = [port, ...Object.values(port.afterQuest ?? {})];
  const lw = all.flatMap((p) =>
    [p.levelWants, p.levelWantsMade].flatMap((byLevel) => Object.values(byLevel ?? {}).flat()),
  );
  const lp = all.flatMap((p) => Object.values(p.levelProduces ?? {}).flat());
  return {
    made: [...all.flatMap((p) => p.produces ?? []), ...lp] as string[],
    wanted: [
      ...all.flatMap((p) => [...(p.wants ?? []), ...(p.wantsMade ?? [])]),
      ...lw,
    ] as string[],
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
    if (port.level !== undefined && !(port.level >= 1 && port.level <= MAX_SETTLEMENT_LEVEL))
      problems.push(`${port.name} level ${port.level} (1 to ${MAX_SETTLEMENT_LEVEL})`);
    if (
      port.maxLevel !== undefined &&
      !(port.maxLevel >= (port.level ?? 1) && port.maxLevel <= MAX_SETTLEMENT_LEVEL)
    )
      problems.push(
        `${port.name} top level ${port.maxLevel} (its level to ${MAX_SETTLEMENT_LEVEL})`,
      );
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
  for (const [i, mark] of (map.marks ?? []).entries()) {
    const name = `mark ${i} (${mark.type})`;
    if (!(SEA_MARK_TYPES as readonly string[]).includes(mark.type))
      problems.push(`${name}: type is one of ${SEA_MARK_TYPES.join(', ')}`);
    if (!Number.isFinite(mark.x) || !Number.isFinite(mark.y))
      problems.push(`${name}: needs x and y`);
    else if (Math.hypot(mark.x, mark.y) > map.boundsRadius)
      problems.push(`${name} is outside the sea`);
  }
  out.push(
    problems.length
      ? fail('links', problems.join('; '))
      : pass('links', 'ids unique, every port on an island, goods known'),
  );

  // Sea marks in clear water (decision 0130): a warning, as an island dragged onto one is.
  const aground = (map.marks ?? [])
    .map((mark, i) => ({ mark, i }))
    .filter(
      ({ mark }) =>
        mark.type !== 'light' &&
        Number.isFinite(mark.x) &&
        Number.isFinite(mark.y) &&
        !clearAt(map, mark.x, mark.y, 1),
    )
    .map(({ mark, i }) => `mark ${i} (${mark.type})`);
  out.push(
    aground.length
      ? fail('marks', `${list(aground)} on land or a reef`, 'warning')
      : pass('marks', 'sea marks in clear water', 'warning'),
  );

  // Trade: every good someone wants is made somewhere and every good made has a buyer. The ring's
  // port towns may wait for far goods from seas this map doesn't have yet (decision 0146).
  const made = new Set(map.ports.flatMap((p) => portGoods(p).made));
  const wanted = new Set(map.ports.flatMap((p) => portGoods(p).wanted));
  const noMaker = [...wanted].filter((g) => !made.has(g) && !(isGood(g) && isFar(g)));
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

  out.push(...flowChecks(map));

  // Scenery islands are landmarks you steer by.
  const portIslands = new Set(map.ports.map((p) => p.islandId));
  const plain = map.islands.filter((i) => !portIslands.has(i.id) && !landmarkOf(i));
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
 * Currents and wind zones (decision 0140): sound shapes inside the sea, known zone kinds, lanes
 * wide enough, speeds in range, and still water at every pier head and harbour approach.
 */
export function flowChecks(map: MapDef): MapCheck[] {
  const tune = TUNING.weather.currents;
  const currents = map.currents ?? [];
  const zones = map.windZones ?? [];
  const problems: string[] = [];
  const dupes = (ids: string[]) => ids.filter((id, k) => ids.indexOf(id) !== k);
  for (const id of dupes(currents.map((c) => c.id))) problems.push(`two currents "${id}"`);
  for (const id of dupes(zones.map((z) => z.id))) problems.push(`two wind zones "${id}"`);
  const outside = (points: readonly (readonly number[])[]) =>
    points.some((p) => Math.hypot(p[0]!, p[1]!) > map.boundsRadius);
  const [slowest, fastest] = tune.speedKn as [number, number];
  for (const c of currents) {
    const name = c.name ?? c.id;
    if (!(c.speedKn >= slowest && c.speedKn <= fastest))
      problems.push(`${name}: speed ${c.speedKn} kn (${slowest} to ${fastest})`);
    if (c.path) {
      if (c.path.length < 2) problems.push(`${name} has fewer than 2 points`);
      const lane = laneShape(c);
      if (lane && lane.narrowest < tune.minWidthUnits - 1e-6)
        problems.push(`${name} narrower than ${tune.minWidthUnits} units`);
      if (outside(c.path)) problems.push(`${name} leaves the sea`);
    } else if (c.outline) {
      if (c.outline.length < 3) problems.push(`${name} has fewer than 3 points`);
      else if (outlineCrosses(smoothOutline(c.outline))) problems.push(`${name} crosses itself`);
      if (c.towardDeg === undefined) problems.push(`${name}: an area current needs towardDeg`);
      if (outside(c.outline)) problems.push(`${name} leaves the sea`);
    } else problems.push(`${name}: needs a path (lane) or an outline (area)`);
  }
  const kinds = TUNING.weather.zones.kinds as Record<string, unknown>;
  for (const z of zones) {
    const name = z.name ?? z.id;
    if (!(z.kind in kinds))
      problems.push(`${name}: kind "${z.kind}" is one of ${Object.keys(kinds).join(', ')}`);
    if (z.kind in kinds && 'pull' in (kinds[z.kind] as object) && z.headingDeg === undefined)
      problems.push(`${name}: a ${z.kind} zone needs headingDeg`);
    if (z.outline.length < 3) problems.push(`${name} has fewer than 3 points`);
    else if (outlineCrosses(smoothOutline(z.outline))) problems.push(`${name} crosses itself`);
    if (outside(z.outline)) problems.push(`${name} leaves the sea`);
  }
  const out: MapCheck[] = [
    problems.length
      ? fail('flow', problems.join('; '))
      : pass('flow', 'currents and wind zones sound and inside the sea'),
  ];

  // Harbours stay still: the current at every pier head and harbour approach is a trickle.
  if (currents.length) {
    const field = new CurrentField(map);
    const moving: string[] = [];
    const speedAt = (x: number, y: number) => {
      const v = field.at(x, y);
      return Math.hypot(v.east, v.north);
    };
    const portIslands = new Set(map.ports.map((p) => p.islandId));
    if (map.homeIsland) portIslands.add(map.homeIsland);
    for (const pier of piersOf(map))
      if (portIslands.has(pier.islandId) && speedAt(pier.x1, pier.y1) > tune.harbourTrickleKn)
        moving.push(map.islands.find((i) => i.id === pier.islandId)?.name ?? pier.islandId);
    for (const port of map.ports) {
      if (!map.islands.some((i) => i.id === port.islandId)) continue;
      const p = harbourApproach(map, port);
      if (speedAt(p.x, p.y) > tune.harbourTrickleKn) moving.push(`${port.name} approach`);
    }
    out.push(
      moving.length
        ? fail('still-harbours', `current at ${list([...new Set(moving)])}`)
        : pass('still-harbours', 'harbours in still water'),
    );
  }
  return out;
}

/**
 * The slow checks: a sloop can reach every port from the start with the wind from the map's
 * prevailing direction and from the opposite side, and every pair of charted ports connects. With
 * currents, at the strongest level's speed (decision 0149): a current can only make a route harder
 * to find, never easier, so a route found there is there on every level and with them off.
 */
export function routeChecks(map: MapDef): MapCheck[] {
  const winds = [map.wind.fromDeg, (map.wind.fromDeg + 180) % 360];
  const strongest = Math.max(0, ...Object.values(TUNING.difficulty.levels).map((l) => l.currents));
  const field = map.currents?.length && strongest > 0 ? new CurrentField(map) : null;
  const sample = { east: 0, north: 0, id: '' };
  const water = field ? (x: number, y: number) => field.at(x, y, strongest, sample) : undefined;
  const route = (a: Point, b: Point, wind: number) => sailRoute(map, a, b, wind, 11, water);
  const withCurrents = field ? ', against the strongest currents' : '';
  const ports = map.ports.filter((p) => map.islands.some((i) => i.id === p.islandId));
  const unreachable: string[] = [];
  let slowest = 0;
  for (const port of ports)
    for (const wind of winds) {
      const plan = route(map.start, harbourApproach(map, port), wind);
      if (!plan) unreachable.push(`${port.name} (wind ${wind}°)`);
      else slowest = Math.max(slowest, plan.seconds);
    }
  const charted = ports.filter((p) => !p.hidden);
  const cut: string[] = [];
  for (const a of charted)
    for (const b of charted)
      if (a !== b && !route(harbourApproach(map, a), harbourApproach(map, b), winds[0]!))
        cut.push(`${a.name} → ${b.name}`);
  return [
    unreachable.length
      ? fail('reach', `no sloop route from the start to ${list(unreachable)}`)
      : pass(
          'reach',
          `every port reachable by a sloop${withCurrents} (longest ${Math.round(slowest)} s)`,
        ),
    cut.length
      ? fail('pairs', `no route ${list(cut)}${withCurrents}`)
      : pass('pairs', `every pair of charted ports connects${withCurrents}`),
    ...deepChecks(map, ports, water),
  ];
}

/** The deepest ship there is: the one shallows refuse first. */
export const DEEPEST_SHIP = Object.values(SHIP_CLASSES).reduce((a, b) => (b.draft > a.draft ? b : a));

/**
 * With shallows on the map (decision 0151), every port must still be reachable by the deepest
 * ship the long way round, so no story step or trade ever needs a shallow keel. The hull is the
 * deepest ship's draft with a sloop's turning room: the check is about the passages, not width.
 */
function deepChecks(
  map: MapDef,
  ports: PortDef[],
  water?: (x: number, y: number) => { east: number; north: number },
): MapCheck[] {
  if (!(map.terrain ?? []).some((t) => t.kind === 'shallows')) return [];
  const hull = { radius: SLOOP.radius, draft: DEEPEST_SHIP.draft };
  const wind = map.wind.fromDeg;
  const cut = ports
    .filter((p) => !sailRoute(map, map.start, harbourApproach(map, p), wind, 11, water, hull))
    .map((p) => p.name);
  return [
    cut.length
      ? fail('deep', `the ${DEEPEST_SHIP.id} cannot reach ${list(cut)}: shallows close every way`)
      : pass('deep', `every port reachable by the ${DEEPEST_SHIP.id} the long way round`),
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
