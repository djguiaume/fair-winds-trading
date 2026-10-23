import { describe, expect, it } from 'vitest';
import { PHASE1_SOURCE, prepareMap } from '../src/data/maps';
import { stressMap } from '../src/data/stressMap';
import { quickChecks } from '../src/sim/mapChecks';

describe('bigger-map stress sea (decision 0115)', () => {
  const map = prepareMap(stressMap(PHASE1_SOURCE));

  it('covers about five times the area with several times the islands', () => {
    expect(map.boundsRadius ** 2 / PHASE1_SOURCE.boundsRadius ** 2).toBeCloseTo(5, 0);
    expect(map.islands.length).toBeGreaterThanOrEqual(PHASE1_SOURCE.islands.length * 3);
  });

  it('has unique ids and every port on one of its islands', () => {
    const ids = map.islands.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    const ports = map.ports.map((p) => p.id);
    expect(new Set(ports).size).toBe(ports.length);
    for (const port of map.ports) expect(ids).toContain(port.islandId);
    expect(ports).toContain(map.homePort);
  });

  it('has no map-check errors', () => {
    const errors = quickChecks(map).filter((c) => !c.ok && c.severity === 'error');
    expect(errors.map((c) => c.message)).toEqual([]);
  });
});
