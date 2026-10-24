// The seas the tools load by name (decision 0153): the ring, the stress sea, the grown Phase 4
// sea, an editor export (a whole map) or one sea file merged round the ring.
import { readFileSync } from 'node:fs';
import { type SeaDef, SEAS, grownMap } from '../../src/data/grownMap';
import { PHASE1_MAP, PHASE1_SOURCE, prepareMap } from '../../src/data/maps';
import { stressMap } from '../../src/data/stressMap';
import type { MapDef } from '../../src/sim/map';

/** The named seas, an editor export (a whole map) or one sea file merged round the ring. */
export function loadSea(name: string): { map: MapDef; prepared: MapDef; label: string } {
  if (name === 'ring') return { map: PHASE1_SOURCE, prepared: PHASE1_MAP, label: 'ring' };
  if (name === 'stress') {
    const map = stressMap(PHASE1_SOURCE);
    return { map, prepared: prepareMap(map), label: 'stress' };
  }
  if (name === 'phase4') {
    const map = grownMap(PHASE1_SOURCE);
    return { map, prepared: prepareMap(map), label: 'phase4' };
  }
  const data = JSON.parse(readFileSync(name, 'utf8')) as MapDef | SeaDef;
  const label = name.replace(/^.*\//, '').replace(/\.json$/, '');
  if ('boundsRadius' in data) return { map: data, prepared: prepareMap(data), label };
  // A sea file (src/data/seas/*.json): it replaces the shipped sea with the same id.
  const map = grownMap(PHASE1_SOURCE, [...SEAS.filter((s) => s.id !== data.id), data]);
  return { map, prepared: prepareMap(map), label };
}
