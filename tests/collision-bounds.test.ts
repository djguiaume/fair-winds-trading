import { expect, it } from 'vitest';
import { createBoat } from '../src/sim/boat';
import { resolveCollisions } from '../src/sim/collision';
import { islandCoasts, islandLake } from '../src/sim/islandLayout';
import type { IslandDef } from '../src/sim/map';

it('keeps polygon collisions identical around the bounds and after island geometry changes', () => {
  for (const profile of ['fish', 'timber', 'grain', 'stone'] as const) {
    const island: IslandDef = {
      id: profile,
      x: 20,
      y: -30,
      radius: 18,
      look: { profile, harbourBearing: 0.7 },
    };
    for (const move of [0, 100]) {
      island.x += move;
      island.radius += move / 10;
      island.look!.harbourBearing! += move / 100;
      const coasts = islandCoasts(island)!;
      // Terrain uses the original, unfiltered polygon resolution path as an independent oracle.
      // Lake handling is covered by the island-layout and harbour integration suites.
      if (islandLake(island)) continue;
      const terrain = coasts.map((outline, i) => ({
        id: `${i}`,
        kind: 'island' as const,
        outline,
      }));
      for (const radius of [1, 8, 16]) {
        for (let dx = -2; dx <= 2; dx += 0.25) {
          for (let dy = -2; dy <= 2; dy += 0.25) {
            const actual = createBoat(
              island.x + dx * island.radius,
              island.y + dy * island.radius,
              0.7,
            );
            actual.speedKn = 5;
            actual.drift = { x: 0.3, y: -0.4 };
            const expected = structuredClone(actual);
            expect(resolveCollisions(actual, radius, [island], 10000)).toEqual(
              resolveCollisions(expected, radius, [], 10000, terrain),
            );
            expect(actual).toEqual(expected);
          }
        }
      }
    }
  }
});
