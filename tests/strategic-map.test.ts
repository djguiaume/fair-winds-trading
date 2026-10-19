import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PHASE0_MAP, PHASE1_MAP } from '../src/data/maps';
import { createBoat, stepBoat, KNOT_TO_UNITS } from '../src/sim/boat';
import { coastDistance } from '../src/sim/coast';
import { resolveCollisions } from '../src/sim/collision';
import type { MapDef, TerrainDef } from '../src/sim/map';
import { DEG, bearingTo, clamp, wrapAngle } from '../src/sim/math';
import { SLOOP, CUTTER, polarFraction } from '../src/sim/ship';
import { applySave, serializeWorld, validateSave } from '../src/sim/save';
import { createWorld } from '../src/sim/world';
import { buildHighlandIslands, islandParts } from '../src/render/models/highlandIslands';
import { Ocean } from '../src/render/ocean';

const terrain = PHASE1_MAP.terrain!;
const square: TerrainDef = {
  id: 'test',
  kind: 'island',
  outline: [
    [0, 0],
    [20, 0],
    [20, 20],
    [0, 20],
  ],
};
const clearanceCache = new WeakMap<MapDef, Map<string, boolean>>();
function clear(x: number, y: number, margin: number, map = PHASE1_MAP) {
  let cache = clearanceCache.get(map);
  if (!cache) {
    cache = new Map();
    clearanceCache.set(map, cache);
  }
  const key = `${x.toFixed(4)},${y.toFixed(4)},${margin}`;
  const prior = cache.get(key);
  if (prior !== undefined) return prior;
  const result = clearUncached(x, y, margin, map);
  cache.set(key, result);
  return result;
}
function clearUncached(x: number, y: number, margin: number, map = PHASE1_MAP) {
  return (
    Math.hypot(x, y) < map.boundsRadius - margin &&
    map.islands.every((i) => Math.hypot(x - i.x, y - i.y) > i.radius + margin) &&
    (map.terrain ?? []).every((t) => coastDistance(x, y, t.outline).distance > margin)
  );
}

describe('polygon coast collisions', () => {
  it('expels a hull from land and stops a glancing shore overlap for either winding', () => {
    for (const outline of [square.outline, [...square.outline].reverse()]) {
      for (const [x, y] of [
        [10, 10],
        [22, 10],
        [20, 10],
        [-1, -1],
      ]) {
        const boat = createBoat(x!, y!, 0);
        expect(resolveCollisions(boat, 4.5, [], 260, [{ ...square, outline }])).toBe(true);
        expect(coastDistance(boat.x, boat.y, outline).distance).toBeGreaterThanOrEqual(4.5 - 1e-5);
      }
    }
  });
  it('keeps the concave bay navigable rather than colliding with its bounding circle', () => {
    const outline: TerrainDef['outline'] = [
      [0, 0],
      [20, 0],
      [20, 5],
      [5, 5],
      [5, 20],
      [0, 20],
    ];
    expect(coastDistance(12, 12, outline).distance).toBeGreaterThan(4.5);
    const boat = createBoat(12, 12, 0);
    expect(resolveCollisions(boat, 4.5, [], 260, [{ ...square, outline }])).toBe(false);
    const corner = createBoat(4.8, 4.8, 0);
    expect(resolveCollisions(corner, 4.5, [], 260, [{ ...square, outline }])).toBe(true);
    expect(coastDistance(corner.x, corner.y, outline).distance).toBeGreaterThanOrEqual(4.5 - 1e-5);
  });
});

