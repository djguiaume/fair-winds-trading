import type { MapDef } from '../sim/map';
import phase0 from './phase0-map.json';

// JSON imports type good ids as plain strings; the map tests check every id is a known good.
export const PHASE0_MAP = phase0 as MapDef;
