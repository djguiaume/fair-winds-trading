import { describe, expect, it } from 'vitest';
import { PHASE1_SOURCE, prepareMap } from '../src/data/maps';
import { GROWN_SEA_RADIUS, grownMap } from '../src/data/grownMap';
import { quickChecks, routeChecks } from '../src/sim/mapChecks';

describe('south sea (decision 0151)', () => {
  const map = prepareMap(grownMap(PHASE1_SOURCE));
  it('prints checks', () => {
    const checks = [...quickChecks(map), ...routeChecks(map)];
    for (const c of checks) process.stderr.write([c.ok ? 'OK ' : 'XX ', c.severity, c.id, c.message].join(' ') + '\n');
    expect(map.boundsRadius).toBe(GROWN_SEA_RADIUS);
  }, 120000);
});
