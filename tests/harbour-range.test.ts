import { expect, it } from 'vitest';
import { PHASE0_MAP, PHASE1_MAP } from '../src/data/maps';
import { hullFootprint, hullRadius } from '../src/sim/harbourDistance';
import { HULL_SHAPES, HULL_DIMENSIONS, HULL_SCALE, HULL_BEAM_SCALE } from '../src/sim/hullShape';
import { distanceToPort } from '../src/sim/trade';

it('bounds every authored ring and preserves unknown-ship fallback', () => {
  for (const [id, shape] of Object.entries(HULL_SHAPES)) {
    const size = HULL_DIMENSIONS[id]!;
    for (const ring of shape.rings)
      for (const [x, z] of shape.outline)
        expect(
          Math.hypot(
            x * size.beam * HULL_BEAM_SCALE * HULL_SCALE * ring.beam,
            z * size.length * HULL_SCALE * ring.length,
          ),
        ).toBeLessThanOrEqual(hullRadius(id) + 1e-12);
    expect(hullRadius(id)).toBeCloseTo(
      Math.max(...hullFootprint({ x: 0, y: 0 }, id).map(([x, y]) => Math.hypot(x, y))),
      12,
    );
  }
  expect(hullRadius('unknown')).toBe(hullRadius('sloop'));
});

it('keeps exact harbour gaps at and around each rejection threshold', () => {
  for (const map of [PHASE0_MAP, PHASE1_MAP])
    for (const port of map.ports)
      for (const shipId of [...Object.keys(HULL_SHAPES), 'unknown']) {
        const island = map.islands.find((i) => i.id === port.islandId)!;
        for (const heading of [0, 0.73, Math.PI / 2, Math.PI]) {
          const pos = { x: island.x + island.radius + 40, y: island.y + 9, heading };
          const gap = distanceToPort(map, pos, port, 2, shipId);
          for (const threshold of [gap, gap + 1e-10, gap - 1e-10, 16]) {
            const bounded = distanceToPort(map, pos, port, 2, shipId, threshold);
            if (gap <= threshold) expect(bounded).toBe(gap);
            else expect(bounded >= gap).toBe(true);
          }
        }
      }
});
