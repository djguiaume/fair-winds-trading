import { describe, expect, it } from 'vitest';
import { PHASE0_MAP, PHASE1_MAP } from '../src/data/maps';
import { createBoat } from '../src/sim/boat';
import { piersOf, resolveCollisions } from '../src/sim/collision';
import { hullFootprint, hullSegmentGap, hullCoastGap } from '../src/sim/harbourDistance';
import { SHIP_CLASSES } from '../src/sim/ship';
import { HULL_DIMENSIONS, HULL_SCALE } from '../src/sim/hullShape';
import {
  createTradeState,
  distanceToPort,
  DOCK_RANGE,
  portInRange,
  stepTrade,
  tryDock,
  UNDOCK_MARGIN,
} from '../src/sim/trade';

describe('real hull harbour clearance', () => {
  it('uses heading, bow/stern length and beam rather than a boat-centre circle', () => {
    const north = hullFootprint({ x: 0, y: 0, heading: 0 }, 'indiaman');
    const east = hullFootprint({ x: 0, y: 0, heading: Math.PI / 2 }, 'indiaman');
    expect(Math.max(...north.map((p) => p[1]))).toBeCloseTo(14.3);
    expect(Math.max(...east.map((p) => p[0]))).toBeCloseTo(14.3);
    expect(hullSegmentGap(north, [-20, 20], [20, 20])).toBeCloseTo(5.7);
    expect(hullSegmentGap(east, [-20, 20], [20, 20])).toBeGreaterThan(15);
    // Crossing edges and complete containment both have no gap.
    expect(hullSegmentGap(north, [-20, 0], [20, 0])).toBe(0);
    expect(hullSegmentGap(north, [0, -1], [0, 1])).toBe(0);
    expect(
      hullCoastGap(north, [
        [-30, -30],
        [30, -30],
        [30, 30],
        [-30, 30],
      ]),
    ).toBe(0);
  });

  for (const map of [PHASE0_MAP, PHASE1_MAP])
    for (const port of map.ports)
      for (const ship of Object.values(SHIP_CLASSES)) {
        it(`${map.name}: ${ship.name} docks at ${port.name}, every dock level and orientation`, () => {
          const island = map.islands.find((i) => i.id === port.islandId)!;
          for (const level of [1, 2, 3, 4] as const) {
            const trade = createTradeState(map, ship);
            trade.settlements.byPort[port.id]!.level = level;
            const piers = piersOf(map, { [port.id]: level });
            const targets = piers.filter((p) => p.islandId === island.id && !p.boat);
            for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
              const offset = island.radius + ship.radius;
              const boat = createBoat(
                island.x + Math.sin(heading) * offset,
                island.y + Math.cos(heading) * offset,
                heading,
              );
              resolveCollisions(
                boat,
                ship.radius,
                map.islands,
                map.boundsRadius,
                map.terrain,
                piers,
              );
              trade.dockedAt = null;
              expect(tryDock(trade, map, boat, port.id)).toBe(true);
            }
            for (const pier of targets) {
              const dx = pier.x1 - pier.x0,
                dy = pier.y1 - pier.y0;
              const length = Math.hypot(dx, dy);
              const nx = dx / length,
                ny = dy / length;
              for (const side of [0, -1, 1])
                for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
                  const gap = ship.radius + (pier.halfWidth ?? 0.99);
                  const x =
                    side === 0 ? pier.x1 + nx * gap : (pier.x0 + pier.x1) / 2 - ny * gap * side;
                  const y =
                    side === 0 ? pier.y1 + ny * gap : (pier.y0 + pier.y1) / 2 + nx * gap * side;
                  const boat = createBoat(x, y, heading);
                  // Use the position actually allowed by the collision system.
                  resolveCollisions(
                    boat,
                    ship.radius,
                    map.islands,
                    map.boundsRadius,
                    map.terrain,
                    piers,
                  );
                  expect(distanceToPort(map, boat, port, level, ship.id)).toBeLessThanOrEqual(
                    DOCK_RANGE,
                  );
                  expect(
                    portInRange(map, boat, DOCK_RANGE, { [port.id]: level }, ship.id)?.id,
                  ).toBe(port.id);
                  trade.dockedAt = null;
                  expect(tryDock(trade, map, boat, port.id)).toBe(true);
                  trade.dockedAt = null;
                  expect(stepTrade(trade, map, boat, 0)).toContainEqual({
                    type: 'docked',
                    portId: port.id,
                  });
                  boat.speedKn = 6;
                  trade.dockedAt = null;
                  expect(tryDock(trade, map, boat, port.id)).toBe(false);
                }
            }
            // Every port, including those without a pier, still rejects distant boats.
            const far = { x: island.x + island.radius + 100, y: island.y, heading: 0, speedKn: 0 };
            trade.dockedAt = null;
            expect(tryDock(trade, map, far, port.id)).toBe(false);
            trade.dockedAt = port.id;
            expect(stepTrade(trade, map, far, 0)).toContainEqual({
              type: 'undocked',
              portId: port.id,
            });
          }
        });
      }

  it('adds two units of tolerance and retains the departure margin', () => {
    expect(DOCK_RANGE).toBe(16);
    expect(UNDOCK_MARGIN).toBe(6);
    const port = PHASE0_MAP.ports[0]!;
    const map = {
      ...PHASE0_MAP,
      ports: [port],
      course: [],
      islands: [{ id: port.islandId, x: 0, y: 0, radius: 20 }],
    };
    for (const ship of Object.values(SHIP_CLASSES)) {
      const trade = createTradeState(map, ship);
      const halfLength = (HULL_DIMENSIONS[ship.id]!.length * HULL_SCALE) / 2;
      const boat = { x: 0, y: 20 + halfLength + 15, heading: Math.PI, speedKn: 0 };
      expect(distanceToPort(map, boat, port, 2, ship.id)).toBeCloseTo(15);
      expect(tryDock(trade, map, boat, port.id)).toBe(true);
      boat.y += 2;
      trade.dockedAt = null;
      expect(tryDock(trade, map, boat, port.id)).toBe(false);
      trade.dockedAt = port.id;
      expect(stepTrade(trade, map, boat, 0).some((e) => e.type === 'undocked')).toBe(false);
      boat.y += 6;
      expect(stepTrade(trade, map, boat, 0)).toContainEqual({ type: 'undocked', portId: port.id });
    }
  });
});
