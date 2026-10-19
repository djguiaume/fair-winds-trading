import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PHASE0_MAP, PHASE1_MAP } from '../src/data/maps';
import { createBoat, stepBoat, KNOT_TO_UNITS } from '../src/sim/boat';
import { coastDistance, insetOutline } from '../src/sim/coast';
import { resolveCollisions } from '../src/sim/collision';
import type { MapDef, TerrainDef } from '../src/sim/map';
import { DEG, bearingTo, clamp, wrapAngle } from '../src/sim/math';
import { SLOOP, CUTTER, polarFraction } from '../src/sim/ship';
import { applySave, serializeWorld, validateSave } from '../src/sim/save';
import { createWorld } from '../src/sim/world';
import { buildHighlandIslands, terrainProps } from '../src/render/models/highlandIslands';
import { triangleCount } from '../src/render/models/geometry';
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

describe('Windward Ring trading map', () => {
  const portIslands = PHASE1_MAP.ports.map((port) =>
    PHASE1_MAP.islands.find((i) => i.id === port.islandId)!,
  );
  const scenery = PHASE1_MAP.islands.filter((i) => !portIslands.includes(i));
  it('spreads the four ports around the rim and makes them the main landmarks', () => {
    expect(PHASE1_MAP.name).toBe('Windward Ring');
    expect(PHASE1_MAP.boundsRadius).toBe(440);
    expect(portIslands).toHaveLength(4);
    for (const island of portIslands) {
      expect(Math.hypot(island.x, island.y)).toBeGreaterThan(280);
      expect(island.radius).toBeGreaterThan(Math.max(...scenery.map((i) => i.radius)));
      expect(island.look?.dock).toBe(true);
    }
    // One port on each side of the wind: every compass quarter has a port.
    const quarters = new Set(
      portIslands.map((i) => Math.floor(bearingTo({ x: 0, y: 0 }, i) / (Math.PI / 2))),
    );
    expect(quarters.size).toBe(4);
  });
  it('keeps spawn, every docking ring and a broad eastern sailing lane clear', () => {
    expect(clear(PHASE1_MAP.start.x, PHASE1_MAP.start.y, CUTTER.radius + 3)).toBe(true);
    for (const island of portIslands) {
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
    for (let x = 300; x <= 380; x += 5)
      for (let y = -60; y <= 100; y += 5) expect(clear(x, y, 12)).toBe(true);
  });
  it('blocks the straight Saltmere–Westholm line but leaves a reach lane each way', () => {
    const [saltmere, westholm] = [portIslands[1]!, portIslands[2]!];
    let blocked = false;
    for (let t = 0.2; t <= 0.8; t += 0.01)
      if (
        !clear(
          saltmere.x + (westholm.x - saltmere.x) * t,
          saltmere.y + (westholm.y - saltmere.y) * t,
          SLOOP.radius,
        )
      )
        blocked = true;
    expect(blocked).toBe(true);
    const out = route(approaches[1]!, approaches[2]!, 30);
    const back = route(approaches[2]!, approaches[1]!, 30);
    // Across the wind both ways: the round trip is no slower than one upwind leg to Calda.
    const upwind = route(approaches[3]!, approaches[0]!, 30);
    expect(out.seconds + back.seconds).toBeLessThan(upwind.seconds * 2);
  }, 30000);
  it('draws barrier islands in B2 tiers inside the exact collision outline', () => {
    const mesh = buildHighlandIslands(PHASE1_MAP, { shadows: false }) as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.Material
    >;
    const pos = mesh.geometry.attributes.position!;
    expect(pos.count).toBeGreaterThan(0);
    expect(Array.from(pos.array).every(Number.isFinite)).toBe(true);
    const ocean = new Ocean(PHASE1_MAP.islands, 8, false, 480, terrain);
    expect(ocean.mesh.material.uniforms.uCoastEdgeCount!.value).toBe(
      terrain.reduce((n, t) => n + t.outline.length, 0),
    );
    for (const t of terrain.filter((t) => t.kind !== 'reef'))
      for (const [x, y] of t.outline) {
        let found = false;
        for (let i = 0; i < pos.count; i++)
          if (Math.abs(pos.getX(i) - x) < 1e-4 && Math.abs(pos.getZ(i) + y) < 1e-4) found = true;
        expect(found).toBe(true);
      }
    for (const t of terrain.filter((t) => t.kind === 'island'))
      for (const inset of [4, 8, 10])
        for (const [x, y] of insetOutline(t.outline, inset))
          expect(coastDistance(x, y, t.outline).distance).toBeLessThan(-inset + 0.5);
    mesh.geometry.dispose();
    mesh.material.dispose();
    ocean.dispose();
  });
  it('keeps every barrier and reef prop inside its shore within the mobile mesh budget', () => {
    expect(terrain.some((t) => t.kind === 'reef')).toBe(true);
    for (const [i, feature] of terrain.entries()) {
      if (feature.kind === 'island') expect(feature.look?.landmark).toBeTruthy();
      const props = terrainProps(feature, PHASE1_MAP.seed * 1709 + i * 97);
      expect(props.reduce((n, g) => n + triangleCount(g), 0)).toBeGreaterThan(100);
      for (const g of props) {
        const p = g.attributes.position!;
        for (let k = 0; k < p.count; k++)
          expect(
            coastDistance(p.getX(k), -p.getZ(k), feature.outline).distance,
          ).toBeLessThanOrEqual(0.001);
        g.dispose();
      }
    }
    const mesh = buildHighlandIslands(PHASE1_MAP, { shadows: false }) as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.Material
    >;
    expect(mesh.children).toHaveLength(0);
    expect(triangleCount(mesh.geometry)).toBeLessThan(20000);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
  it('gives every scenery island a landmark and keeps islands inside the world edge', () => {
    expect(PHASE1_MAP.islands.length).toBeLessThanOrEqual(12);
    for (const i of scenery) expect(i.look?.landmark).toBeTruthy();
    for (const i of PHASE1_MAP.islands)
      expect(Math.hypot(i.x, i.y) + i.radius + SLOOP.radius + 20).toBeLessThan(
        PHASE1_MAP.boundsRadius,
      );
    const ocean = new Ocean(PHASE1_MAP.islands, 8, false, 480, terrain);
    expect(ocean.mesh.material.uniforms.uIslandCount!.value).toBe(PHASE1_MAP.islands.length);
    ocean.dispose();
  });
  it('migrates older-map trading progress and resumes at the clear spawn', () => {
    for (const map of [PHASE0_MAP, { ...PHASE0_MAP, name: 'Staggered passages' }]) {
      const old = createWorld(map, SLOOP);
      old.trade.captain.gold = 987;
      old.trade.captain.cargo.fish = 3;
      old.boat.x = 150;
      old.boat.y = -100;
      old.trade.dockedAt = 'saltmere';
      const resumed = createWorld(PHASE1_MAP, SLOOP);
      const valid = validateSave(serializeWorld(old), resumed);
      expect(valid).not.toBeNull();
      applySave(resumed, valid!);
      expect(resumed.trade.captain.gold).toBe(987);
      expect(resumed.trade.captain.cargo.fish).toBe(3);
      expect(resumed.trade.dockedAt).toBeNull();
      expect(resumed.boat.x).toBe(PHASE1_MAP.start.x);
      expect(resumed.boat.y).toBe(PHASE1_MAP.start.y);
    }
    const old = createWorld(PHASE0_MAP, SLOOP);
    const resumed = createWorld(PHASE1_MAP, SLOOP);
    expect(validateSave({ ...serializeWorld(old), map: 'unrelated' }, resumed)).toBeNull();
    // A same-map save keeps its position.
    const same = createWorld(PHASE1_MAP, SLOOP);
    same.boat.x = 330;
    same.boat.y = 20;
    applySave(resumed, validateSave(serializeWorld(same), resumed)!);
    expect(resumed.boat.x).toBe(330);
    expect(resumed.boat.y).toBe(20);
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
  it('can reach every scenery island under northeast and southwest winds', () => {
    const ports = new Set(PHASE1_MAP.ports.map((p) => p.islandId));
    for (const island of PHASE1_MAP.islands.filter((i) => !ports.has(i.id)))
      for (const wind of [30, 210]) {
        const plan = route(
          PHASE1_MAP.start,
          { x: island.x, y: island.y - island.radius - 20 },
          wind,
        );
        expect(plan.points.length).toBeGreaterThan(1);
        expect(plan.seconds).toBeLessThan(180);
      }
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
      const offshore = { x: 336, y: -192 };
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
      while (index < plan.points.length && elapsed - startTime < 400) {
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
