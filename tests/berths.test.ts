import { describe, expect, it } from 'vitest';
import { PHASE1_MAP, PHASE1_SOURCE, prepareMap } from '../src/data/maps';
import { grownMap } from '../src/data/grownMap';
import { TUNING } from '../src/data/tuning';
import { piersOf } from '../src/sim/collision';
import { islandCoasts } from '../src/sim/islandLayout';
import { berthChecks } from '../src/sim/mapChecks';
import { distanceToPort } from '../src/sim/trade';

// Decision 0203: a port docks only at its harbour, not along its island's whole coast.
describe('berths', () => {
  const phase4 = prepareMap(grownMap(PHASE1_SOURCE));

  it('every port of the ring and the grown sea docks only at its harbour', () => {
    for (const map of [PHASE1_MAP, phase4])
      for (const check of berthChecks(map))
        expect(check, check.message).toMatchObject({ ok: true });
  });

  it("Sunreach's arm is no berth away from the pier", () => {
    const port = phase4.ports.find((p) => p.id === 'sunreach')!;
    const island = phase4.islands.find((i) => i.id === port.islandId)!;
    const pier = piersOf(phase4).find((p) => p.islandId === island.id && !p.boat)!;
    const { dockRange, berthReach } = TUNING.seamanship.harbour;
    // Every coast point far from the pier, a few units out to sea: too far to dock.
    const coast = islandCoasts(island)![0]!;
    let far = 0;
    for (const [x, y] of coast) {
      if (Math.hypot(x - pier.x0, y - pier.y0) < berthReach + dockRange + 40) continue;
      const out = Math.hypot(x - island.x, y - island.y);
      const at = { x: x + ((x - island.x) / out) * 8, y: y + ((y - island.y) / out) * 8 };
      expect(distanceToPort(phase4, at, port, 3, 'sloop', dockRange)).toBeGreaterThan(dockRange);
      far++;
    }
    expect(far).toBeGreaterThan(10);
  });
});
