import type { MapDef } from '../sim/map';
import { DEFAULT_WEATHER } from '../sim/wind';
import phase0 from './phase0-map.json';
import phase1 from './phase1-map.json';

// JSON imports type good ids as plain strings; the map tests check every id is a known good.
export const PHASE0_MAP = phase0 as MapDef;

/** The trading map gets slow weather shifts (decision 0026); Phase 0 practice keeps a steady wind. */
export const PHASE1_MAP: MapDef = {
  ...(phase1 as MapDef),
  wind: { weather: DEFAULT_WEATHER, ...(phase1 as MapDef).wind },
};