describe('selected trading map', () => {
  it('preserves all existing islands, docks, props and procedural seeds exactly', () => {
    expect(PHASE1_MAP.islands).toEqual(PHASE0_MAP.islands);
    expect(PHASE1_MAP.seed).toBe(PHASE0_MAP.seed);
    for (const i of [0, 1, 2, 6]) {
      const oldParts = islandParts(PHASE0_MAP.islands[i]!, PHASE0_MAP, PHASE0_MAP.seed * 1000 + i);
      const newParts = islandParts(PHASE1_MAP.islands[i]!, PHASE1_MAP, PHASE1_MAP.seed * 1000 + i);
      expect(newParts.map((g) => Array.from(g.attributes.position!.array))).toEqual(
        oldParts.map((g) => Array.from(g.attributes.position!.array)),
      );
      [...oldParts, ...newParts].forEach((g) => g.dispose());
    }
  });
  it('keeps spawn, every docking ring and a broad eastern sailing lane clear', () => {
    expect(clear(PHASE1_MAP.start.x, PHASE1_MAP.start.y, CUTTER.radius + 3)).toBe(true);
    for (const port of PHASE1_MAP.ports) {
      const island = PHASE1_MAP.islands.find((i) => i.id === port.islandId)!;
      for (let angle = 0; angle < 360; angle += 15) {
        const d = island.radius + 12;
        expect(
          clear(
            island.x + d * Math.sin(angle * DEG),
            island.y + d * Math.cos(angle * DEG),
            CUTTER.radius,
          ),
        ).toBe(true);
      }
    }
    for (let x = 115; x <= 175; x += 5)
      for (let y = -170; y <= 110; y += 5) {
        // Existing east-key and far-rock remain landmarks, with room around both sides.
        expect(terrain.every((t) => coastDistance(x, y, t.outline).distance > 12)).toBe(true);
      }
  });
  it('renders the exact new coastline in one merged mesh and gives every edge a water halo', () => {
    const mesh = buildHighlandIslands(PHASE1_MAP, { shadows: false }) as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.Material
    >;
    expect(mesh.geometry.attributes.position!.count).toBeGreaterThan(0);
    expect(Array.from(mesh.geometry.attributes.position!.array).every(Number.isFinite)).toBe(true);
    const ocean = new Ocean(PHASE1_MAP.islands, 8, false, 480, terrain);
    expect(ocean.mesh.material.uniforms.uCoastEdgeCount!.value).toBe(
      terrain.reduce((n, t) => n + t.outline.length, 0),
    );
    for (const t of terrain)
      for (const [x, y] of t.outline) {
        const pos = mesh.geometry.attributes.position!;
        let found = false;
        for (let i = 0; i < pos.count; i++)
          if (Math.abs(pos.getX(i) - x) < 1e-4 && Math.abs(pos.getZ(i) + y) < 1e-4) found = true;
        expect(found).toBe(true);
      }
    mesh.geometry.dispose();
    mesh.material.dispose();
    ocean.dispose();
  });
  it('migrates prototype trading progress and relocates covered positions without losing cargo', () => {
    const old = createWorld(PHASE0_MAP, SLOOP);
    old.trade.captain.gold = 987;
    old.trade.captain.cargo.fish = 3;
    old.boat.x = -50;
    old.boat.y = 80; // new northern barrier
    const resumed = createWorld(PHASE1_MAP, SLOOP);
    const valid = validateSave(serializeWorld(old), resumed);
    expect(valid).not.toBeNull();
    applySave(resumed, valid!);
    expect(resumed.trade.captain.gold).toBe(987);
    expect(resumed.trade.captain.cargo.fish).toBe(3);
    expect(resumed.boat.x).toBe(PHASE1_MAP.start.x);
    expect(resumed.boat.y).toBe(PHASE1_MAP.start.y);
    expect(validateSave({ ...serializeWorld(old), map: 'unrelated' }, resumed)).toBeNull();
    old.boat.x = 150;
    old.boat.y = -100;
    applySave(resumed, validateSave(serializeWorld(old), resumed)!);
    expect(resumed.boat.x).toBe(150);
    expect(resumed.boat.y).toBe(-100);
  });
});

