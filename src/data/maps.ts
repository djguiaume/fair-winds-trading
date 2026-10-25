import type { MapDef } from '../sim/map';
import { DEFAULT_WEATHER } from '../sim/wind';
import phase0 from './phase0-map.json';
import phase1 from './phase1-map.json';
import { bearingTo } from '../sim/math';
import { islandDesign } from './islands';
import { grownMap } from './grownMap';

// JSON imports type good ids as plain strings; the map tests check every id is a known good.
export const PHASE0_MAP = phase0 as MapDef;

/** The shipped trading map as authored, before `prepareMap`; the map editor starts from it. */
export const PHASE1_SOURCE = phase1 as unknown as MapDef;

/**
 * Turns an authored trading map into the one the game sails: slow weather shifts (decision 0026)
 * and each port island's look facing its course waypoint. Works on a copy, so the map editor can
 * prepare its edited map as often as it likes (decision 0095).
 */
export function prepareMap(source: MapDef): MapDef {
  const raw = structuredClone(source);
  const map: MapDef = {
    ...raw,
    wind: { weather: DEFAULT_WEATHER, ...raw.wind, seaRadius: raw.boundsRadius },
  };
  for (const island of map.islands) {
    const port = map.ports.find((p) => p.islandId === island.id && !p.hidden);
    const wp = map.course.find((p) => p.label === island.name);
    if (port && wp && island.look) {
      island.look.profile = island.look.design
        ? islandDesign(island.look.design).style
        : (port.produces[0] as 'fish' | 'timber' | 'grain' | 'stone');
      island.look.harbourBearing = bearingTo(island, wp);
    } else if (island.look?.design) {
      // Any other island with its own file (decision 0110): drawn, charted and solid in one frame.
      island.look.profile = islandDesign(island.look.design).style;
      island.look.harbourBearing ??= wp ? bearingTo(island, wp) : 0;
    }
  }
  return map;
}

export const PHASE1_MAP: MapDef = prepareMap(PHASE1_SOURCE);

/**
 * The game's sea (decision 0197): the Windward Ring in the middle and the four seas round it,
 * as authored. `PHASE1_SOURCE` and `PHASE1_MAP` stay the ring alone (`?map=ring`, the tests).
 */
export const GAME_SOURCE: MapDef = grownMap(PHASE1_SOURCE);

/** Local storage prefix of the ring-alone test voyage (`?map=ring`), so the real one is never touched. */
export const RING_PREFIX = 'fwt.ring.';

/** The game's sea as sailed. */
export const GAME_MAP: MapDef = prepareMap(GAME_SOURCE);
