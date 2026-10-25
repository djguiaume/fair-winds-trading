import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { createBoat } from '../src/sim/boat';
import { piersOf, resolveCollisions } from '../src/sim/collision';
import { bearingTo } from '../src/sim/math';
import { createWorld, stepWorld } from '../src/sim/world';
import { hullCondition } from '../src/sim/hazards';
import { SLOOP } from '../src/sim/ship';
import { createTradeState, tryDock } from '../src/sim/trade';
import { islandParts } from '../src/render/models/highlandIslands';

const DT = 1 / 60;
const levelsAt = (level: number) => Object.fromEntries(PHASE1_MAP.ports.map((p) => [p.id, level]));

/** Centres of the drawn decks and moored hulls, in map coordinates (scene z = -y). */
function drawnObstacles(level: number) {
  const out: { islandId: string; kind: string; x: number; y: number }[] = [];
  for (const island of PHASE1_MAP.islands) {
    if (!PHASE1_MAP.ports.some((p) => p.islandId === island.id)) continue;
    const parts = islandParts(island, PHASE1_MAP, 1, undefined, level as 1 | 2 | 3 | 4);
    for (const g of parts) {
      if (g.userData.solid) {
        const c = new THREE.Box3().setFromBufferAttribute(
          g.getAttribute('position') as THREE.BufferAttribute,
        );
        const mid = c.getCenter(new THREE.Vector3());
        out.push({ islandId: island.id, kind: g.userData.solid, x: mid.x, y: -mid.z });
      }
      g.dispose();
    }
  }
  return out;
}

describe('solid harbour obstacles (0082)', () => {
  it('puts a collision pier or boat under every drawn deck and moored hull, at every level', () => {
    for (const level of [1, 2, 3, 4]) {
      const solid = piersOf(PHASE1_MAP, levelsAt(level));
      const drawn = drawnObstacles(level);
      // Saltmere's moored boats, and Westholm's in its bay (decision 0208).
      expect(drawn.filter((d) => d.kind === 'boat')).toHaveLength(level + 3);
      for (const d of drawn) {
        const hit = resolveCollisions(createBoat(d.x, d.y, 0), 0.01, [], 1e5, [], solid);
        expect(hit, `${d.islandId} ${d.kind} L${level}`).toBe(d.kind);
      }
      // …and nothing solid where nothing is drawn: each moored boat capsule sits on a hull.
      for (const boat of solid.filter((p) => p.boat)) {
        const mx = (boat.x0 + boat.x1) / 2,
          my = (boat.y0 + boat.y1) / 2;
        const near = drawn.filter((d) => d.kind === 'boat' && Math.hypot(d.x - mx, d.y - my) < 1);
        expect(near, `L${level}`).toHaveLength(1);
      }
    }
  });

  it('reports ramming a moored boat, which stops the ship and dents the hull', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.trade.settlements.byPort['saltmere']!.level = 4;
    stepWorld(world, { steer: 0, sailStep: 0 }, DT);
    const boat = world.piers.find((p) => p.boat)!;
    expect(boat).toBeDefined();
    const mx = (boat.x0 + boat.x1) / 2,
      my = (boat.y0 + boat.y1) / 2;
    // Beam on: straight at the side of the moored hull.
    const heading = Math.atan2(boat.x1 - boat.x0, boat.y1 - boat.y0) + Math.PI / 2;
    world.boat = createBoat(mx - Math.sin(heading) * 7, my - Math.cos(heading) * 7, heading);
    world.boat.speedKn = 8;
    const events = [];
    for (let t = 0; t < 1; t += DT) events.push(...stepWorld(world, { steer: 0, sailStep: 0 }, DT));
    expect(events.find((e) => e.type === 'crash')).toMatchObject({ surface: 'boat' });
    expect(hullCondition(world.trade)).toBeLessThan(1);
    const side = (world.boat.x - mx) * Math.sin(heading) + (world.boat.y - my) * Math.cos(heading);
    expect(side).toBeLessThan(0); // stopped short of the hull, not through it
  });

  it('keeps every hidden yard approachable and dockable as its dock grows', () => {
    for (const port of PHASE1_MAP.ports.filter((p) => p.hidden)) {
      const island = PHASE1_MAP.islands.find((i) => i.id === port.islandId)!;
      const wp = PHASE1_MAP.course.find((w) => w.label === island.name)!;
      const b = bearingTo(island, wp);
      for (const level of [1, 2, 3, 4]) {
        const solid = piersOf(PHASE1_MAP, { [port.id]: level });
        const yard = solid.filter((p) => p.islandId === island.id);
        expect(yard, `${port.id} L${level}`).toHaveLength(level >= 4 ? 4 : level >= 3 ? 2 : 1);
        // Open water off the pier head, straight out along the harbour bearing.
        const head = yard[0]!;
        for (const out of [6, 9, 12]) {
          const p = { x: head.x1 + Math.sin(b) * out, y: head.y1 + Math.cos(b) * out };
          expect(
            resolveCollisions(createBoat(p.x, p.y, 0), 3, [], 1e5, [], solid),
            `${port.id} L${level} +${out}`,
          ).toBeNull();
        }
        const trade = createTradeState(PHASE1_MAP, SLOOP);
        trade.settlements.byPort[port.id]!.level = level as 1 | 2 | 3 | 4;
        const p = { x: head.x1 + Math.sin(b) * 6, y: head.y1 + Math.cos(b) * 6 };
        expect(tryDock(trade, PHASE1_MAP, { ...p, speedKn: 0 }, port.id)).toBe(true);
      }
    }
  });
});