// Independent coarse navigation audit: 16 sailing headings, no-go angles excluded, every
// segment checked against coasts at <=3-unit intervals with extra hull/turning clearance.
// Costs estimate steady sailing time; the measured circuit below also runs the boat model.
type Point = { x: number; y: number };
const STEP = 8;
const dirs = [
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
];
function route(
  start: Point,
  goal: Point,
  windDeg: number,
  map: MapDef = PHASE1_MAP,
): { points: Point[]; seconds: number } {
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
    for (const [dx, dy] of dirs) {
      const q = { x: p.x + dx! * STEP, y: p.y + dy! * STEP };
      const angle = Math.abs(wrapAngle(bearingTo(p, q) - windDeg * DEG));
      if (angle < SLOOP.noGoAngle + 10 * DEG) continue;
      const length = Math.hypot(q.x - p.x, q.y - p.y),
        samples = Math.ceil(length / 3);
      let free = true;
      for (let i = 1; i <= samples; i++)
        if (
          !clear(
            p.x + ((q.x - p.x) * i) / samples,
            p.y + ((q.y - p.y) * i) / samples,
            SLOOP.radius + 11,
            map,
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
  throw new Error(`No sailable route ${key(start)} → ${key(goal)} in wind ${windDeg}`);
}
const approaches = PHASE1_MAP.ports.map((port) => {
  const island = PHASE1_MAP.islands.find((i) => i.id === port.islandId)!;
  return { x: island.x, y: island.y - island.radius - 20 };
});
describe('wind-aware route audit', () => {
  it('connects every port pair without sailing into the no-go zone in several wind directions', () => {
    const report: number[] = [];
    for (const wind of [0, 30, 120, 210, 300])
      for (let a = 0; a < 4; a++)
        for (let b = 0; b < 4; b++)
          if (a !== b) {
            const plan = route(approaches[a]!, approaches[b]!, wind);
            expect(plan.points.length).toBeGreaterThan(1);
            report.push(plan.seconds);
          }
    console.log(
      'steady sailing estimates, all port pairs / five winds:',
      Math.min(...report).toFixed(0),
      '–',
      Math.max(...report).toFixed(0),
      's',
    );
  }, 30000);
  it('sails a four-port circuit with the actual sloop model without hitting shore', () => {
    const boat = createBoat(
      Math.round(approaches[0]!.x / STEP) * STEP,
      Math.round(approaches[0]!.y / STEP) * STEP,
      Math.PI / 2,
    );
    let elapsed = 0;
    let tack = 1;
    let lastTack = -Infinity;
    const legs: number[] = [];
    for (const destination of [2, 3, 1, 0]) {
      // Leave Saltmere to seaward before turning upwind: heading straight north from
      // its southern approach would put the island inside the turn.
      const offshore = { x: 112, y: -192 };
      const departure = destination === 0 ? route(boat, offshore, 30) : null;
      const onward = route(departure ? offshore : boat, approaches[destination]!, 30);
      const plan = departure
        ? {
            points: [...departure.points, ...onward.points.slice(1)],
            seconds: departure.seconds + onward.seconds,
          }
        : onward;
      let index = 1;
      const startTime = elapsed;
      while (index < plan.points.length && elapsed - startTime < 240) {
        const target = plan.points[index]!;
        if (Math.hypot(target.x - boat.x, target.y - boat.y) < 9) {
          index++;
          continue;
        }
        let desired = bearingTo(boat, target);
        const twa = wrapAngle(desired - 30 * DEG);
        if (Math.abs(twa) < 55 * DEG) {
          if (twa * tack < -12 * DEG && elapsed - lastTack > 3) {
            tack = -tack;
            lastTack = elapsed;
          }
          desired = 30 * DEG + tack * 58 * DEG;
        }
        const error = wrapAngle(desired - boat.heading);
        const steer = clamp(error * 2.5, -1, 1);
        stepBoat(
          boat,
          {
            steer,
            sailStep: Math.abs(error) > 20 * DEG ? 0 : 1,
          },
          SLOOP,
          { from: 30 * DEG, speedKn: 14 },
          1 / 60,
        );
        expect(
          resolveCollisions(
            boat,
            SLOOP.radius,
            PHASE1_MAP.islands,
            PHASE1_MAP.boundsRadius,
            terrain,
          ),
          `leg to ${destination}, at ${boat.x.toFixed(1)},${boat.y.toFixed(1)} target ${target.x},${target.y}`,
        ).toBe(false);
        elapsed += 1 / 60;
      }
      expect(
        index,
        `destination ${destination}: ${boat.x.toFixed(1)},${boat.y.toFixed(1)}, target ${JSON.stringify(plan.points[index])}`,
      ).toBe(plan.points.length);
      legs.push(elapsed - startTime);
    }
    console.log(
      'measured four-port sloop circuit legs:',
      legs.map((t) => t.toFixed(0)).join(', '),
      's',
    );
  }, 30000);
});
