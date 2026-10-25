import { describe, expect, it } from 'vitest';
import { PHASE1_SOURCE } from '../src/data/maps';
import { SEA_SECTORS, grownMap } from '../src/data/grownMap';
import type { MapDef } from '../src/sim/map';
import { densityLines, seaDensity } from '../src/sim/seaDensity';

/** An empty outer ring with one island in the east quarter. */
function testMap(): MapDef {
  return {
    ...PHASE1_SOURCE,
    boundsRadius: 985,
    islands: [{ id: 'east-isle', x: 700, y: 0, radius: 40 }],
    terrain: [],
    marks: [],
    windZones: [],
    currents: [],
    ports: [],
    fog: { chartedRadius: 445, areas: [] } as never,
  };
}

describe('sea density (0180)', () => {
  it('counts landmarks per quarter and finds the empty water', () => {
    const rows = seaDensity(testMap(), SEA_SECTORS, { cell: 20 });
    const east = rows.find((r) => r.id === 'east')!;
    const west = rows.find((r) => r.id === 'west')!;
    expect(east.islands).toBe(1);
    expect(west.islands).toBe(0);
    expect(west.empty).toBe(1);
    expect(east.empty).toBeLessThan(west.empty);
    // The biggest empty disc of the east keeps clear of the island.
    for (const s of east.spots)
      expect(Math.hypot(s.x - 700, s.y) - 40).toBeGreaterThanOrEqual(s.radius - 1);
    expect(densityLines(rows)[0]).toContain('empty');
  });

  it('measures the grown sea', () => {
    const rows = seaDensity(grownMap(PHASE1_SOURCE), SEA_SECTORS, { cell: 25 });
    expect(rows.map((r) => r.id).sort()).toEqual(Object.keys(SEA_SECTORS).sort());
    for (const r of rows) expect(r.water).toBeGreaterThan(0);
  });
});
