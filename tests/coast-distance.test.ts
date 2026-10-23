import { expect, test } from 'vitest';
import { coastDistance } from '../src/sim/coast';
import map from '../src/data/phase1-map.json';
import { PHASE1_MAP } from '../src/data/maps';
import { islandCoasts } from '../src/sim/islandLayout';
import type { TerrainDef } from '../src/sim/map';
import { originalCoastDistance } from './helpers/originalCoastDistance';

test('coast distance exactly matches the original on map terrain and boundary cases', () => {
  const outlines: TerrainDef['outline'][] = [
    ...PHASE1_MAP.islands.flatMap((island) => islandCoasts(island) ?? []),
    ...map.terrain.map((t) => t.outline as TerrainDef['outline']),
    [],
    [[0, 0]],
    [
      [0, 0],
      [0, 0],
    ],
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
    [
      [0, 0],
      [1e-170, 0],
      [0, 1e-170],
    ],
    [
      [0, 0],
      [1e150, 0],
      [0, 1e150],
    ],
  ];
  for (const outline of outlines) {
    for (const winding of [outline, [...outline].reverse()]) {
      const points = [
        [0, 0],
        [5, 5],
        [5, 5 + Number.EPSILON * 8],
        [1e160, 1e160],
      ];
      for (let i = 0; i < 80; i++) points.push([Math.sin(i * 123) * 8000, Math.cos(i * 73) * 8000]);
      for (const [x, y] of outline) points.push([x, y], [x + 1e-9, y], [x - 1e-7, y]);
      for (const [x, y] of points) {
        expect(coastDistance(x!, y!, winding)).toEqual(originalCoastDistance(x!, y!, winding));
      }
    }
  }
});
